import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import { type AppEnv, type Env, type Member, statement as q, lobby, room, internal } from './env';
import { auth, member, digest, limit, requireUser } from './auth';
import { profiles } from './profiles';
import { web3 } from './web3';
import { experience } from './experience';
import type { GameState } from '../../../packages/shared/types';
import { controlValues } from '../../../packages/shared/types';
export { GameRoom, Lobby } from './rooms';
const app = new Hono<AppEnv>();
app.use(
  '/api/*',
  bodyLimit({ maxSize: 2097152, onError: (c) => c.json({ error: 'Request too large.' }, 413) }),
);
app.use('/api/*', async (c, next) => {
  const url = new URL(c.req.url);
  if (c.env.ENVIRONMENT !== 'local' && c.env.MAINNET_FINANCIAL_ENABLED !== 'false')
    return c.json({ error: 'Invalid financial feature configuration.' }, 503);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('origin') !== url.origin)
    return c.json({ error: 'Invalid request origin.' }, 403);
  if (c.req.header('upgrade') === 'websocket' && c.req.header('origin') !== url.origin)
    return c.json({ error: 'Invalid WebSocket origin.' }, 403);
  const path = url.pathname;
  const max = path.includes('/auth/') && c.req.method !== 'GET' ? 40 : 240;
  await limit(
    c.env,
    (max === 40 ? 'auth:' : 'api:') + (c.req.header('cf-connecting-ip') || 'local'),
    max,
    max === 40 ? 900000 : 60000,
  );
  if (Number(c.req.header('content-length') || 0) > (path.includes('/media/') ? 2097152 : 16384))
    return c.json({ error: 'Request too large.' }, 413);
  const raw = getCookie(c, 'cm_session');
  c.set('sessionHash', raw ? digest(raw) : '');
  c.set('user', raw ? await member(c.env, digest(raw)) : null);
  await next();
  if (c.res.status !== 101) {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'same-origin');
    c.header('Cache-Control', 'no-store');
  }
});
app.get('/api/health', async (c) => {
  await q(c.env, 'SELECT 1').first();
  return c.json({
    ok: true,
    storage: 'D1',
    runtime: 'cloudflare',
    realtime: 'durable-objects',
    media: 'R2',
    financialNetworks: [84532, ...(c.env.ENVIRONMENT === 'local' ? [31337] : [])],
  });
});
app.route('/api/auth', auth);
app.route('/api', experience);
app.route('/api', profiles);
app.route('/api/web3', web3);
app.get('/api/leaderboard', async (c) =>
  c.json(
    (
      await q(
        c.env,
        `SELECT id,username,rating,bio,joined,avatar FROM users WHERE private=0 AND deleted=0 AND id IN (SELECT user_id FROM rating_history) ORDER BY rating DESC LIMIT 100`,
      ).all()
    ).results,
  ),
);
app.get('/api/history', async (c) => {
  const u = requireUser(c);
  return c.json(
    (
      await q(
        c.env,
        'SELECT state FROM games WHERE white=? OR black=? ORDER BY created DESC LIMIT 100',
        u.id,
        u.id,
      ).all<{ state: string }>()
    ).results.map((g) => JSON.parse(g.state)),
  );
});
const control = z
  .string()
  .max(7)
  .refine((v) => !!controlValues(v));
app.post('/api/challenges', async (c) => {
  const user = requireUser(c),
    p = z.object({ control, rated: z.boolean().default(false) }).parse(await c.req.json());
  const g = await internal(lobby(c.env), '/create', { user, ...p });
  await internal(room(c.env, g.id), '/init', g);
  return c.json(g);
});
app.post('/api/challenges/:id/join', async (c) =>
  c.json(await internal(lobby(c.env), '/join', { user: requireUser(c), id: c.req.param('id') })),
);
app.get('/api/games/:id', async (c) => {
  const u = requireUser(c),
    row = await q(c.env, 'SELECT state FROM games WHERE id=?', c.req.param('id')).first<{
      state: string;
    }>();
  if (!row) return c.notFound();
  const g: GameState = JSON.parse(row.state);
  if (![g.white, g.black].includes(u.id)) {
    const privatePlayers = await q(
      c.env,
      'SELECT id FROM users WHERE id IN (?,?) AND private=1',
      g.white,
      g.black,
    ).first<Member>();
    if (g.status !== 'waiting' && (g.status !== 'finished' || privatePlayers))
      return c.json({ error: 'This match is private.' }, 403);
  }
  await internal(room(c.env, g.id), '/init', g);
  return c.json(await internal(room(c.env, g.id), '/state', {}));
});
app.get('/api/realtime/:id', async (c) => {
  const u = requireUser(c);
  const id = c.req.param('id');
  if (c.req.header('upgrade') !== 'websocket') return c.json({ error: 'WebSocket required.' }, 426);
  const headers = new Headers(c.req.raw.headers);
  headers.set('x-user', u.id);
  headers.set('x-session', c.get('sessionHash'));
  let stub = lobby(c.env);
  if (id !== 'queue') {
    const row = await q(c.env, 'SELECT state FROM games WHERE id=?', id).first<{ state: string }>();
    if (!row) return c.notFound();
    const g: GameState = JSON.parse(row.state);
    if (![g.white, g.black].includes(u.id)) return c.json({ error: 'Not a participant.' }, 403);
    stub = room(c.env, id);
    await internal(stub, '/init', g);
  }
  return stub.fetch(new Request('https://internal/socket', { headers }));
});
app.notFound((c) => c.json({ error: 'Route not found.' }, 404));
app.onError((err, c) => {
  if (err instanceof z.ZodError) return c.json({ error: 'Please check the supplied fields.' }, 400);
  const message = err.message;
  if (/D1_|SQLITE|constraint|UNIQUE/.test(message)) {
    console.error('Database operation rejected');
    return c.json({ error: 'The request conflicts with an existing record.' }, 409);
  }
  if (/sign in/i.test(message)) return c.json({ error: message }, 401);
  if (/Too many/.test(message)) return c.json({ error: message }, 429);
  if (message.length > 200) {
    console.error('Request failed');
    return c.json({ error: 'The request could not be completed.' }, 500);
  }
  return c.json({ error: message }, 400);
});
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      Promise.all([
        internal(lobby(env), '/index', {}),
        env.DB.batch([
          q(env, 'DELETE FROM sessions WHERE expires<?', Date.now()),
          q(env, 'DELETE FROM challenges WHERE expires<?', Date.now()),
          q(env, 'DELETE FROM rate_limits WHERE until<?', Date.now()),
          q(env, 'DELETE FROM mail_outbox WHERE created<?', Date.now() - 86400000),
          q(env, 'DELETE FROM chat_messages WHERE created<?', Date.now() - 30 * 86400000),
          q(env, 'DELETE FROM chat_reports WHERE created<?', Date.now() - 90 * 86400000),
        ]),
      ]),
    );
  },
};
