import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Server } from 'socket.io';
import { z } from 'zod';
import { database, type Database } from './db';
import { createSession, digest, hash, session, token, verify } from './auth';
import { Games } from './games';
import type { Control, User } from '../../../packages/shared/types';
import { arenaRoutes } from './web3';
const control = z.enum(['1+0', '3+2', '5+0', '10+0', '15+10']);
export async function createApp(db: Database) {
  const app = express(),
    server = createServer(app);
  const origins = new Set([process.env.ORIGIN || 'http://localhost:5173', 'http://127.0.0.1:5173']);
  const io = new Server(server, {
    cors: { origin: [...origins], credentials: true },
    maxHttpBufferSize: 8192,
  });
  const games = new Games(db);
  app.use(helmet(), express.json({ limit: '16kb' }), cookieParser());
  app.use('/api', rateLimit({ windowMs: 60000, limit: 180 }));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !origins.has(req.headers.origin || ''))
      return res.status(403).json({ error: 'Invalid request origin.' });
    next();
  });
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 40 });
  app.use('/api/auth', authLimit);
  const setCookie = (res: express.Response, t: string) =>
    res.cookie('cm_session', t, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 86400000,
      path: '/',
    });
  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      storage: process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite',
      mode: 'single-process',
    }),
  );
  app.get('/api/auth/me', async (req, res) =>
    res.json({ user: await session(db, req.cookies.cm_session) }),
  );
  app.post('/api/auth/register', async (req, res) => {
    const p = z
      .object({
        username: z.string().regex(/^[a-zA-Z0-9_]{3,24}$/),
        email: z.email().max(254),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    const id = randomUUID();
    try {
      await db.query(
        'INSERT INTO users(id,username,email,password,joined) VALUES($1,$2,$3,$4,$5)',
        [id, p.username, p.email.toLowerCase(), await hash(p.password), new Date().toISOString()],
      );
    } catch {
      res.status(409).json({ error: 'Username or email is already registered.' });
      return;
    }
    setCookie(res, await createSession(db, id));
    res.status(201).json({ ok: true });
  });
  app.post('/api/auth/login', async (req, res) => {
    const p = z.object({ email: z.email(), password: z.string().max(128) }).parse(req.body);
    const u = (
      await db.query<{ id: string; password: string }>(
        'SELECT id,password FROM users WHERE email=$1',
        [p.email.toLowerCase()],
      )
    ).rows[0];
    if (!u?.password || !(await verify(p.password, u.password)))
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    setCookie(res, await createSession(db, u.id));
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', async (req, res) => {
    if (req.cookies.cm_session)
      await db.query('DELETE FROM sessions WHERE token=$1', [digest(req.cookies.cm_session)]);
    res.clearCookie('cm_session');
    res.json({ ok: true });
  });
  app.post('/api/auth/forgot', async (req, res) => {
    const { email } = z.object({ email: z.email() }).parse(req.body);
    const u = (
      await db.query<{ id: string }>('SELECT id FROM users WHERE email=$1', [email.toLowerCase()])
    ).rows[0];
    if (u && process.env.NODE_ENV !== 'production') {
      const t = token();
      await db.query('INSERT INTO reset_tokens VALUES($1,$2,$3)', [
        digest(t),
        u.id,
        Date.now() + 1800000,
      ]);
      await mkdir('.local/mail', { recursive: true });
      await writeFile(
        `.local/mail/${Date.now()}.txt`,
        `Reset your password: ${process.env.ORIGIN || 'http://localhost:5173'}/login?reset=${t}\nExpires in 30 minutes.\n`,
      );
    }
    res.json({
      ok: true,
      message: 'If the account exists, a reset link has been sent. Local mail is in .local/mail.',
    });
  });
  app.post('/api/auth/reset', async (req, res) => {
    const p = z
      .object({ token: z.string().length(64), password: z.string().min(12).max(128) })
      .parse(req.body);
    const password = await hash(p.password);
    await db.transaction(async (tx) => {
      const rows = await tx.query<{ user_id: string }>(
        'DELETE FROM reset_tokens WHERE token=$1 AND expires>$2 RETURNING user_id',
        [digest(p.token), Date.now()],
      );
      if (!rows.rows[0]) throw Error('Reset link is invalid or expired.');
      const id = rows.rows[0].user_id;
      await tx.query('UPDATE users SET password=$2 WHERE id=$1', [id, password]);
      await tx.query('DELETE FROM sessions WHERE user_id=$1', [id]);
    });
    res.json({ ok: true });
  });
  app.get('/api/leaderboard', async (_req, res) =>
    res.json(
      (
        await db.query(
          "SELECT id,username,rating,bio,joined FROM users WHERE id IN (SELECT state->>'white' FROM games WHERE rated_applied=true UNION SELECT state->>'black' FROM games WHERE rated_applied=true) ORDER BY rating DESC LIMIT 100",
        )
      ).rows,
    ),
  );
  app.get('/api/profile/:username', async (req, res) => {
    const u = (
      await db.query<User>('SELECT id,username,rating,bio,joined FROM users WHERE username=$1', [
        req.params.username,
      ])
    ).rows[0];
    if (!u) return res.status(404).json({ error: 'Player not found.' });
    const records = (
      await db.query(
        "SELECT state FROM games WHERE (state->>'white'=$1 OR state->>'black'=$1) AND state->>'status'='finished' ORDER BY (state->>'created')::bigint DESC LIMIT 30",
        [u.id],
      )
    ).rows;
    res.json({ user: u, games: records.map((r) => r.state) });
  });
  arenaRoutes(app, db, games, setCookie);
  app.use('/api', async (req, res, next) => {
    const u = await session(db, req.cookies.cm_session);
    if (!u) return res.status(401).json({ error: 'Sign in to play online.' });
    res.locals.user = u;
    next();
  });
  app.patch('/api/profile', async (req, res) => {
    const p = z.object({ bio: z.string().max(240) }).parse(req.body);
    await db.query('UPDATE users SET bio=$2 WHERE id=$1', [res.locals.user.id, p.bio]);
    res.json({ ok: true });
  });
  app.get('/api/history', async (_req, res) =>
    res.json(
      (
        await db.query(
          "SELECT state FROM games WHERE state->>'white'=$1 OR state->>'black'=$1 ORDER BY (state->>'created')::bigint DESC LIMIT 100",
          [res.locals.user.id],
        )
      ).rows.map((r) => r.state),
    ),
  );
  app.post('/api/challenges', async (req, res) => {
    const p = z.object({ control, rated: z.boolean().default(false) }).parse(req.body);
    res.json(await games.create(res.locals.user, p.control, p.rated));
  });
  app.post('/api/challenges/:id/join', async (req, res) => {
    const g = await games.join(String(req.params.id), res.locals.user);
    io.to(g.id).emit('game:state', g);
    res.json(g);
  });
  app.get('/api/games/:id', async (req, res) => {
    const g = await games.get(String(req.params.id));
    if (!g) return res.status(404).json({ error: 'Game not found.' });
    if (![g.white, g.black].includes(res.locals.user.id) && g.status !== 'waiting')
      return res.status(403).json({ error: 'This game is private.' });
    res.json(g);
  });
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res
        .status(400)
        .json({
          error:
            err instanceof z.ZodError
              ? 'Please check the supplied fields.'
              : err instanceof Error
                ? err.message
                : 'Request failed.',
        });
    },
  );
  const queue = new Map<
    string,
    { socket: string; user: User; control: Control; rated: boolean; at: number }
  >();
  io.use(async (socket, next) => {
    if (
      !origins.has(
        socket.handshake.headers.origin ||
          (socket.handshake.headers.referer
            ? new URL(socket.handshake.headers.referer).origin
            : ''),
      )
    )
      return next(Error('Invalid origin.'));
    const raw = socket.handshake.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('cm_session='))
      ?.slice(11);
    const u = await session(db, raw);
    if (!u) return next(Error('Please sign in.'));
    socket.data.user = u;
    socket.data.raw = raw;
    next();
  });
  io.on('connection', (socket) => {
    const user = socket.data.user as User;
    let requests = 0;
    const limiter = setInterval(() => (requests = 0), 1000);
    socket.use(async (_packet, next) => {
      if (++requests > 20) return next(Error('Too many messages.'));
      if (!(await session(db, socket.data.raw))) return next(Error('Session expired.'));
      next();
    });
    const handle = (name: string, fn: (p: any) => Promise<unknown>) =>
      socket.on(name, async (p, ack) => {
        try {
          const value = await fn(p);
          if (typeof ack === 'function') ack({ ok: true, value });
        } catch (e) {
          if (typeof ack === 'function')
            ack({ ok: false, error: e instanceof Error ? e.message : 'Action failed.' });
        }
      });
    handle('game:join', async (p) => {
      const id = z.string().uuid().parse(p.id);
      const g = await games.get(id);
      if (!g || ![g.white, g.black].includes(user.id)) throw Error('Not a participant.');
      await socket.join(id);
      socket.emit('game:state', g);
      return g;
    });
    handle('move:submit', async (p) => {
      const v = z
        .object({
          id: z.string().uuid(),
          from: z.string().regex(/^[a-h][1-8]$/),
          to: z.string().regex(/^[a-h][1-8]$/),
          promotion: z.enum(['q', 'r', 'b', 'n']).default('q'),
          revision: z.number().int().min(0),
        })
        .parse(p);
      const g = await games.submit(v.id, user.id, v);
      io.to(g.id).emit('game:state', g);
      return g;
    });
    handle('game:action', async (p) => {
      const v = z
        .object({ id: z.string().uuid(), action: z.enum(['resign', 'offer', 'accept', 'decline']) })
        .parse(p);
      const g = await games.action(v.id, user.id, v.action);
      io.to(g.id).emit('game:state', g);
      return g;
    });
    handle('queue:join', async (p) => {
      const v = z.object({ control, rated: z.boolean() }).parse(p);
      return games.serial(async () => {
        queue.delete(user.id);
        const rival = [...queue.values()].find(
          (q) =>
            q.user.id !== user.id &&
            q.control === v.control &&
            q.rated === v.rated &&
            (!v.rated || Math.abs(q.user.rating - user.rating) <= 150 + (Date.now() - q.at) / 100),
        );
        if (rival) {
          queue.delete(rival.user.id);
          const g = await games.create(rival.user, v.control, v.rated);
          g.black = user.id;
          g.blackName = user.username;
          g.status = 'active';
          g.lastTick = Date.now();
          await games.save(g);
          io.to(rival.socket).emit('match:found', g);
          socket.emit('match:found', g);
          return g;
        }
        queue.set(user.id, { socket: socket.id, user, ...v, at: Date.now() });
        return { waiting: true };
      });
    });
    handle('queue:leave', async () => {
      queue.delete(user.id);
      return {};
    });
    socket.on('disconnect', () => {
      clearInterval(limiter);
      if (queue.get(user.id)?.socket === socket.id) queue.delete(user.id);
    });
  });
  let ticking = false;
  const timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      for (const g of await games.clocks()) io.to(g.id).emit('game:state', g);
    } catch (e) {
      console.error('Clock persistence failed', e instanceof Error ? e.message : e);
    } finally {
      ticking = false;
    }
  }, 1000);
  return {
    app,
    server,
    io,
    games,
    close: async () => {
      clearInterval(timer);
      await new Promise<void>((r) => io.close(() => r()));
      await db.close();
    },
  };
}
if (!process.env.VITEST) {
  const runtime = await createApp(await database());
  runtime.server.listen(Number(process.env.PORT || 3001), '127.0.0.1', () =>
    console.log('ChainMate API http://127.0.0.1:3001'),
  );
}
