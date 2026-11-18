import { defineConfig } from '@playwright/test';
import { authFile } from './e2e/auth/state';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4300/exp-spsh/';
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'tmp/playwright-report', open: 'never' }]],
  outputDir: 'tmp/playwright-results',
  use: {
    baseURL,
    channel: 'chrome',
    viewport: { width: 425, height: 896 },
    isMobile: true,
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: '**/authenticated/**' },
    {
      name: 'google-setup',
      testMatch: '**/google.setup.ts',
      retries: 0,
      timeout: 60_000,
      use: { trace: 'off', video: 'off', screenshot: 'off', serviceWorkers: 'block' },
    },
    {
      name: 'authenticated',
      workers: 1, // Spending tests share a sheet and delete rows by index.
      testMatch: '**/authenticated/**/*.spec.ts',
      dependencies: ['google-setup'],
      use: { storageState: authFile, trace: 'off', video: 'off', screenshot: 'off' },
    },
  ],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        stdout: 'pipe',
        command: 'npm run e2e:serve',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
