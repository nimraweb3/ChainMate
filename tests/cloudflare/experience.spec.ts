import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { boardThemes, pieceSets } from '../../packages/shared/experience';
const origin = process.env.CHAINMATE_TEST_URL || 'http://127.0.0.1:8787';
test('guest palette merges only by choice and account lessons survive reload', async ({
  browser,
}) => {
  const c = await browser.newContext({ baseURL: origin });
  const page = await c.newPage();
  await page.goto('/settings/board');
  await page.getByRole('button', { name: 'Sakura', exact: true }).click();
  await page.getByRole('button', { name: 'Apply appearance' }).click();
  await expect(page.getByRole('status').last()).toContainText('Saved');
  await register(c, 'Merge');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Preview guest palette' })).toBeVisible();
  await expect(page.locator('.atelier-board')).toHaveAttribute('data-theme', 'pearl');
  await page.getByRole('button', { name: 'Preview guest palette' }).click();
  await expect(page.locator('.atelier-board')).toHaveAttribute('data-theme', 'sakura');
  await page.getByRole('button', { name: 'Apply appearance' }).click();
  await expect(page.getByRole('status').last()).toContainText('account');
  await page.reload();
  await expect(page.locator('.atelier-board')).toHaveAttribute('data-theme', 'sakura');
  await page.goto('/learn/pieces');
  await page.getByLabel('Keyboard move').fill('d4e4');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect
    .poll(async () => (await (await c.request.get('/api/experience')).json()).progress)
    .toContain('k');
  await page.reload();
  await expect(page.getByText('1 OF 6 LESSONS COMPLETE')).toBeVisible();
  await c.close();
});
test('tap, drag, promotion, castling, en passant and flip preserve legal positions', async ({
  page,
}) => {
  await page.goto('/settings/board');
  await expect(page.getByRole('button', { name: 'Apply appearance' })).toBeEnabled();
  const square = (s: string) => page.locator(`[data-square="${s}"]`);
  await square('e2').click();
  await square('e4').click();
  await expect(square('e4').locator('[data-piece="wP"]')).toHaveCount(1);
  await square('e7').scrollIntoViewIfNeeded();
  const from = await square('e7').boundingBox(),
    to = await square('e5').boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 12, from!.y + from!.height / 2, { steps: 3 });
  await page.waitForTimeout(200);
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect(square('e5').locator('[data-piece="bP"]')).toHaveCount(1);
  await page.getByText('Explore special moves', { exact: true }).click();
  await page.getByLabel('Practice position').selectOption({ label: 'Promotion' });
  await square('a7').click();
  await square('a8').click();
  await page.getByRole('button', { name: 'Knight', exact: true }).click();
  await expect(square('a8').locator('[data-piece="wN"]')).toHaveCount(1);
  await page.getByLabel('Practice position').selectOption({ label: 'Castling' });
  await page.getByLabel('Keyboard move').fill('e1g1');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(square('f1').locator('[data-piece="wR"]')).toHaveCount(1);
  await page.getByLabel('Practice position').selectOption({ label: 'En passant' });
  await square('e5').click();
  await square('d6').click();
  await expect(square('d5').locator('[data-piece]')).toHaveCount(0);
  await expect(square('d6').locator('[data-piece="wP"]')).toHaveCount(1);
  const fen = await page.locator('.atelier-board').getAttribute('data-fen');
  await page.getByRole('button', { name: 'Flip preview' }).click();
  await expect(page.locator('.atelier-board')).toHaveAttribute('data-fen', fen!);
});
async function register(c: BrowserContext, prefix: string) {
  const username = prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const r = await c.request.post(origin + '/api/auth/register', {
    headers: { origin },
    data: { username, email: username + '@example.com', password: 'experience test password 123' },
  });
  expect(r.status()).toBe(201);
  return (await (await c.request.get(origin + '/api/auth/me')).json()).user;
}
async function wire(p: Page, id: string) {
  await p.evaluate(async (id) => {
    const ws = new WebSocket(location.origin.replace('http', 'ws') + '/api/realtime/' + id);
    (window as any).chatSocket = ws;
    let seq = 0;
    (window as any).chatRpc = (event: string, payload: any) =>
      new Promise((resolve) => {
        const n = ++seq;
        const listener = (e: MessageEvent) => {
          const r = JSON.parse(e.data);
          if (r.ack === n) {
            ws.removeEventListener('message', listener);
            resolve(r);
          }
        };
        ws.addEventListener('message', listener);
        ws.send(JSON.stringify({ id: n, event, payload }));
      });
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(Error('Socket failed'));
    });
  }, id);
}
const rpc = (p: Page, event: string, payload: any = {}) =>
  p.evaluate(([event, payload]) => (window as any).chatRpc(event, payload), [event, payload]);
