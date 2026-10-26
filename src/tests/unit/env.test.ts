import { describe, it, expect } from 'vitest';
import { validateClientEnv, validateServerEnv } from '../../config/env';
import { FAKE_SB_SECRET } from '../fixtures/fake-values';

describe('validateClientEnv', () => {
  it('accepts valid client env', () => {
    expect(
      validateClientEnv({
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJ-test-key',
      })
    ).toBeDefined();
  });

  it('rejects missing supabase URL', () => {
    expect(() => validateClientEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: 'key' })).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() =>
      validateClientEnv({
        VITE_SUPABASE_URL: 'not-a-url',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'key',
      })
    ).toThrow();
  });
});

describe('validateServerEnv', () => {
  it('accepts empty server env (optional)', () => {
    expect(validateServerEnv({})).toBeDefined();
  });

  it('accepts preferred Supabase secret key', () => {
    expect(validateServerEnv({ SUPABASE_SECRET_KEY: FAKE_SB_SECRET })).toBeDefined();
  });

  it('accepts legacy service role key', () => {
    expect(validateServerEnv({ SUPABASE_SERVICE_ROLE_KEY: 'service-key' })).toBeDefined();
  });
});
