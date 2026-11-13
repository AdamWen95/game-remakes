import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/single',
  timeout: 160000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  outputDir: '.qa/single-html/test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/single', open: 'never' }]],
  use: { offline: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 960 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 960 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
});
