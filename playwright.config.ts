import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/lab-03',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'Tablet iPad',
      use: { ...devices['iPad (gen 7)'], viewport: { width: 820, height: 1180 } },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix server run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm --prefix client run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
