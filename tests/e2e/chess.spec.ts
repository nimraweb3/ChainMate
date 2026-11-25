import { test, expect } from '@playwright/test';

test('interactive preview, mode selection, mobile menu and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.live-preview').scrollIntoViewIfNeeded();
  const input = page.getByLabel('Keyboard move');
  await expect(input).toBeEnabled();
  await input.fill('e7e5');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.locator('.preview-bottom')).toContainText('White to move');
  await page.getByRole('button', { name: 'Reset preview board' }).click();
  await expect(page.locator('.preview-bottom')).toContainText('Black to move');
  await expect(page.locator('.cinema-art')).toHaveCSS('transform', 'none');
  await page.locator('.mode-dock a').first().click();
  await expect(page.getByRole('button', { name: '3+2 Blitz' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.goto('/arena');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('homepage, mobile composition, theme and navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.cinema h1')).toBeVisible();
  await page.screenshot({ path: '.local/home-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Use light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: '.local/home-mobile.png', fullPage: true });
  await page.locator('.cinema-actions .button').click();
  await expect(page.getByRole('heading', { name: 'Your game. Your way.' })).toBeVisible();
  expect(errors).toEqual([]);
});
for (const bot of ['bitcoin', 'ethereum', 'solana'])
  test(`${bot}: worker reply, illegal move, resignation and rematch`, async ({ page }) => {
    await page.goto('/game/bot?bot=' + bot);
    const input = page.getByLabel('Keyboard move');
    await expect(input).toBeEnabled({ timeout: 30000 });
    await input.fill('e2e5');
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.locator('.move-pair')).toHaveCount(0);
    await input.fill('e2e4');
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.locator('.move-pair button').nth(1)).not.toHaveText('', { timeout: 30000 });
    await expect(input).toBeEnabled();
    await page.getByRole('button', { name: 'Resign', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm resignation' }).click();
    await expect(page.getByText('Bot wins · Resignation')).toBeVisible();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.locator('.move-pair')).toHaveCount(0);
    await page.screenshot({ path: `.local/game-${bot}.png` });
  });
test('two browser sessions register, challenge, synchronize, reconnect, finish and replay', async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  const suffix = Date.now();
  for (const [p, name] of [
    [a, 'Alice'],
    [b, 'Bob'],
  ] as const) {
    await p.goto('/register');
    await p.getByLabel('Username', { exact: true }).fill(name + suffix);
    await p.getByLabel('Email address').fill(`${name}${suffix}@example.com`);
    await p.getByLabel('Password', { exact: true }).fill('a good test password 123');
    await p.getByRole('button', { name: 'Create account' }).click();
    await expect(p).toHaveURL(/dashboard/);
  }
  await a.goto('/play/friend');
  await a.getByRole('button', { name: 'Create private challenge' }).click();
  await expect(a).toHaveURL(/game\//);
  const id = a.url().split('/').pop()!;
  await b.goto('/play/friend?invite=' + id);
  await b.getByRole('button', { name: 'Join challenge' }).click();
  await expect(b).toHaveURL(/game\//);
  await expect(a.getByLabel('Keyboard move')).toBeEnabled();
  await a.getByLabel('Keyboard move').fill('e2e4');
  await a.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(b.locator('.move-pair button').first()).toHaveText('e4');
  await b.getByLabel('Keyboard move').fill('e7e5');
  await b.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(a.locator('.move-pair button').nth(1)).toHaveText('e5');
  await a.reload();
  await expect(a.locator('.move-pair button').nth(1)).toHaveText('e5');
  await b.getByRole('button', { name: 'Resign', exact: true }).click();
  await b.getByRole('button', { name: 'Confirm resignation' }).click();
  await expect(a.getByText(/wins · Resignation/)).toBeVisible();
  await a.goto('/dashboard');
  await expect(a.locator('.player-stat-strip')).toBeVisible();
  await a.screenshot({ path: '.local/review/profile-1440.png', fullPage: true });
  await a.setViewportSize({ width: 390, height: 844 });
  await a.screenshot({ path: '.local/review/profile-390.png', fullPage: true });
  await a.goto('/game/' + id + '/replay');
  await expect(a.getByRole('button', { name: 'Next move' })).toBeVisible();
  await ca.close();
  await cb.close();
});
