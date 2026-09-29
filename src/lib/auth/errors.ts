/**
 * Customer-safe mapping for Supabase auth error messages. Raw provider text
 * ("Auth session missing!", "Invalid JWT", PostgREST internals) must never
 * reach the UI — every message returned here is safe to render verbatim.
 */

const SAFE_DEFAULT = 'Something went wrong. Please try again.';

/** Patterns that indicate provider/database internals or leaked diagnostics. */
const INTERNAL_PATTERNS =
  /session missing|invalid jwt|jwt|postgres|pgrst|sqlstate|constraint|violates|schema|relation|column|uuid|token expired|api key|apikey|provider|otp|secret/i;

/** Messages that are already user-appropriate pass through untouched. */
const ALLOWED_PATTERNS =
  /password|email|account|verified|verification|link|expired|invalid login|rate|try again|signed|user already|characters|weak/i;

export function toSafeAuthMessage(raw: string | null | undefined): string {
  if (!raw) return SAFE_DEFAULT;
  const message = raw.trim();
  if (message.length === 0) return SAFE_DEFAULT;
  if (ALLOWED_PATTERNS.test(message) && !INTERNAL_PATTERNS.test(message)) {
    return message;
  }
  if (INTERNAL_PATTERNS.test(message)) {
    // Distinguish the two cases users actually hit.
    if (/session missing|invalid jwt/i.test(message)) {
      return 'This password-reset link is invalid or has expired.';
    }
    if (/rate/i.test(message)) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    return SAFE_DEFAULT;
  }
  return message.length <= 140 ? message : SAFE_DEFAULT;
}
