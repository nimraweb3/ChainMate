import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile),
  origin = 'http://127.0.0.1:8787';
async function mail(user: string, purpose: 'reset' | 'verify') {
  if (!/^[a-f0-9-]{36}$/.test(user)) throw Error('Invalid fixture ID');
  const { stdout } = await exec(process.execPath, [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'execute',
    'chainmate-local',
    '--local',
    '--json',
    '--command',
    `SELECT url FROM mail_outbox WHERE user_id='${user}' AND purpose='${purpose}' ORDER BY created DESC LIMIT 1`,
  ]);
  return new URL(JSON.parse(stdout)[0].results[0].url);
}
test('development email verification, one-time reset, session revocation and account deletion', async ({
  request,
}) => {
  test.setTimeout(180000);
  const n = Date.now(),
    email = `recovery${n}@example.com`,
    password = 'a long recovery test password';
  const registration = await request.post('/api/auth/register', {
    headers: { origin },
    data: { username: 'Recover' + n, email, password },
  });
  expect(registration.status()).toBe(201);
  const u = (await (await request.get('/api/auth/me')).json()).user;
  expect(
    (await request.post('/api/auth/verification', { headers: { origin }, data: {} })).ok(),
  ).toBe(true);
  const verification = await mail(u.id, 'verify');
  expect(
    (
      await request.post('/api/auth/verify', {
        headers: { origin },
        data: { token: verification.searchParams.get('verify') },
      })
    ).ok(),
  ).toBe(true);
  expect((await (await request.get('/api/auth/me')).json()).user.email_verified).toBe(1);
  expect(
    (await request.post('/api/auth/forgot', { headers: { origin }, data: { email } })).ok(),
  ).toBe(true);
  const reset = await mail(u.id, 'reset'),
    next = 'a changed recovery test password';
  expect(
    (
      await request.post('/api/auth/reset', {
        headers: { origin },
        data: { token: reset.searchParams.get('reset'), password: next },
      })
    ).ok(),
  ).toBe(true);
  expect((await (await request.get('/api/auth/me')).json()).user).toBeNull();
  expect(
    (
      await request.post('/api/auth/reset', {
        headers: { origin },
        data: { token: reset.searchParams.get('reset'), password },
      })
    ).ok(),
  ).toBe(false);
  expect(
    (
      await request.post('/api/auth/login', {
        headers: { origin },
        data: { email, password: next },
      })
    ).ok(),
  ).toBe(true);
  const svg = await request.post('/api/profile/media/avatar', {
    headers: { origin, 'content-type': 'image/svg+xml' },
    data: '<svg><script>alert(1)</script></svg>',
  });
  expect(svg.ok()).toBe(false);
  expect(
    (
      await request.delete('/api/auth/account', {
        headers: { origin },
        data: { confirmation: 'DELETE', password: next },
      })
    ).ok(),
  ).toBe(true);
  expect((await (await request.get('/api/auth/me')).json()).user).toBeNull();
  expect((await request.get('/api/profile/' + u.username)).status()).toBe(404);
  expect(
    (
      await request.post('/api/auth/login', {
        headers: { origin },
        data: { email, password: next },
      })
    ).status(),
  ).toBe(401);
});
