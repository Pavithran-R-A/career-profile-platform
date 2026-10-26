import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('profile onboarding migration', () => {
  it('grants authenticated callers access to the onboarding function', () => {
    const sql = readFileSync(
      'supabase/migrations/20261009145657_restore_authenticated_onboarding_rpc_execute.sql',
      'utf8'
    );
    expect(sql).toContain('TO authenticated;');
    expect(sql).toContain('FROM PUBLIC, anon;');
  });
});
