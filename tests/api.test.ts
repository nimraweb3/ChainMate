import { beforeAll, afterAll, it, expect } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { database } from '../apps/api/src/db';
import { createApp } from '../apps/api/src/server';
let runtime: Awaited<ReturnType<typeof createApp>>,
  base: string,
  cookieA: string,
  cookieB: string,
  a: Socket,
  b: Socket,
  id: string;
const origin = 'http://localhost:5173';
async function req(path: string, body?: unknown, cookie?: string) {
  const r = await fetch(base + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get('set-cookie')?.split(';')[0],
  };
}
function emit(s: Socket, event: string, data: unknown) {
  return new Promise<any>((resolve, reject) =>
    s.timeout(5000).emit(event, data, (err: any, r: any) => (err ? reject(err) : resolve(r))),
  );
}
async function socket(cookie: string) {
  const s = io(base, { extraHeaders: { origin, cookie }, transports: ['websocket'] });
  await new Promise<void>((r, j) => {
    s.on('connect', r);
    s.on('connect_error', j);
  });
  return s;
}
beforeAll(async () => {
  runtime = await createApp(await database('memory://'));
  await new Promise<void>((r) => runtime.server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + (runtime.server.address() as any).port;
  const x = await req('/auth/register', {
    username: 'alice',
    email: 'alice@example.com',
    password: 'a strong password 123',
  });
  const y = await req('/auth/register', {
    username: 'bob',
    email: 'bob@example.com',
    password: 'another strong password',
  });
  cookieA = x.cookie!;
  cookieB = y.cookie!;
  a = await socket(cookieA);
  b = await socket(cookieB);
});
afterAll(async () => {
  a?.disconnect();
  b?.disconnect();
  await runtime?.close();
});
it('creates accounts, rejects bad login and blocks cross-origin writes', async () => {
  expect((await req('/auth/me', undefined, cookieA)).data.user.username).toBe('alice');
  expect((await req('/auth/login', { email: 'alice@example.com', password: 'wrong' })).status).toBe(
    401,
  );
  const r = await fetch(base + '/api/challenges', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      'content-type': 'application/json',
      cookie: cookieA,
    },
    body: '{}',
  });
  expect(r.status).toBe(403);
});
it('joins two real clients, rejects out-of-turn and duplicate moves, reconnects', async () => {
  const created = await req('/challenges', { control: '3+2', rated: true }, cookieA);
  id = created.data.id;
  expect((await req('/challenges/' + id + '/join', {}, cookieB)).data.status).toBe('active');
  await emit(a, 'game:join', { id });
  await emit(b, 'game:join', { id });
  expect((await emit(b, 'move:submit', { id, from: 'e7', to: 'e5', revision: 0 })).ok).toBe(false);
  expect((await emit(a, 'move:submit', { id, from: 'e2', to: 'e5', revision: 0 })).ok).toBe(false);
  const first = await emit(a, 'move:submit', { id, from: 'e2', to: 'e4', revision: 0 });
  expect(first.ok).toBe(true);
  expect((await emit(a, 'move:submit', { id, from: 'e2', to: 'e4', revision: 0 })).ok).toBe(false);
  expect((await emit(b, 'move:submit', { id, from: 'e7', to: 'e5', revision: 1 })).ok).toBe(true);
  a.disconnect();
  a = await socket(cookieA);
  const resumed = await emit(a, 'game:join', { id });
  expect(resumed.value.moves).toEqual(['e4', 'e5']);
  expect(resumed.value.whiteMs).toBeGreaterThan(0);
});
it('finishes once and applies ratings atomically even after repeated finish events', async () => {
  const finish = await emit(b, 'game:action', { id, action: 'resign' });
  expect(finish, JSON.stringify(finish)).toHaveProperty('value.outcome', 'white');
  await Promise.all([
    emit(a, 'game:action', { id, action: 'resign' }),
    emit(b, 'game:action', { id, action: 'resign' }),
  ]);
  const me = await req('/auth/me', undefined, cookieA);
  expect(me.data.user.rating).toBe(1216);
  const them = await req('/auth/me', undefined, cookieB);
  expect(them.data.user.rating).toBe(1184);
  expect((await req('/history', undefined, cookieA)).data[0].status).toBe('finished');
});
it('expires challenges and supports draw agreement', async () => {
  const created = await req('/challenges', { control: '1+0' }, cookieA);
  const g = await runtime.games.get(created.data.id);
  g!.expires = 0;
  await runtime.games.save(g!);
  expect((await req('/challenges/' + g!.id + '/join', {}, cookieB)).status).toBe(400);
  const c = await req('/challenges', { control: '1+0' }, cookieA);
  await req('/challenges/' + c.data.id + '/join', {}, cookieB);
  await emit(a, 'game:action', { id: c.data.id, action: 'offer' });
  expect((await emit(b, 'game:action', { id: c.data.id, action: 'accept' })).value.outcome).toBe(
    'draw',
  );
});
it('matches compatible queues without self-matching', async () => {
  expect((await emit(a, 'queue:join', { control: '5+0', rated: false })).value.waiting).toBe(true);
  expect((await emit(a, 'queue:join', { control: '5+0', rated: false })).value.waiting).toBe(true);
  const matched = await emit(b, 'queue:join', { control: '5+0', rated: false });
  expect(matched.value.status).toBe('active');
  expect(matched.value.white).not.toBe(matched.value.black);
});
