import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'es2022',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    include: ['src/tests/**/*.test.tsx', 'src/tests/**/*.test.ts'],
    // Integration tests (live RLS against the linked project) run ONLY via
    // `pnpm test:integration` (vitest.integration.config.ts).
    exclude: ['src/tests/integration/**'],
    globals: true,
  },
});
