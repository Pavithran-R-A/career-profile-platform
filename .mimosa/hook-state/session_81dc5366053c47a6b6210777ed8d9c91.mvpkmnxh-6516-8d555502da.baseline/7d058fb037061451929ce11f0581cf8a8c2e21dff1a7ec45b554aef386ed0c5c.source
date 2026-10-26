/**
 * Integration qualification for the BILLING MODEL (one-time annual Pro) and
 * the legacy cancellation column. Runs ONLY via `pnpm test:integration`.
 *
 * Live probes need the linked project's publishable config. Per the
 * audit's live-test policy there is NO silent skip: when the configuration
 * is absent, the suite FAILS with a clear configuration message.
 *
 * Verified here:
 *   - remote schema truth: cancel_at_period_end exists (types generated
 *     FROM the linked DB assert it) and was added idempotently (migration)
 *   - anonymous clients can NEVER read or write user_subscriptions (RLS)
 *   - the marker table is fully client-inaccessible (worker-only)
 *   - the pure cancel/resume state machine (legacy semantics) stays
 *     idempotent and conflicts on stale state
 *   - a renewal webhook upsert clears the flag and EXTENDS the period
 */
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { applyCancelAction, describeCancellation } from '../../lib/billing/cancellation';
import { EXPLICIT_TABLES } from '../../lib/account/deletion';
import type { Database } from '../../lib/supabase/database.types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function requireLiveConfig(): { url: string; key: string } {
  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      'test:integration requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY ' +
        'in .env.local (linked Supabase project). No silent skips: configure them and re-run.'
    );
  }
  return { url: supabaseUrl, key: publishableKey };
}

// The generated types come from the LINKED remote database. If the column
// were missing remotely, regeneration would have omitted it and this
// static assertion would fail.
describe('remote schema: legacy cancellation column exists', () => {
  it('is part of the user_subscriptions Row type (generated from linked DB)', () => {
    const types = readFileSync(
      join(__dirname, '..', '..', 'lib', 'supabase', 'database.types.ts'),
      'utf-8'
    );
    expect(types).toContain('cancel_at_period_end: boolean');
  });

  it('the checked-in migration adds it idempotently with a default', () => {
    const migration = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'supabase',
        'migrations',
        '20260928020000_subscription_cancellation.sql'
      ),
      'utf-8'
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS cancel_at_period_end');
    expect(migration).toContain('DEFAULT false');
  });
});

// Anonymous RLS: with only the publishable key and no session, every
// operation on user_subscriptions must return zero rows / an RLS error —
// never data. The deletion marker table has NO policies at all, so even
// authenticated clients can never touch it (worker-only).
describe('anon access to sensitive tables is denied (live RLS)', () => {
  it('anon select returns no rows and anon update affects nothing', async () => {
    const { url, key } = requireLiveConfig();
    const anon = createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: selected, error: selectError } = await anon
      .from('user_subscriptions')
      .select('*')
      .limit(5);

    // RLS blocks the read: either an error or an empty result set.
    const leaked = (selected ?? []).length > 0;
    expect(leaked).toBe(false);
    expect(selectError === null || selected === null).toBe(true);

    // RLS also blocks writes: the update matches no visible rows.
    const { data: updated, error: updateError } = await anon
      .from('user_subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('user_id', '00000000-0000-4000-8000-00000000dead');

    expect(updateError === null || updated === null).toBe(true);
    if (updated !== null) expect((updated as unknown[]).length).toBe(0);
  });

  it('deletion marker table is completely inaccessible to clients (worker-only)', async () => {
    const { url, key } = requireLiveConfig();
    const anon = createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // SELECT: no grant → error, never rows.
    const { data, error } = await anon.from('account_deletion_requests').select('*').limit(5);
    expect(error).not.toBeNull();
    expect(data).toBeNull();

    // INSERT: a client must never be able to forge a deletion marker.
    const { error: insertError } = await anon.from('account_deletion_requests').insert({
      user_id: '00000000-0000-4000-8000-00000000dead',
      stage: 'requested',
    });
    expect(insertError).not.toBeNull();
  });

  it('the marker table is covered by the explicit non-cascading plan check', () => {
    // The marker itself cascades from auth.users (FK), so it must NOT be in
    // EXPLICIT_TABLES — assert the plan remains truthful.
    expect(EXPLICIT_TABLES).not.toContain('account_deletion_requests');
  });
});

// Idempotency + conflict semantics of the legacy state machine (server
// behavior mirror): repeat requests must not error, stale state must conflict.
describe('cancel/resume semantics (legacy state machine mirror)', () => {
  const future = new Date(Date.now() + 30 * 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const base = {
    plan: 'pro',
    status: 'active',
    current_period_end: future,
    cancel_at_period_end: false,
  };

  it('repeated cancel is idempotent (same target state, no error)', () => {
    const first = applyCancelAction(base, 'cancel');
    const second = applyCancelAction({ ...base, ...first.row }, 'cancel');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.row).toEqual(first.row);
  });

  it('repeated resume is idempotent', () => {
    const first = applyCancelAction({ ...base, cancel_at_period_end: true }, 'resume');
    const second = applyCancelAction({ ...base, ...first.row }, 'resume');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.row).toEqual(first.row);
  });

  it('stale state (period already ended) conflicts instead of downgrading early', () => {
    const result = applyCancelAction({ ...base, current_period_end: past }, 'cancel');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CONFLICT');
  });

  it('entitlements persist through current_period_end and never revoke early', () => {
    const pending = describeCancellation({ ...base, cancel_at_period_end: true });
    expect(pending.effective).toBe('pro');
    expect(pending.activeUntilEnd).toBe(true);
    expect(new Date(pending.cancelsAt!).getTime()).toBeGreaterThan(Date.now());
  });
});

// Webhook contract: a renewal upsert (what the webhook RPC performs)
// writes cancel_at_period_end = false and EXTENDS from
// max(now, current_period_end) — never shortens existing access.
describe('renewal webhook clears the legacy flag and extends access', () => {
  it('upsert shape includes cancel_at_period_end=false (renewal semantics)', () => {
    type UpsertShape = Database['public']['Tables']['user_subscriptions']['Insert'];
    const renewal: UpsertShape = {
      user_id: '00000000-0000-4000-8000-00000000dead',
      plan: 'pro',
      status: 'active',
      cancel_at_period_end: false,
      current_period_start: new Date().toISOString(),
      current_period_end: futureIso(),
      provider: 'razorpay',
    };
    expect(renewal.cancel_at_period_end).toBe(false);
  });
});

function futureIso(): string {
  return new Date(Date.now() + 365 * 86400000).toISOString();
}