test('all sixteen boards, eight piece sets, guest persistence, colors and responsive Studio', async ({
  page,
}) => {
  await page.goto('/settings/board');
  await expect(page.getByRole('button', { name: 'Apply appearance' })).toBeEnabled();
  const board = page.locator('.atelier-board');
  await page.getByLabel('Keyboard move').fill('e2e4');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const fen = await board.getAttribute('data-fen');
  for (const theme of boardThemes) {
    await page.getByRole('button', { name: theme.name, exact: true }).click();
    await expect(board).toHaveAttribute('data-theme', theme.id);
    await expect(board).toHaveAttribute('data-fen', fen!);
  }
  await page.getByRole('button', { name: 'Pieces', exact: true }).click();
  for (const set of pieceSets) {
    await page.getByRole('button', { name: set.name, exact: true }).click();
    await expect(board.locator('svg.collection-' + set.id)).toHaveCount(32);
  }
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await page.getByLabel('Custom square colors').check();
  await page.getByLabel('Light squares', { exact: true }).fill('#eeeecc');
  await page.getByLabel('Dark squares', { exact: true }).fill('#58756c');
  await page.getByRole('button', { name: 'Apply appearance' }).click();
  await expect(page.getByRole('status').last()).toContainText('Saved');
  await page.reload();
  await expect(board).toHaveAttribute('data-pieces', 'cyber');
  for (const width of [320, 390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `.local/experience-studio-${width}.png`, fullPage: true });
  }
});
test('six legal piece exercises and guest progress', async ({ page }) => {
  await page.goto('/learn/pieces');
  const lessons = [
    ['King', 'd4e4'],
    ['Queen', 'd4g7'],
    ['Rook', 'd4d7'],
    ['Bishop', 'd4g7'],
    ['Knight', 'd4f5'],
    ['Pawn', 'd4e5'],
  ];
  for (const [name, move] of lessons) {
    await page.getByRole('button', { name: name + ' lesson', exact: true }).click();
    await page.getByLabel('Keyboard move').fill('d4d6');
    if (name === 'King') {
      await page.getByRole('button', { name: 'Move', exact: true }).click();
      await expect(page.locator('.atelier-board')).toHaveAttribute('data-fen', /3K4/);
    }
    await page.getByLabel('Keyboard move').fill(move);
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.getByRole('status').last()).toContainText('Lesson complete');
  }
  await page.reload();
  await expect(page.getByText('6 OF 6 LESSONS COMPLETE')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/experience-learn-mobile.png', fullPage: true });
});
test('real chat, duplicate protection, privacy, moderation, reconnect and live appearance isolation', async ({
  browser,
}) => {
  const a = await browser.newContext({ baseURL: origin }),
    b = await browser.newContext({ baseURL: origin }),
    outsider = await browser.newContext({ baseURL: origin });
  await register(a, 'ChatA');
  await register(b, 'ChatB');
  await register(outsider, 'Other');
  const g = await (
    await a.request.post('/api/challenges', {
      headers: { origin },
      data: { control: '10+0', rated: false },
    })
  ).json();
  await b.request.post('/api/challenges/' + g.id + '/join', { headers: { origin }, data: {} });
  const pa = await a.newPage(),
    pb = await b.newPage();
  await pa.goto('/game/' + g.id);
  await pb.goto('/game/' + g.id);
  await pa.getByRole('button', { name: 'Chat', exact: true }).click();
  await pb.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(pa.getByLabel('Message your opponent')).toBeEnabled();
  await pa.getByLabel('Message your opponent').fill('Hello from a real player');
  await pa.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(pb.getByText('Hello from a real player', { exact: true })).toBeVisible();
  await pb.getByRole('button', { name: 'Quick chat', exact: true }).click();
  await pb.getByRole('button', { name: 'Good luck!', exact: true }).click();
  await expect(pa.getByText('Good luck!', { exact: true })).toBeVisible();
  await pa.getByRole('button', { name: 'Emoji', exact: true }).click();
  await pa.getByRole('button', { name: 'clap reaction' }).click();
  await expect(pb.locator('.chat-bubble.reaction')).toContainText('👏');
  await pb.reload();
  await pb.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(pb.getByText('Hello from a real player', { exact: true })).toBeVisible();
  await wire(pa, g.id);
  const key = crypto.randomUUID();
  const payload = { clientMessageId: key, text: 'Idempotent message' };
  const first = await rpc(pa, 'chat:send', payload),
    again = await rpc(pa, 'chat:send', payload);
  expect(first.ok).toBe(true);
  expect(again.value.id).toBe(first.value.id);
  expect(
    (
      await rpc(pa, 'chat:send', {
        clientMessageId: crypto.randomUUID(),
        text: 'https://malicious.example',
      })
    ).ok,
  ).toBe(false);
  expect((await outsider.request.get('/api/games/' + g.id)).status()).toBe(403);
  await pa.getByRole('button', { name: 'Appearance', exact: true }).click();
  const before = await pa.locator('.atelier-board').getAttribute('data-fen');
  await pa.getByRole('button', { name: 'Ocean Glass', exact: true }).click();
  await expect(pa.locator('.atelier-board')).toHaveAttribute('data-theme', 'ocean');
  await expect(pb.locator('.atelier-board')).toHaveAttribute('data-theme', 'pearl');
  await expect(pa.locator('.atelier-board')).toHaveAttribute('data-fen', before!);
  await pa.getByLabel('Keyboard move').fill('e2e4');
  await pa.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(pb.locator('.atelier-board')).not.toHaveAttribute('data-fen', before!);
  await expect
    .poll(
      async () => (await (await a.request.get('/api/experience')).json()).appearance?.boardThemeId,
    )
    .toBe('ocean');
  await b.request.post('/api/chat/control', {
    headers: { origin },
    data: {
      gameId: g.id,
      action: 'report',
      messageId: first.value.id,
      reason: 'Testing report persistence',
    },
  });
  await b.request.post('/api/chat/control', {
    headers: { origin },
    data: { gameId: g.id, action: 'mute' },
  });
  expect(
    (await rpc(pa, 'chat:send', { clientMessageId: crypto.randomUUID(), text: 'Muted message' }))
      .ok,
  ).toBe(false);
  await b.request.post('/api/chat/control', {
    headers: { origin },
    data: { gameId: g.id, action: 'unmute' },
  });
  await b.request.post('/api/chat/control', {
    headers: { origin },
    data: { gameId: g.id, action: 'block' },
  });
  expect((await rpc(pa, 'chat:history')).value.messages).toHaveLength(0);
  await b.request.post('/api/chat/control', {
    headers: { origin },
    data: { gameId: g.id, action: 'unblock' },
  });
  await b.request.patch('/api/experience', {
    headers: { origin },
    data: { chat: { visibility: 'nobody' } },
  });
  expect(
    (await rpc(pa, 'chat:send', { clientMessageId: crypto.randomUUID(), text: 'Private message' }))
      .ok,
  ).toBe(false);
  await pb.setViewportSize({ width: 390, height: 844 });
  expect(await pb.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await pb.screenshot({ path: '.local/experience-chat-mobile.png', fullPage: true });
  await pa.setViewportSize({ width: 1366, height: 900 });
  await pa.getByRole('button', { name: 'Moves', exact: true }).click();
  await pa.screenshot({ path: '.local/experience-game-desktop.png', fullPage: true });
  await a.close();
  await b.close();
  await outsider.close();
});
test('chat request and mutual-friend gates, spoofing, flood limits, and custom clocks', async ({
  browser,
}) => {
  const a = await browser.newContext({ baseURL: origin }),
    b = await browser.newContext({ baseURL: origin }),
    anon = await browser.newContext({ baseURL: origin });
  await register(a, 'GateA');
  await register(b, 'GateB');
  const create = await a.request.post('/api/challenges', {
    headers: { origin },
    data: { control: '12+7', rated: false },
  });
  expect(create.ok()).toBe(true);
  const g = await create.json();
  expect(g.whiteMs).toBe(720000);
  expect(g.increment).toBe(7);
  await b.request.post('/api/challenges/' + g.id + '/join', { headers: { origin }, data: {} });
  expect((await anon.request.get('/api/realtime/' + g.id)).status()).toBe(401);
  const pa = await a.newPage();
  await pa.goto('/game/' + g.id);
  await wire(pa, g.id);
  await b.request.patch('/api/experience', {
    headers: { origin },
    data: { chat: { visibility: 'requests' } },
  });
  expect(
    (await rpc(pa, 'chat:send', { clientMessageId: crypto.randomUUID(), text: 'Before consent' }))
      .ok,
  ).toBe(false);
  await b.request.post('/api/chat/control', {
    headers: { origin },
    data: { gameId: g.id, action: 'accept' },
  });
  const accepted = await rpc(pa, 'chat:send', {
    clientMessageId: crypto.randomUUID(),
    text: 'After consent',
    senderId: 'forged',
  });
  expect(accepted.ok).toBe(true);
  expect(accepted.value.senderId).not.toBe('forged');
  await b.request.patch('/api/experience', {
    headers: { origin },
    data: { chat: { visibility: 'friends' } },
  });
  expect((await rpc(pa, 'chat:history')).value.eligible).toBe(false);
  for (const c of [a, b])
    await c.request.post('/api/chat/control', {
      headers: { origin },
      data: { gameId: g.id, action: 'friend' },
    });
  expect((await rpc(pa, 'chat:history')).value.eligible).toBe(true);
  const markup = '<img src=x onerror="window.pwned=true">';
  const sent = await rpc(pa, 'chat:send', { clientMessageId: crypto.randomUUID(), text: markup });
  expect(sent.ok).toBe(true);
  await pa.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(pa.getByText(markup, { exact: true })).toBeVisible();
  expect(await pa.evaluate(() => (window as any).pwned)).toBeUndefined();
  const flood = [];
  for (let n = 0; n < 8; n++)
    flood.push(
      await rpc(pa, 'chat:send', { clientMessageId: crypto.randomUUID(), text: 'Flood ' + n }),
    );
  expect(flood.some((r) => !r.ok && r.error.includes('Too many'))).toBe(true);
  const state = await (await a.request.get('/api/games/' + g.id)).json();
  expect(state.moves).toHaveLength(0);
  expect(state.status).toBe('active');
  await a.close();
  await b.close();
  await anon.close();
});
