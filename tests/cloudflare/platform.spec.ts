import { test, expect } from '@playwright/test';
test('D1 profiles, R2 uploads, privacy, settings and wallet page survive reload', async ({
  page,
  request,
}) => {
  const id = Date.now();
  await page.goto('/register');
  await page.getByLabel('Username', { exact: true }).fill('Profile' + id);
  await page.getByLabel('Email address').fill(`profile${id}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('a long platform test password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/settings');
  await page.getByLabel('Display name').fill('The silver knight');
  await page.getByLabel('About you').fill('A real saved D1 profile.');
  await page.getByLabel('Private profile', { exact: true }).check();
  await page.getByLabel('Board finish').selectOption('warm');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('saved');
  await page.reload();
  await expect(page.getByLabel('About you')).toHaveValue('A real saved D1 profile.');
  await expect(page.getByLabel('Board finish')).toHaveValue('warm');
  const avatar = page.locator('.image-editor').first();
  await avatar.getByLabel('Choose an image').setInputFiles('assets/source/hero-knight.png');
  await expect(avatar.locator('canvas')).toBeVisible();
  await avatar.getByRole('button', { name: 'Save avatar' }).click();
  await expect(avatar.getByRole('status')).toHaveText('Image saved.');
  await page.goto('/dashboard');
  await expect(page.locator('.large-avatar img')).toBeVisible();
  const url = await page.locator('.large-avatar img').getAttribute('src');
  expect((await request.get(url!)).status()).toBe(404);
  expect((await request.get('/api/profile/Profile' + id)).status()).toBe(404);
  await page.reload();
  await expect
    .poll(() =>
      page.locator('.large-avatar img').evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(512);
  await page.screenshot({ path: '.local/cloudflare-profile.png', fullPage: true });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Choose your wallet' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: '.local/cloudflare-wallet-mobile.png', fullPage: true });
});
test('same-origin authorization and case-insensitive usernames', async ({ request }) => {
  const health = await request.get('/api/health');
  expect((await health.json()).realtime).toBe('durable-objects');
  const rejected = await request.post('/api/auth/register', {
    headers: { origin: 'https://untrusted.example' },
    data: { username: 'blocked', email: 'blocked@example.com', password: 'a long enough password' },
  });
  expect(rejected.status()).toBe(403);
  const name = 'Unique' + Date.now();
  const first = await request.post('/api/auth/register', {
    headers: { origin: 'http://127.0.0.1:8787' },
    data: { username: name, email: name + '@example.com', password: 'a long enough password' },
  });
  expect(first.status()).toBe(201);
  const second = await request.post('/api/auth/register', {
    headers: { origin: 'http://127.0.0.1:8787' },
    data: {
      username: name.toLowerCase(),
      email: 'other' + name + '@example.com',
      password: 'a long enough password',
    },
  });
  expect(second.ok()).toBe(false);
});
