// Verified-claims freshness validation for destructive account actions.
//
// Security contract: the decision uses claims VERIFIED by Supabase
// (`auth.getClaims(accessToken)` — local WebCrypto verification for
// asymmetric signing keys, Auth-server verification otherwise). The old
// approach read an unverified decoded JWT `iat` and is gone: a forged or
// tampered token can never influence this gate.
//
// A normal `auth.getUser()` User object has no `iat` and is not used for
// this decision; only verified claims are.
//
// The rest of the deletion semantics below are unchanged: the request is
// RECOVERABLE, not atomic — every step is idempotent, the marker makes
// partial progress explicit, and a retry after any failure re-runs the plan.
//
// Cross-user isolation: every cleanup is keyed by the verified auth userId
// from the fresh session; client-supplied ids are never accepted. Storage
// paths are additionally filtered to the `${userId}/` prefix.
//
// Secret isolation: the admin key is used only inside the worker; nothing in
// this module's outputs ever contains it.

/**
 * Account deletion must reauthenticate the account that initiated the flow.
 * Supabase signInWithPassword changes the browser's active session: without
 * this guard a user with access to multiple accounts could delete the wrong one.
 */
export function isOwnDeletionEmail(expectedEmail: string | null, inputEmail: string): boolean {
  return Boolean(
    expectedEmail && expectedEmail.trim().toLowerCase() === inputEmail.trim().toLowerCase()
  );
}

export function isOwnDeletionUser(
  expectedUserId: string,
  reauthedUserId: string | undefined
): boolean {
  return Boolean(reauthedUserId && expectedUserId === reauthedUserId);
}

export const RECENT_AUTH_WINDOW_S = 10 * 60; // 10 minutes

export interface AuthFreshness {
  fresh: boolean;
  reason: 'ok' | 'missing_claims' | 'malformed_claims' | 'sub_mismatch' | 'future_iat' | 'stale';
}

/**
 * Validate a verified claim set against the authenticated user id and the
 * recent-auth window. Pure: the caller obtains claims via
 * supabase.auth.getClaims(accessToken) and passes them here.
 */
export function validateAuthFreshness(
  claims: unknown,
  expectedSub: string,
  nowS: number = Math.floor(Date.now() / 1000)
): AuthFreshness {
  if (!claims || typeof claims !== 'object') {
    return { fresh: false, reason: 'missing_claims' };
  }

  const record = claims as Record<string, unknown>;
  const sub = typeof record.sub === 'string' ? record.sub : null;
  const iat = typeof record.iat === 'string' ? Number(record.iat) : record.iat;

  if (!sub || typeof iat !== 'number' || !Number.isFinite(iat)) {
    return { fresh: false, reason: 'malformed_claims' };
  }

  if (sub !== expectedSub) {
    return { fresh: false, reason: 'sub_mismatch' };
  }

  if (iat > nowS) {
    return { fresh: false, reason: 'future_iat' };
  }

  if (nowS - iat > RECENT_AUTH_WINDOW_S) {
    return { fresh: false, reason: 'stale' };
  }

  return { fresh: true, reason: 'ok' };
}

export type DeletionStage =
  'requested' | 'storage_cleaned' | 'rows_cleaned' | 'auth_deleted' | 'completed';

export interface DeletionRequestRow {
  user_id: string;
  stage: DeletionStage;
  requested_at: string;
  updated_at: string;
  completed_at: string | null;
  last_error: string | null;
  attempts: number;
}

export function newDeletionRequest(userId: string, now = new Date()): DeletionRequestRow {
  return {
    user_id: userId,
    stage: 'requested',
    requested_at: now.toISOString(),
    updated_at: now.toISOString(),
    completed_at: null,
    last_error: null,
    attempts: 1,
  };
}

/**
 * Pure transition for the marker row after a step. Missing-already state
 * (`rowCount === 0`, empty path list) advances the stage like a normal
 * success — that is what makes retries safe.
 */
export function advanceStage(
  row: DeletionRequestRow,
  stage: DeletionStage,
  now = new Date(),
  lastError: string | null = null
): DeletionRequestRow {
  return {
    ...row,
    stage,
    updated_at: now.toISOString(),
    completed_at: stage === 'completed' ? now.toISOString() : row.completed_at,
    last_error: lastError,
  };
}

export function recordAttempt(row: DeletionRequestRow, now = new Date()): DeletionRequestRow {
  return { ...row, attempts: row.attempts + 1, updated_at: now.toISOString() };
}

/** Owned tables WITHOUT `references auth.users on delete cascade`. */
export const EXPLICIT_TABLES = ['user_subscriptions', 'resume_sources'] as const;

export interface DeletionStep {
  kind: 'marker' | 'storage' | 'table' | 'auth';
  target: string;
}

/**
 * Ordered plan: marker first, storage next (while the user still exists),
 * then non-cascading rows, auth user last. The marker row itself is
 * cascade-deleted with the auth user, so no orphan marker survives.
 */
export function buildDeletionPlan(userId: string): DeletionStep[] {
  return [
    { kind: 'marker', target: 'account_deletion_requests' },
    { kind: 'storage', target: `resumes/${userId}/` },
    ...EXPLICIT_TABLES.map((t) => ({ kind: 'table' as const, target: t })),
    { kind: 'auth', target: 'auth.users' },
  ];
}

// ─── Customer-safe responses ──────────────────────────────────────
//
// Truthful wording: after storage/row cleanup succeeds but the auth delete
// fails, the account is NOT fully intact — say so plainly, without exposing
// implementation details (no table names, no admin endpoints, no statuses).

export const DELETION_PARTIAL_MESSAGE =
  "We couldn't finish deleting your account. Some cleanup may already have completed. Please retry.";

export const DELETION_FAILED_MESSAGE = 'Account deletion failed. Please try again.';

export interface DeletionOutcome {
  status: number;
  body: Record<string, unknown>;
  code?: string;
}

export function okDeleted(): DeletionOutcome {
  return { status: 200, body: { deleted: true } };
}

export function partialFailure(): DeletionOutcome {
  return {
    status: 502,
    body: { error: DELETION_PARTIAL_MESSAGE },
    code: 'DELETE_PARTIAL',
  };
}

export function failure(status: number, error: string, code: string): DeletionOutcome {
  return { status, body: { error }, code };
}

/**
 * Maps a failed auth-admin delete to the customer response. The distinction
 * matters: if any earlier step already ran, the truthful answer is the
 * partial message, never "nothing happened".
 */
export function responseForAuthDeleteFailure(
  progressMade: boolean,
  httpStatus: number | null
): DeletionOutcome {
  if (progressMade) return partialFailure();
  return failure(
    httpStatus === 401 || httpStatus === 403 ? 502 : 500,
    DELETION_FAILED_MESSAGE,
    'DELETE_FAILED'
  );
}
