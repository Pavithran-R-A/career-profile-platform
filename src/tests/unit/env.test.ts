import { describe, it, expect } from 'vitest';
import { validateClientEnv, validateServerEnv } from '../../config/env';

describe('validateClientEnv', () => {
  it('accepts valid client env', () => {
    expect(
      validateClientEnv({
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJ-test-key',
      })
    ).toBeDefined();
  });

  it('rejects missing supabase URL', () => {
    expect(() => validateClientEnv({ VITE_SUPABASE_ANON_KEY: 'key' })).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() =>
      validateClientEnv({
        VITE_SUPABASE_URL: 'not-a-url',
        VITE_SUPABASE_ANON_KEY: 'key',
      })
    ).toThrow();
  });
});

describe('validateServerEnv', () => {
  it('accepts empty server env (optional)', () => {
    expect(validateServerEnv({})).toBeDefined();
  });

  it('accepts service role key', () => {
    expect(validateServerEnv({ SUPABASE_SERVICE_ROLE_KEY: 'service-key' })).toBeDefined();
  });
});
