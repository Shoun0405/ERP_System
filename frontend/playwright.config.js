import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:  './e2e',
  timeout:  30_000,
  retries:  1,
  reporter: 'line',
  use: {
    baseURL:          'http://localhost:5173',
    headless:         true,
    screenshot:       'only-on-failure',
    actionTimeout:    8_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command:           'cd ../backend && node server.js',
      url:               'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout:           15_000,
    },
    {
      command:           'npm run dev',
      url:               'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout:           20_000,
    },
  ],
});
