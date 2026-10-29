import { describe, expect, it } from 'vitest';
import { toSafeAuthMessage } from '../../lib/auth/errors';

const fallback = 'Something went wrong. Please try again.';

describe('auth provider errors are safe to display', () => {
  it.each([
    null,
    undefined,
    '',
    ' ',
    'Unable to reach database host 10.1.2.3',
    'An email provider returned DebugTrace=abc123',
    'Internal response from SELECT private_data',
    'Unknown error code E_BACKEND_INTERNAL',
    'Short unknown provider diagnostic',
  ])('never echoes missing or unrecognized diagnostics (%s)', (raw) => {
    expect(toSafeAuthMessage(raw)).toBe(fallback);
  });

  it.each([
    ['User already registered', 'User already registered'],
    ['Invalid login credentials', 'Invalid email or password.'],
    ['Email not confirmed', 'Please verify your email before signing in.'],
    ['rate limit exceeded', 'Too many attempts. Please wait a moment and try again.'],
    ['Invalid JWT: pgrst-000', 'Your session has expired. Please sign in again.'],
    ['Weak password', 'Your password does not meet the security requirements.'],
    ['Your link has expired', 'This link is invalid or has expired.'],
  ])('maps known auth error "%s" to fixed safe copy', (providerMessage, expected) => {
    expect(toSafeAuthMessage(providerMessage)).toBe(expected);
  });

  it('uses reset-link copy for token errors only on reset surfaces', () => {
    expect(toSafeAuthMessage('Auth session missing!', 'reset')).toBe(
      'This password-reset link is invalid or has expired.'
    );
    // A dropped session on verify-email must NOT claim to be a reset link.
    expect(toSafeAuthMessage('Auth session missing!', 'generic')).toBe(
      'Your session has expired. Please sign in again.'
    );
  });

  it('never includes appended provider diagnostics even after a known phrase', () => {
    const diagnostic = 'Email not confirmed: internal DB host=10.0.0.12 trace_id=XYZ';
    expect(toSafeAuthMessage(diagnostic)).toBe('Please verify your email before signing in.');
    expect(toSafeAuthMessage(diagnostic)).not.toContain('10.0.0.12');
  });
});
