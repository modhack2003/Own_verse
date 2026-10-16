import { defineConfig, devices } from '@playwright/test';
import { testDatabase } from './scripts/test-database';

const database = testDatabase('e2e');
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, retries: process.env.CI ? 1 : 0,
  timeout: 60000, expect: { timeout: 10000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:3100', contextOptions: { reducedMotion: 'reduce' }, trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] } : {} },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm run start -- -p 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 120000,
    env: { DATABASE_URL: database, ADMIN_PIN: '84627193', GITHUB_USERNAME: 'modhack2003' },
  },
});
