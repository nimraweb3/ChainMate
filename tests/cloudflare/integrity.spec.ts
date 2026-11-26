import { test, expect, type BrowserContext, type Page } from '@playwright/test';
const origin = 'http://127.0.0.1:8787';
async function register(context: BrowserContext, name: string) {
  const id = Date.now() + Math.random().toString(36).slice(2, 6);
  const r = await context.request.post(origin + '/api/auth/register', {
    headers: { origin },
    data: {
      username: name + id,
      email: name + id + '@example.com',
      password: 'a secure integrity test password',
    },
  });
  expect(r.status()).toBe(201);
  return (await (await context.request.get(origin + '/api/auth/me')).json()).user;
}
async function socket(page: Page, id: string) {
  await page.goto('/');
  await page.evaluate(async (id) => {
    const ws = new WebSocket(location.origin.replace('http', 'ws') + '/api/realtime/' + id);
    (window as any).room = ws;
    (window as any).seq = 0;
    (window as any).rpc = (event: string, payload: any) =>
      new Promise((resolve) => {
        const n = ++(window as any).seq;
        const handler = (e: MessageEvent) => {
          const p = JSON.parse(e.data);
          if (p.ack === n) {
            ws.removeEventListener('message', handler);
            resolve(p);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: n, event, payload }));
      });
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(Error('Socket connection failed'));
    });
  }, id);
}
const rpc = (page: Page, event: string, payload: any) =>
  page.evaluate(([event, payload]) => (window as any).rpc(event, payload), [event, payload]);
test('Durable Object rejects duplicate/illegal moves and applies rated results once', async ({
  browser,
}) => {
  const ca = await browser.newContext({ baseURL: origin }),
    cb = await browser.newContext({ baseURL: origin });
  const a = await register(ca, 'White'),
    b = await register(cb, 'Black');
  const r = await ca.request.post(origin + '/api/challenges', {
    headers: { origin },
    data: { control: '3+2', rated: true },
  });
  const created = await r.json();
  const joined = await cb.request.post(origin + '/api/challenges/' + created.id + '/join', {
    headers: { origin },
    data: {},
  });
  expect(joined.ok()).toBe(true);
  const g = await joined.json();
  const pa = await ca.newPage(),
    pb = await cb.newPage();
  await socket(pa, g.id);
  await socket(pb, g.id);
  const legal = { id: g.id, from: 'e2', to: 'e4', promotion: 'q', revision: g.revision };
  expect((await rpc(pb, 'move:submit', legal)).ok).toBe(false);
  expect((await rpc(pa, 'move:submit', { ...legal, to: 'e5' })).ok).toBe(false);
  expect((await rpc(pa, 'move:submit', legal)).ok).toBe(true);
  expect((await rpc(pa, 'move:submit', legal)).ok).toBe(false);
  await rpc(pb, 'game:action', { id: g.id, action: 'resign' });
  await rpc(pb, 'game:action', { id: g.id, action: 'resign' });
  const ua = (await (await ca.request.get(origin + '/api/auth/me')).json()).user,
    ub = (await (await cb.request.get(origin + '/api/auth/me')).json()).user;
  expect(ua.rating - a.rating).toBe(16);
  expect(b.rating - ub.rating).toBe(16);
  const profile = await (await ca.request.get(origin + '/api/profile/' + a.username)).json();
  expect(profile.ratings[0].games).toBe(1);
  expect(profile.achievements.length).toBe(2);
  await ca.close();
  await cb.close();
});
test('clock alarm completes an idle game without clock polling', async ({ browser }) => {
  test.setTimeout(110000);
  const ca = await browser.newContext({ baseURL: origin }),
    cb = await browser.newContext({ baseURL: origin });
  await register(ca, 'ClockA');
  await register(cb, 'ClockB');
  const created = await (
    await ca.request.post(origin + '/api/challenges', {
      headers: { origin },
      data: { control: '1+0', rated: false },
    })
  ).json();
  const joined = await cb.request.post(origin + '/api/challenges/' + created.id + '/join', {
    headers: { origin },
    data: {},
  });
  expect(joined.ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const history = await (await ca.request.get(origin + '/api/history')).json();
        return history.find((g: any) => g.id === created.id)?.reason;
      },
      { timeout: 80000, intervals: [3000, 10000] },
    )
    .toBe('Time expired');
  await ca.close();
  await cb.close();
});
test('queued players find one another without duplicate active matches', async ({ browser }) => {
  const ca = await browser.newContext({ baseURL: origin }),
    cb = await browser.newContext({ baseURL: origin });
  await register(ca, 'QueueA');
  await register(cb, 'QueueB');
  const a = await ca.newPage(),
    b = await cb.newPage();
  await a.goto('/play/online');
  await b.goto('/play/online');
  await a.getByRole('button', { name: 'Find a match' }).click();
  await b.getByRole('button', { name: 'Find a match' }).click();
  await expect(a).toHaveURL(/\/game\//);
  await expect(b).toHaveURL(a.url());
  const duplicate = await ca.request.post(origin + '/api/challenges', {
    headers: { origin },
    data: { control: '10+0', rated: false },
  });
  expect(duplicate.ok()).toBe(false);
  await a.getByRole('button', { name: 'Resign', exact: true }).click();
  await a.getByRole('button', { name: 'Confirm resignation' }).click();
  await ca.close();
  await cb.close();
});
