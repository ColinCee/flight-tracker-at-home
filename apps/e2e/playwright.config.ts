import { defineConfig } from '@playwright/test';

const serversExternal = !!process.env.SERVERS_EXTERNAL;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4200',
  },
  ...(serversExternal
    ? {}
    : {
        webServer: [
          {
            command: 'uv run uvicorn src.main:app --host 0.0.0.0 --port 8000',
            cwd: '../backend',
            env: { ...process.env, MOCK_DATA: 'true' },
            port: 8000,
            reuseExistingServer: !process.env.CI,
          },
          {
            command: 'bunx vite',
            cwd: '../frontend',
            port: 4200,
            reuseExistingServer: !process.env.CI,
          },
        ],
      }),
});
