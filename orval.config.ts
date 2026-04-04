import { defineConfig } from 'orval';

export default defineConfig({
  flightTrackerApi: {
    input: {
      target: './apps/frontend/openapi.json',
    },
    output: {
      target: './apps/frontend/src/api/generated.ts',
      client: 'react-query',
      mode: 'single',
      clean: false,
      override: {
        mutator: {
          path: './apps/frontend/src/api/fetch-client.ts',
          name: 'fetchClient',
        },
        query: {
          useQuery: true,
          useInfinite: false,
        },
      },
    },
  },
});
