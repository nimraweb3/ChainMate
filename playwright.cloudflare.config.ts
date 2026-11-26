import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/*.spec.ts', 'cloudflare/*.spec.ts'],
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.CHAINMATE_TEST_URL || 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'cloudflare-chromium', use: { ...devices['Desktop Chrome'] } }],
});
