/**
 * Customer-safe mapping for Supabase Auth error messages.
 *
 * An upstream message is untrusted diagnostic text. Match recognizable errors
 * only to FIXED customer-facing strings; never return the upstream message
 * itself, even when it is short or happens to contain a friendly keyword.
 */
const SAFE_DEFAULT = 'Something went wrong. Please try again.';

export function toSafeAuthMessage(raw: string | null | undefined): string {
  const message = raw?.trim().toLowerCase();
  if (!message) return SAFE_DEFAULT;

  if (/session missing|invalid jwt|invalid token|token expired|recovery token/.test(message)) {
    return 'This password-reset link is invalid or has expired.';
  }

  if (/rate limit|too many requests|too many attempts/.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (/user already registered|user already exists/.test(message)) {
    return 'User already registered';
  }

  if (/email not confirmed|email not verified/.test(message)) {
    return 'Please verify your email before signing in.';
  }

  if (/invalid login credentials|invalid email or password|incorrect password/.test(message)) {
    return 'Invalid email or password.';
  }

  if (/weak password|password.{0,50}(too short|length|characters|weak)/.test(message)) {
    return 'Your password does not meet the security requirements.';
  }

  if (/expired.{0,30}link|link.{0,30}expired|token.{0,30}expired|invalid.{0,20}link/.test(message)) {
    return 'This link is invalid or has expired.';
  }

  return SAFE_DEFAULT;
}
