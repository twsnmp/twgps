import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Wails/Go backend is a single instance, so run tests serially
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || (process.env.WAILS_DEVSERVER ? (process.env.WAILS_DEVSERVER.startsWith('http') ? process.env.WAILS_DEVSERVER : `http://${process.env.WAILS_DEVSERVER}`) : 'http://127.0.0.1:34116'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
