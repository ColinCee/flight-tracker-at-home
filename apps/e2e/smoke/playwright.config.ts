import { defineConfig } from '@playwright/test';

// Runs against a real production build (vite build + vite preview), not the
// dev server: the dev server serves node_modules unbundled, so bundling bugs
// such as a missing maplibre worker only show up here.
const API_PORT = 8003;
const PREVIEW_PORT = 4303;

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
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
