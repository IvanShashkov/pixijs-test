import { defineConfig } from '@playwright/test';

/**
 * Playtest gallery: drives the canvas game through the DEV-only `window.__game` hook and saves
 * screenshots to e2e/screenshots for visual review. Uses the locally installed Google Chrome.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/test-results',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:5173',
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'landscape', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'portrait', use: { viewport: { width: 420, height: 860 }, hasTouch: true } },
  ],
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
