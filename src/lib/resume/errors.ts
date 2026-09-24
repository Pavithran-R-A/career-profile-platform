/**
 * Customer-safe error boundary for the resume flow.
 *
 * Internal failures (Postgres errors, constraint names, UUID syntax
 * complaints, storage internals) must never reach the UI. Every message
 * returned here is safe to render verbatim.
 */

export type ResumeAction = 'save' | 'load' | 'delete';

const GENERIC_MESSAGES: Record<ResumeAction, string> = {
  save: "We couldn't save this resume. Please try again.",
  load: "We couldn't load your resumes. Please try again.",
  delete: "We couldn't delete this resume. Please try again.",
};

/** Patterns that indicate an internal/database/storage diagnostic. */
const INTERNAL_PATTERNS =
  /uuid|postgres|pg[A-Z]{2,}|relation ["']|constraint|violates|sqlstate|column ["']|table ["']|schema|database|pgrst|resume_sources|storage|bucket|insert|update .*resume|Failed to (save|update|fetch|delete)|unauthorized|unauthorised|forbidden|permission denied|row-level|jwt|token expired|invalid token|not allowed/i;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Fail fast when a non-UUID reaches the database boundary.
 * Throws a customer-safe error before any storage/DB call runs.
 */
export function assertProfileId(profileId: unknown): asserts profileId is string {
  if (!isUuid(profileId)) {
    throw new Error(GENERIC_MESSAGES.save);
  }
}

/**
 * Map any thrown value to a customer-safe message. Messages that already
 * read as user-facing copy pass through; anything smelling like an
 * internal diagnostic is replaced with a generic message.
 */
export function toCustomerMessage(err: unknown, action: ResumeAction = 'save'): string {
  const raw = err instanceof Error ? err.message : 'Something went wrong.';
  if (!raw || INTERNAL_PATTERNS.test(raw)) {
    return GENERIC_MESSAGES[action];
  }
  return raw;
}
