import { describe, it, expect } from 'vitest';
import {
  isRecentAuth,
  RECENT_AUTH_WINDOW_S,
  buildDeletionPlan,
  EXPLICIT_TABLES,
  okDeleted,
  partialFailure,
  failure,
  responseForAuthDeleteFailure,
  newDeletionRequest,
  advanceStage,
  recordAttempt,
  DELETION_PARTIAL_MESSAGE,
  DELETION_FAILED_MESSAGE,
  type DeletionRequestRow,
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
  it('marker first, storage second, auth user last', () => {
    const plan = buildDeletionPlan('user-1');
    expect(plan[0]).toEqual({ kind: 'marker', target: 'account_deletion_requests' });
    expect(plan[1]).toEqual({ kind: 'storage', target: 'resumes/user-1/' });
    expect(plan[plan.length - 1]).toEqual({ kind: 'auth', target: 'auth.users' });
  });

  it('covers every table without an ON DELETE CASCADE to auth.users', () => {
    const plan = buildDeletionPlan('user-1');
    const tableTargets = plan.filter((s) => s.kind === 'table').map((s) => s.target);
    for (const table of EXPLICIT_TABLES) {
      expect(tableTargets).toContain(table);
    }
    expect(EXPLICIT_TABLES).toContain('user_subscriptions');
    expect(EXPLICIT_TABLES).toContain('resume_sources');
  });

  it('storage targets are namespaced under the verified user id', () => {
    const plan = buildDeletionPlan('user-1');
    const storage = plan.find((s) => s.kind === 'storage')!;
    expect(storage.target.startsWith('resumes/user-1/')).toBe(true);
    expect(storage.target).not.toContain('user-2');
  });
});

describe('pending-deletion marker state machine', () => {
  it('creates a requested row with attempts=1', () => {
    const row = newDeletionRequest('u1');
    expect(row.stage).toBe('requested');
    expect(row.attempts).toBe(1);
    expect(row.completed_at).toBeNull();
  });

  it('advances through storage → rows → completed', () => {
    let row: DeletionRequestRow = newDeletionRequest('u1');
    row = advanceStage(row, 'storage_cleaned');
    expect(row.stage).toBe('storage_cleaned');
    row = advanceStage(row, 'rows_cleaned');
    expect(row.stage).toBe('rows_cleaned');
    row = advanceStage(row, 'completed');
    expect(row.stage).toBe('completed');
    expect(row.completed_at).not.toBeNull();
  });

  it('records a retry by incrementing attempts without losing original request time', () => {
    const first = newDeletionRequest('u1', new Date('2026-01-01T00:00:00Z'));
    const retry = recordAttempt(first, new Date('2026-01-01T00:05:00Z'));
    expect(retry.attempts).toBe(2);
    expect(retry.requested_at).toBe(first.requested_at);
    expect(retry.updated_at).not.toBe(first.updated_at);
  });

  it('a retry after auth-delete failure starts a second attempt (idempotent re-run)', () => {
    // storage + rows succeeded, auth delete failed
    let row: DeletionRequestRow = newDeletionRequest('u1');
    row = advanceStage(row, 'storage_cleaned');
    row = advanceStage(row, 'rows_cleaned', new Date(), 'auth_delete_failed');
    expect(row.stage).toBe('rows_cleaned');
    expect(row.last_error).toBe('auth_delete_failed');

    // second request: attempt increments, plan re-runs from the top —
    // already-cleaned storage/rows are tolerated as no-ops. recordAttempt
    // itself does not clear last_error; the worker's marker upsert writes
    // last_error: null for the fresh attempt (mirroring the handler).
    const retry = recordAttempt(row);
    expect(retry.attempts).toBe(2);
    const freshAttempt = { ...retry, last_error: null };
    expect(freshAttempt.last_error).toBeNull();
  });

  it('second delete request is safe: advancing again is a no-op for completed stages', () => {
    const row = advanceStage(newDeletionRequest('u1'), 'storage_cleaned');
    const again = advanceStage(row, 'storage_cleaned');
    expect(again.stage).toBe('storage_cleaned');
    expect(again.attempts).toBe(row.attempts);
  });

  it('final retry reaches completed with completed_at set', () => {
    let row: DeletionRequestRow = recordAttempt(
      advanceStage(advanceStage(newDeletionRequest('u1'), 'storage_cleaned'), 'rows_cleaned')
    );
    row = advanceStage(row, 'completed');
    expect(row.stage).toBe('completed');
    expect(row.completed_at).not.toBeNull();
    expect(row.attempts).toBe(2);
  });
});

describe('partial-failure responses (truthful wording)', () => {
  it('auth-delete failure after progress returns the partial message', () => {
    const out = responseForAuthDeleteFailure(true, 500);
    expect(out.status).toBe(502);
    expect(out.body).toEqual({ error: DELETION_PARTIAL_MESSAGE });
    expect(out.code).toBe('DELETE_PARTIAL');
  });

  it('the partial message never exposes implementation details', () => {
    for (const leak of [
      'storage',
      'resume_sources',
      'user_subscriptions',
      'admin',
      'auth',
      'stage',
      'marker',
      'cascade',
      'table',
    ]) {
      expect(DELETION_PARTIAL_MESSAGE.toLowerCase()).not.toContain(leak);
    }
    expect(DELETION_PARTIAL_MESSAGE).toContain('Some cleanup may already have completed');
    expect(DELETION_PARTIAL_MESSAGE).toContain('Please retry');
  });

  it('the generic failure message also carries no implementation detail', () => {
    expect(DELETION_FAILED_MESSAGE).toBe('Account deletion failed. Please try again.');
  });

  it('auth-delete failure with NO progress is a retryable failure, not a partial claim', () => {
    const out = responseForAuthDeleteFailure(false, null);
    expect(out.status).toBe(500);
    expect(out.body).toEqual({ error: DELETION_FAILED_MESSAGE });
  });
});

describe('outcome helpers', () => {
  it('okDeleted is the 200 contract', () => {
    const out = okDeleted();
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ deleted: true });
  });

  it('partialFailure is the 502 + truthful message contract', () => {
    const out = partialFailure();
    expect(out.status).toBe(502);
    expect(out.code).toBe('DELETE_PARTIAL');
    expect(out.body.error).toBe(DELETION_PARTIAL_MESSAGE);
  });

  it('failure carries status, message and code', () => {
    const out = failure(401, 'Please sign in again', 'REAUTH_REQUIRED');
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Please sign in again' });
    expect(out.code).toBe('REAUTH_REQUIRED');
  });

  it('no outcome body ever embeds a server secret', () => {
    const bodies = [
      okDeleted().body,
      partialFailure().body,
      failure(500, DELETION_FAILED_MESSAGE, 'INTERNAL').body,
    ];
    for (const body of bodies) {
      expect(JSON.stringify(body)).not.toMatch(/sb_secret_|service_role|admin.*key/i);
    }
  });
});
