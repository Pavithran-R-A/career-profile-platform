import { describe, it, expect } from 'vitest';
import {
  isRecentAuth,
  RECENT_AUTH_WINDOW_S,
  buildDeletionPlan,
  EXPLICIT_TABLES,
  okDeleted,
  failure,
} from '../../lib/account/deletion';

describe('isRecentAuth (re-auth gate)', () => {
  const now = 1_800_000_000;

  it('accepts tokens issued within the window', () => {
    expect(isRecentAuth(now - 30, now)).toBe(true);
    expect(isRecentAuth(now - RECENT_AUTH_WINDOW_S, now)).toBe(true);
  });

  it('rejects stale tokens (long-lived sessions must re-authenticate)', () => {
    expect(isRecentAuth(now - RECENT_AUTH_WINDOW_S - 1, now)).toBe(false);
    expect(isRecentAuth(now - 3600, now)).toBe(false);
  });

  it('rejects malformed or future iat values', () => {
    expect(isRecentAuth(undefined, now)).toBe(false);
    expect(isRecentAuth('1750000000', now)).toBe(false);
    expect(isRecentAuth(Number.NaN, now)).toBe(false);
    expect(isRecentAuth(now + 60, now)).toBe(false);
  });
});

describe('deletion plan ordering', () => {
  it('removes storage objects first and the auth user last', () => {
    const plan = buildDeletionPlan('user-1');
    expect(plan[0]).toEqual({ kind: 'storage', target: 'resumes/user-1/' });
    expect(plan[plan.length - 1]).toEqual({ kind: 'auth', target: 'auth.users' });
  });

  it('covers every table without an ON DELETE CASCADE to auth.users', () => {
    const plan = buildDeletionPlan('user-1');
    const tableTargets = plan.filter((s) => s.kind === 'table').map((s) => s.target);
    for (const table of EXPLICIT_TABLES) {
      expect(tableTargets).toContain(table);
    }
    // user_subscriptions is the billing source of truth; resume_sources owns
    // the storage paths. Everything else cascades from auth.users.
    expect(EXPLICIT_TABLES).toContain('user_subscriptions');
    expect(EXPLICIT_TABLES).toContain('resume_sources');
  });
});

describe('outcome helpers', () => {
  it('okDeleted is the 200 contract', () => {
    const out = okDeleted();
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ deleted: true });
  });

  it('failure carries status, message and code', () => {
    const out = failure(401, 'Please sign in again', 'REAUTH_REQUIRED');
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Please sign in again' });
    expect(out.code).toBe('REAUTH_REQUIRED');
  });
});
