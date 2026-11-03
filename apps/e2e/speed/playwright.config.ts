import { defineConfig } from '@playwright/test';

// Speed budgets run against a production build (vite build + vite preview) with
// the mock-data backend, like smoke/, on their own ports so both can run at once.
const API_PORT = 8004;
const PREVIEW_PORT = 4304;

export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  // One worker so loads do not compete for the CPU; one retry for timing spikes
  // on shared CI machines.
  workers: 1,
  retries: 1,
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    // Same WebGL path as smoke/: headless Chromium otherwise loses the map's context.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: [
    {
      command: `uv run uvicorn src.main:app --port ${API_PORT}`,
      cwd: '../../backend',
      env: {
        ...process.env,
        MOCK_DATA: 'true',
        CORS_ORIGINS: `http://localhost:${PREVIEW_PORT}`,
      },
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `bunx vite build && bunx vite preview --port ${PREVIEW_PORT} --strictPort`,
      cwd: '../../frontend',
      env: { ...process.env, VITE_API_BASE_URL: `http://localhost:${API_PORT}` },
      port: PREVIEW_PORT,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
