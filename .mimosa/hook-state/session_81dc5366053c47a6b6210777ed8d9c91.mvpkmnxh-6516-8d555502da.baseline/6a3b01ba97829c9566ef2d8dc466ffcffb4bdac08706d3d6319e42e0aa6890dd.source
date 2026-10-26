import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

// Compile the exact checkout SHA into the Worker health response, making
// stale deployments distinguishable from the freshly tested source tree.
const buildSha = (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unavailable';
  }
})();

export default defineConfig({
  define: { __BUILD_COMMIT_SHA__: JSON.stringify(buildSha) },
  plugins: [
    react(),
    tailwindcss(),
    // persistState: false — dev/preview miniflare state (rate-limiter DO
    // counters, KV, etc.) is ephemeral. A persistent limiter bucket made a
    // previous e2e run's requests trip the 30/min IP limiter in the next run.
    // Deployed previews/production are unaffected (they never persist locally).
    cloudflare({ persistState: false }),
  ],
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
    // Cache transformed modules on disk to reduce repeated work under the bounded
    // two-worker CI test pool.
    fsModuleCache: true,
  },
});
