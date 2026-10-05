import { describe, expect, it } from 'vitest';
import { NEW_PASSWORD_MIN_LENGTH, newPasswordError } from '../../lib/auth/password';

describe('new password policy', () => {
  it('requires at least 12 characters', () => {
    expect(NEW_PASSWORD_MIN_LENGTH).toBe(12);
    expect(newPasswordError('Aa1!short')).toMatch(/at least 12/i);
  });

  it('requires lower, upper, number, and symbol classes', () => {
    expect(newPasswordError('ABCDEFGHIJK1!')).toMatch(/lowercase/i);
    expect(newPasswordError('abcdefghijk1!')).toMatch(/uppercase/i);
    expect(newPasswordError('Abcdefghijk!')).toMatch(/number/i);
    expect(newPasswordError('Abcdefghijk1')).toMatch(/symbol/i);
  });

  it('accepts a strong password', () => {
    expect(newPasswordError('CareerProfile Go!2026Secure')).toBeNull();
  });
});
