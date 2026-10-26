import { defineConfig, devices } from '@playwright/test';

// Intentionally separate from hermetic CI: never launch a local server or
// mistake guest checks for authenticated acceptance of a deployed Worker.
const baseURL = process.env.E2E_BASE_URL?.trim();
if (!baseURL) {
  throw new Error('Set E2E_BASE_URL to the HTTPS CareerProfile Go Worker preview URL.');
}
const target = new URL(baseURL);
if (
  target.protocol !== 'https:' ||
  target.hostname !== 'careerprofilego.memrae-staging.workers.dev' ||
  target.pathname !== '/' ||
  target.search ||
  target.hash
) {
  throw new Error('E2E_BASE_URL must be the exact HTTPS CareerProfile Go Workers preview origin.');
}

export default defineConfig({
  testDir: './e2e-live',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-live-report' }]],
  outputDir: 'e2e/.live-artifacts',
  use: {
    baseURL: target.origin,
    channel: 'chrome',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
