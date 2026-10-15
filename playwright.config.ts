import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI shards the suite over 4 jobs (--shard=n/4), each with 2 workers against its own dev server.
  workers: process.env.CI ? 2 : 4, // limit to 4 to avoid overwhelming dev server
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'on-first-retry',
    screenshot: process.env.CI ? 'only-on-failure' : 'on',
  },
  timeout: 90_000, // per-test timeout (cold Vite boot + 4 parallel workers can take ~50s)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // Vite cold TypeScript compilation can take > 30s
  },
});
