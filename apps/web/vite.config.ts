import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // Framework code changes far less often than the app: separate chunks stay cached across deploys.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            { name: 'forms', test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/ },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    // API_PROXY lets the API run on another port when 3000 is taken.
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    execArgv: ['--no-experimental-webstorage'],
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
