import { defineConfig, devices } from '@playwright/test';

const NODE_BIN = `${process.env.HOME}/.nvm/versions/node/v22.18.0/bin`;
const JAVA_BIN = '/opt/homebrew/opt/openjdk/bin';
const PATH = `${JAVA_BIN}:${NODE_BIN}:${process.env.PATH}`;

/**
 * Two servers: the Firebase Emulator Suite (Auth, Firestore, Storage,
 * Functions) and Vite. Everything the tests touch is real Firebase behaviour —
 * real security rules, real triggers — just running locally.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14 Pro'] },
    },
  ],

  webServer: [
    {
      command: 'firebase emulators:start --project taxfax-364f6',
      cwd: '.',
      url: 'http://127.0.0.1:4000',
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { PATH },
    },
    {
      command: 'npm --prefix web run dev',
      cwd: '.',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { PATH, VITE_USE_EMULATORS: '1' },
    },
  ],
});
