import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
});
