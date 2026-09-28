// Account deletion semantics (pure functions; the worker performs I/O).
//
// Deletion contract:
//   1. The request must carry a *recent* Supabase session (re-auth): we accept
//      an access token whose issued-at (iat) is within RECENT_AUTH_WINDOW_S.
//      Supabase embeds `iat` in the /auth/v1/user response for the token.
//   2. A durable pending-deletion marker row is upserted FIRST so an
//      interrupted attempt is observable and every retry is explicit.
//   3. The user's Storage objects (resume PDFs) are removed — already-absent
//      objects are tolerated (storage.remove does not fail on missing keys).
//   4. Owned non-cascading rows are deleted; 0 rows affected (already gone
//      from an earlier attempt) is success, not an error.
//   5. `DELETE /auth/v1/admin/users/{id}` runs with the server-only key.
//      404 (user already deleted by a prior attempt) is SUCCESS.
//
// These steps are inherently NOT one transaction. The design is therefore
// RECOVERABLE, not atomic: every step is idempotent, the marker makes partial
// progress explicit, and a retry after any failure re-runs the whole plan and
// safely continues. A failed auth delete means SOME cleanup may already have
// completed — the customer wording says exactly that, and the marker row
// remains so observability/retries are truthful.
//
// Cross-user isolation: every cleanup is keyed by the verified auth userId
// from the fresh session; client-supplied ids are never accepted. Storage
// paths are additionally filtered to the `${userId}/` prefix.
//
// Secret isolation: the admin key is used only inside the worker; nothing in
// this module's outputs ever contains it.

export const RECENT_AUTH_WINDOW_S = 10 * 60; // 10 minutes

export function isRecentAuth(iat: unknown, now = Math.floor(Date.now() / 1000)): boolean {
  return (
    typeof iat === 'number' &&
    Number.isFinite(iat) &&
    now - iat <= RECENT_AUTH_WINDOW_S &&
    now >= iat
  );
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
