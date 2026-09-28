// Account deletion planning (pure functions; the worker performs I/O).
//
// Deletion contract:
//   1. The request must carry a *recent* Supabase session (re-auth): we accept
//      an access token whose issued-at (iat) is within RECENT_AUTH_WINDOW_S.
//      Supabase embeds `iat` in the /auth/v1/user response for the token.
//   2. The user's Storage objects (resume PDFs under `${userId}/`) are removed
//      first — after the auth user is gone nothing can authorize storage ops.
//   3. Owned app rows are deleted via the admin client. Tables WITHOUT an
//      ON DELETE CASCADE to auth.users are listed explicitly; cascade covers
//      the rest (profiles → sections, billing rows, funnel events, etc.).
//   4. Finally `DELETE /auth/v1/admin/users/{id}` runs with the server-only
//      key. The browser never sees any secret.
//   5. Any non-fatal cleanup failure (e.g. an already-removed object) is
//      logged and skipped; a failure in the final auth delete is fatal and
//      reported so the user can retry (nothing is half-deleted from their
//      point of view: the account still signs in).

export const RECENT_AUTH_WINDOW_S = 10 * 60; // 10 minutes

export function isRecentAuth(iat: unknown, now = Math.floor(Date.now() / 1000)): boolean {
  return (
    typeof iat === 'number' &&
    Number.isFinite(iat) &&
    now - iat <= RECENT_AUTH_WINDOW_S &&
    now >= iat
  );
}

/** Owned tables without `references auth.users on delete cascade`. */
export const EXPLICIT_TABLES = ['user_subscriptions', 'resume_sources'] as const;

export interface DeletionStep {
  kind: 'storage' | 'table' | 'auth';
  target: string;
}

/** Ordered plan (log/verify aid); storage first, auth last. */
export function buildDeletionPlan(userId: string): DeletionStep[] {
  return [
    { kind: 'storage', target: `resumes/${userId}/` },
    ...EXPLICIT_TABLES.map((t) => ({ kind: 'table' as const, target: t })),
    { kind: 'auth', target: 'auth.users' },
  ];
}

export interface DeletionOutcome {
  status: number;
  body: Record<string, unknown>;
  code?: string;
}

export function okDeleted(): DeletionOutcome {
  return { status: 200, body: { deleted: true } };
}

export function failure(status: number, error: string, code: string): DeletionOutcome {
  return { status, body: { error }, code };
}
