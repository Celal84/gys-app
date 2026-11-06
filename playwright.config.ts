import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'mobile-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 },
      launchOptions: { executablePath: process.env.CI ? undefined : '/usr/bin/chromium' } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'], browserName: 'webkit' } },
  ],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173', port: 4173, reuseExistingServer: !process.env.CI },
});
