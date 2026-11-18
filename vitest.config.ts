import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/frontend', { test: { name: 'checks', include: ['checks/*.test.ts'] } }],
  },
});
