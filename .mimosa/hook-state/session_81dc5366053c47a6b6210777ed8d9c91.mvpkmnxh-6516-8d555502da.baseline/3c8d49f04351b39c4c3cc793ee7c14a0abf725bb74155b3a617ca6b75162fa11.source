import { defineConfig, loadEnv } from 'vite';

/**
 * INTEGRATION suite — runs ONLY via `pnpm test:integration`.
 *
 * These tests hit the linked remote Supabase project (live RLS probes) and
 * are excluded from the ordinary unit suite so CI never needs live
 * credentials and never silently skips: if the required configuration is
 * absent, the suite FAILS with a clear message instead of skip-passing.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    test: {
      environment: 'node',
      include: ['src/tests/integration/**/*.test.ts'],
      globals: true,
      // Expose the loaded .env values as import.meta.env inside tests.
      env,
    },
  };
});
