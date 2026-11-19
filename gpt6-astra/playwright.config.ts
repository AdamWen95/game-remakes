import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, expect: { timeout: 15000 },
  fullyParallel: false, workers: 1, retries: 0,
  outputDir: '.qa/collection/test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/collection', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4184', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 960 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    { command: 'node scripts/serve.mjs --port 4184', url: 'http://127.0.0.1:4184', reuseExistingServer: false },
    { command: 'node scripts/serve.mjs --port 4185 --base /gpt6-astra-demos/', url: 'http://127.0.0.1:4185/gpt6-astra-demos/', reuseExistingServer: false },
  ],
});
