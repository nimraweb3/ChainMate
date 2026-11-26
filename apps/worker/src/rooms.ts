import { DurableObject } from 'cloudflare:workers';
import { Chess } from 'chess.js';
import { controlValues, type Control, type GameState } from '../../../packages/shared/types';
import { elo, move, tick, position } from '../../../packages/game-core';
import { type Env, type Member, statement as q, room, lobby, internal } from './env';
import { member } from './auth';
import { indexEvents } from './web3';
import { chatEvent } from './chat';
type Attachment = { user: string; sessionHash: string; requests: number; window: number };
const json = (v: unknown, status = 200) => Response.json(v, { status });
function send(ws: WebSocket, event: string, value: unknown) {
  try {
    ws.send(JSON.stringify({ event, value }));
  } catch {}
}
async function authorize(env: Env, ws: WebSocket) {
  const a = ws.deserializeAttachment() as Attachment;
  if (!a) throw Error('Unauthorized.');
  const now = Date.now();
  if (now - a.window > 1000) {
    a.requests = 0;
    a.window = now;
  }
  if (++a.requests > 20) throw Error('Too many messages.');
  ws.serializeAttachment(a);
  const u = await member(env, a.sessionHash);
  if (!u || u.id !== a.user) {
    ws.close(1008, 'Session expired');
    throw Error('Session expired.');
  }
  return u;
}
function attach(ctx: DurableObjectState, req: Request) {
  const pair = new WebSocketPair();
  const a: Attachment = {
    user: req.headers.get('x-user')!,
    sessionHash: req.headers.get('x-session')!,
    requests: 0,
    window: Date.now(),
  };
  ctx.acceptWebSocket(pair[1], [a.user]);
  pair[1].serializeAttachment(a);
  return pair;
}
class SerialObject extends DurableObject<Env> {
  private tail: Promise<unknown> = Promise.resolve();
  serial<T>(fn: () => Promise<T>) {
    const p = this.tail.then(fn);
    this.tail = p.catch(() => {});
    return p;
  }
}
export class GameRoom extends SerialObject {
  private async load() {
    let g = await this.ctx.storage.get<GameState>('game');
    if (!g) {
      const id = await this.ctx.storage.get<string>('id');
      if (id) {
        const row = await q(this.env, 'SELECT state FROM games WHERE id=?', id).first<{
          state: string;
        }>();
        if (row) g = JSON.parse(row.state);
      }
    }
    if (!g) throw Error('Game not found.');
    const deleted = (
      await q(
        this.env,
        'SELECT id FROM users WHERE deleted=1 AND id IN (?,?)',
        g.white,
        g.black,
      ).all<{ id: string }>()
    ).results;
    for (const user of deleted) {
      if (user.id === g.white) g.whiteName = 'Deleted player';
      if (user.id === g.black) g.blackName = 'Deleted player';
    }
    return g;
  }
  private async persist(g: GameState) {
    await this.ctx.storage.put({ game: g, dirty: true });
    await this.ctx.storage.setAlarm(Date.now() + 5000);
    await this.project(g);
    await this.schedule(g);
  }
  private async project(g: GameState) {
    await q(
      this.env,
      'UPDATE games SET state=?,status=?,black=?,revision=? WHERE id=? AND revision<=?',
      JSON.stringify(g),
      g.status,
      g.black,
      g.revision,
      g.id,
      g.revision,
    ).run();
    if (g.moves.length)
      await q(
        this.env,
        'INSERT OR IGNORE INTO moves VALUES(?,?,?,?,?)',
        g.id,
        g.moves.length,
        g.moves.at(-1),
        g.fen,
        Date.now(),
      ).run();
    if (g.status === 'finished') await internal(lobby(this.env), '/finish', { game: g });
    await this.ctx.storage.put('dirty', false);
  }
  private async schedule(g: GameState) {
    if (g.status === 'active') {
      const ms = position(g).turn() === 'w' ? g.whiteMs : g.blackMs;
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, g.lastTick + ms));
    } else if (g.status === 'waiting')
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, g.expires));
    else await this.ctx.storage.deleteAlarm();
  }
  private broadcast(g: GameState) {
    for (const ws of this.ctx.getWebSockets()) send(ws, 'game:state', g);
  }
  private presence(exclude?: WebSocket) {
    const sockets = this.ctx.getWebSockets().filter((ws) => ws !== exclude);
    const users = [
      ...new Set(
        sockets.map((ws) => (ws.deserializeAttachment() as Attachment)?.user).filter(Boolean),
      ),
    ];
    for (const ws of sockets) send(ws, 'game:presence', users);
  }
  async fetch(req: Request) {
    return this.serial(async () => {
      try {
        const url = new URL(req.url);
        if (url.pathname === '/init') {
          const g = await req.json<GameState>();
          const old = await this.ctx.storage.get<GameState>('game');
          if (!old) {
            await this.ctx.storage.put({ id: g.id, game: g });
            await this.schedule(g);
          }
          return json(old || g);
        }
        const g = await this.load();
        if (url.pathname === '/join') {
          const u = await req.json<Member>();
          if (g.white === u.id || g.black === u.id) return json(g);
          if (g.status !== 'waiting' || g.expires < Date.now() || g.chainMatch)
            throw Error('Challenge is full or expired.');
          g.black = u.id;
          g.blackName = u.username;
          g.status = 'active';
          g.lastTick = Date.now();
          g.revision++;
          await this.persist(g);
          this.broadcast(g);
          return json(g);
        }
        if (req.headers.get('Upgrade') === 'websocket') {
          const user = req.headers.get('x-user');
          if (![g.white, g.black].includes(user)) return json({ error: 'Not a participant.' }, 403);
          tick(g, Date.now());
          await this.persist(g);
          const pair = attach(this.ctx, req);
          this.presence();
          send(pair[1], 'game:state', g);
          return new Response(null, { status: 101, webSocket: pair[0] });
        }
        tick(g, Date.now());
        await this.persist(g);
        return json(g);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
    });
  }
  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    return this.serial(async () => {
      let packet: any;
      try {
        if (typeof data !== 'string' || data.length > 4096) throw Error('Invalid message.');
        packet = JSON.parse(data);
        const u = await authorize(this.env, ws),
          g = await this.load(),
          p = packet.payload || {};
        if (![g.white, g.black].includes(u.id)) throw Error('Not a participant.');
        if (String(packet.event).startsWith('chat:')) {
          const value = await chatEvent(this.env, g, u, packet.event, p, this.ctx.getWebSockets());
          ws.send(JSON.stringify({ ack: packet.id, ok: true, value }));
          return;
        }
        if (packet.event === 'game:join') {
          tick(g, Date.now());
          await this.persist(g);
          send(ws, 'game:state', g);
        } else if (packet.event === 'move:submit') {
          if (
            !/^[a-h][1-8]$/.test(p.from) ||
            !/^[a-h][1-8]$/.test(p.to) ||
            !['q', 'r', 'b', 'n'].includes(p.promotion || 'q')
          )
            throw Error('Invalid move.');
          move(g, u.id, p.from, p.to, p.promotion || 'q', p.revision, Date.now());
          await this.persist(g);
          this.broadcast(g);
        } else if (packet.event === 'game:action') {
          tick(g, Date.now());
          if (g.status === 'active') {
            if (p.action === 'resign') {
              g.status = 'finished';
              g.outcome = g.white === u.id ? 'black' : 'white';
              g.reason = 'Resignation';
            } else if (p.action === 'offer') g.drawOffer = u.id;
            else if (p.action === 'accept' && g.drawOffer && g.drawOffer !== u.id) {
              g.status = 'finished';
              g.outcome = 'draw';
              g.reason = 'Draw by agreement';
            } else if (p.action === 'decline') g.drawOffer = null;
            else throw Error('No valid draw offer.');
            g.revision++;
          }
          await this.persist(g);
          this.broadcast(g);
        } else throw Error('Unsupported event.');
        ws.send(JSON.stringify({ ack: packet.id, ok: true, value: g }));
      } catch (e) {
        try {
          ws.send(JSON.stringify({ ack: packet?.id, ok: false, error: (e as Error).message }));
        } catch {}
      }
    });
  }
  async alarm() {
    return this.serial(async () => {
      const g = await this.load();
      tick(g, Date.now());
      if (g.status === 'waiting' && g.expires <= Date.now()) {
        g.status = 'finished';
        g.reason = 'Unjoined challenge expired';
        g.outcome = 'draw';
        g.rated = false;
        g.revision++;
      }
      try {
        await this.persist(g);
        this.broadcast(g);
      } catch {
        await this.ctx.storage.setAlarm(Date.now() + 5000);
      }
    });
  }
  webSocketClose(ws: WebSocket) {
    this.presence(ws);
    try {
      ws.close();
    } catch {}
  }
  webSocketError(ws: WebSocket) {
    this.presence(ws);
    try {
      ws.close(1011, 'Connection error');
    } catch {}
  }
}
type Queued = { user: Member; control: Control; rated: boolean; at: number };
export class Lobby extends SerialObject {
  private async create(
    u: Member,
    control: Control,
    rated: boolean,
    black?: Member,
    chainMatch?: string,
  ) {
    const timing = controlValues(control);
    if (!timing) throw Error('Invalid time control.');
    const g: GameState = {
      id: chainMatch ? 'chain-' + chainMatch : crypto.randomUUID(),
      white: u.id,
      black: black?.id || null,
      whiteName: u.username,
      blackName: black?.username || 'Waiting for a rival',
      fen: new Chess().fen(),
      pgn: '',
      moves: [],
      revision: 0,
      status: black ? 'active' : 'waiting',
      outcome: null,
      reason: null,
      whiteMs: timing[0] * 1000,
      blackMs: timing[0] * 1000,
      lastTick: black ? Date.now() : 0,
      increment: timing[1],
      control,
      rated,
      drawOffer: null,
      created: Date.now(),
      expires: Date.now() + 900000,
      ...(chainMatch ? { chainMatch } : {}),
    };
    if (chainMatch) {
      const existing = await q(
        this.env,
        'SELECT state FROM games WHERE chain_match=?',
        chainMatch,
      ).first<{ state: string }>();
      if (existing) return JSON.parse(existing.state);
    }
    const ids = [u.id, ...(black ? [black.id] : [])];
    for (const id of ids) {
      const active = await q(
        this.env,
        'SELECT game_id FROM active_players WHERE user_id=?',
        id,
      ).first<{ game_id: string }>();
      if (active) throw Error('Finish your current game before starting another.');
    }
    await this.env.DB.batch([
      q(
        this.env,
        'INSERT INTO games(id,state,white,black,status,created,chain_match) VALUES(?,?,?,?,?,?,?)',
        g.id,
        JSON.stringify(g),
        g.white,
        g.black,
        g.status,
        g.created,
        chainMatch || null,
      ),
      ...ids.map((id) => q(this.env, 'INSERT INTO active_players VALUES(?,?)', id, g.id)),
    ]);
    return g;
  }
  private async finish(g: GameState) {
    const row = await q(this.env, 'SELECT rated_applied FROM games WHERE id=?', g.id).first<{
      rated_applied: number;
    }>();
    if (!row) throw Error('Game not found.');
    const batch: D1PreparedStatement[] = [
      q(this.env, 'DELETE FROM active_players WHERE game_id=?', g.id),
    ];
    if (!row.rated_applied && g.black && g.status === 'finished') {
      if (g.rated) {
        const users = (
          await q(this.env, 'SELECT id,rating FROM users WHERE id IN (?,?)', g.white, g.black).all<{
            id: string;
            rating: number;
          }>()
        ).results;
        const w = users.find((x) => x.id === g.white)!,
          b = users.find((x) => x.id === g.black)!;
        const score = g.outcome === 'white' ? 1 : g.outcome === 'draw' ? 0.5 : 0;
        const [wr, br] = elo(w.rating, b.rating, score);
        batch.push(
          q(
            this.env,
            'UPDATE users SET rating=CASE WHEN id=? THEN ? ELSE ? END WHERE id IN (?,?)',
            g.white,
            wr,
            br,
            g.white,
            g.black,
          ),
        );
        const duration = (controlValues(g.control)?.[0] || 600) + 40 * g.increment;
        const category = duration < 180 ? 'bullet' : duration < 600 ? 'blitz' : 'rapid';
        const rs = (
          await q(
            this.env,
            'SELECT user_id,rating FROM ratings WHERE category=? AND user_id IN (?,?)',
            category,
            g.white,
            g.black,
          ).all<{ user_id: string; rating: number }>()
        ).results;
        const a = rs.find((x) => x.user_id === g.white)?.rating || 1200,
          bb = rs.find((x) => x.user_id === g.black)?.rating || 1200;
        const next = elo(a, bb, score);
        for (const [i, id] of [g.white, g.black].entries()) {
          batch.push(
            q(
              this.env,
              'INSERT INTO ratings VALUES(?,?,?,1) ON CONFLICT(user_id,category) DO UPDATE SET rating=excluded.rating,games=games+1',
              id,
              category,
              next[i],
            ),
            q(
              this.env,
              'INSERT OR IGNORE INTO rating_history VALUES(?,?,?,?,?,?)',
              g.id,
              id,
              category,
              i === 0 ? a : bb,
              next[i],
              Date.now(),
            ),
          );
        }
      }
      batch.push(q(this.env, 'UPDATE games SET rated_applied=1 WHERE id=?', g.id));
      for (const id of [g.white, g.black]) {
        batch.push(
          q(
            this.env,
            'INSERT OR IGNORE INTO user_achievements(user_id,achievement_id,game_id,earned) VALUES(?,?,?,?)',
            id,
            'first_game',
            g.id,
            Date.now(),
          ),
        );
        if ((g.outcome === 'white' && id === g.white) || (g.outcome === 'black' && id === g.black))
          batch.push(
            q(
              this.env,
              'INSERT OR IGNORE INTO user_achievements(user_id,achievement_id,game_id,earned) VALUES(?,?,?,?)',
              id,
              'first_win',
              g.id,
              Date.now(),
            ),
          );
      }
    }
    await this.env.DB.batch(batch);
    return { ok: true };
  }
  async fetch(req: Request) {
    return this.serial(async () => {
      try {
        if (req.headers.get('Upgrade') === 'websocket') {
          const pair = attach(this.ctx, req);
          return new Response(null, { status: 101, webSocket: pair[0] });
        }
        const p = await req.json<any>();
        const path = new URL(req.url).pathname;
        if (path === '/index') {
          await indexEvents(this.env);
          return json({ ok: true });
        }
        if (path === '/finish') return json(await this.finish(p.game));
        if (path === '/create')
          return json(await this.create(p.user, p.control, p.rated, p.black, p.chainMatch));
        if (path === '/join') {
          const row = await q(this.env, 'SELECT state FROM games WHERE id=?', p.id).first<{
            state: string;
          }>();
          if (!row) throw Error('Challenge not found.');
          const g: GameState = JSON.parse(row.state);
          if ([g.white, g.black].includes(p.user.id)) return json(g);
          if (g.status !== 'waiting' || g.expires < Date.now() || g.chainMatch)
            throw Error('Challenge is unavailable.');
          await q(this.env, 'INSERT INTO active_players VALUES(?,?)', p.user.id, p.id).run();
          try {
            await internal(room(this.env, g.id), '/init', g);
            return json(await internal(room(this.env, g.id), '/join', p.user));
          } catch (e) {
            await q(
              this.env,
              'DELETE FROM active_players WHERE user_id=? AND game_id=?',
              p.user.id,
              p.id,
            ).run();
            throw e;
          }
        }
        throw Error('Unknown operation.');
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
    });
  }
  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    return this.serial(async () => {
      let p: any;
      try {
        if (typeof data !== 'string' || data.length > 4096) throw Error('Invalid message.');
        p = JSON.parse(data);
        const u = await authorize(this.env, ws);
        if (p.event === 'queue:leave') await this.ctx.storage.delete('q:' + u.id);
        else if (p.event === 'queue:join') {
          const control = p.payload.control as Control;
          if (!controlValues(control) || typeof p.payload.rated !== 'boolean')
            throw Error('Invalid queue.');
          if (await q(this.env, 'SELECT 1 FROM active_players WHERE user_id=?', u.id).first())
            throw Error('Finish your current game first.');
          const entry: Queued = { user: u, control, rated: p.payload.rated, at: Date.now() };
          const all = await this.ctx.storage.list<Queued>({ prefix: 'q:' });
          const rival = [...all.values()].find(
            (x) =>
              x.user.id !== u.id &&
              x.control === control &&
              x.rated === entry.rated &&
              Date.now() - x.at < 120000 &&
              this.ctx.getWebSockets(x.user.id).length &&
              (!entry.rated ||
                Math.abs(u.rating - x.user.rating) <=
                  200 + Math.floor((Date.now() - x.at) / 1000) * 10),
          );
          if (rival) {
            const g = await this.create(rival.user, control, entry.rated, u);
            await this.ctx.storage.delete(['q:' + u.id, 'q:' + rival.user.id]);
            await internal(room(this.env, g.id), '/init', g);
            for (const id of [u.id, rival.user.id])
              for (const s of this.ctx.getWebSockets(id)) send(s, 'match:found', g);
          } else {
            await this.ctx.storage.put('q:' + u.id, entry);
            await this.ctx.storage.setAlarm(Date.now() + 120000);
          }
        } else throw Error('Unknown event.');
        ws.send(JSON.stringify({ ack: p.id, ok: true }));
      } catch (e) {
        try {
          ws.send(JSON.stringify({ ack: p?.id, ok: false, error: (e as Error).message }));
        } catch {}
      }
    });
  }
  async alarm() {
    const entries = await this.ctx.storage.list<Queued>({ prefix: 'q:' });
    for (const [key, v] of entries)
      if (Date.now() - v.at >= 120000) {
        await this.ctx.storage.delete(key);
        for (const s of this.ctx.getWebSockets(v.user.id)) send(s, 'queue:expired', {});
      }
    if ((await this.ctx.storage.list({ prefix: 'q:' })).size)
      await this.ctx.storage.setAlarm(Date.now() + 120000);
  }
  webSocketClose(ws: WebSocket) {
    try {
      ws.close();
    } catch {}
  }
  webSocketError(ws: WebSocket) {
    try {
      ws.close(1011, 'Connection error');
    } catch {}
  }
}
