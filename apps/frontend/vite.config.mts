/// <reference types='vitest' />

import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/frontend',
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rolldownOptions: {
      output: {
        // Libraries change less often than app code; separate chunks stay cached
        // across deploys. Only libraries live radar loads go here, so the
        // heatmap's geo-layers and h3-js stay in their own lazy chunk.
        codeSplitting: {
          groups: [
            { name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/ },
            {
              name: 'deck',
              test: /node_modules[\\/](@deck\.gl[\\/](core|layers|mapbox)|@luma\.gl|@math\.gl[\\/](core|web-mercator))[\\/]/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|@tanstack|@vis\.gl|react-map-gl)[\\/]/,
            },
          ],
        },
      },
    },
  },
}));
