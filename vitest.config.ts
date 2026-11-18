import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/frontend', { test: { name: 'scripts', include: ['scripts/*.test.ts'] } }],
  },
});
