import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4200",
  },
  webServer: [
    {
      command:
        "cd ../backend && uv run uvicorn src.main:app --host 0.0.0.0 --port 8000",
      port: 8000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "cd .. && bunx nx serve frontend",
      port: 4200,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
