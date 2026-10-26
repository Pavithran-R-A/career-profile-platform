import { describe, it, expect } from 'vitest';
import {
  normalizeUsername,
  validateUsername,
  isReservedUsername,
} from '../../lib/validators/username';

describe('normalizeUsername', () => {
  it('lowercases input', () => {
    expect(normalizeUsername('Alice')).toBe('alice');
  });

  it('replaces underscores with hyphens', () => {
    expect(normalizeUsername('jane_doe')).toBe('jane-doe');
  });

  it('replaces whitespace with hyphens', () => {
    expect(normalizeUsername('John Smith')).toBe('john-smith');
  });

  it('removes leading/trailing hyphens', () => {
    expect(normalizeUsername('-alice-')).toBe('alice');
  });

  it('collapses multiple hyphens', () => {
    expect(normalizeUsername('a---b')).toBe('a-b');
  });

  it('trims whitespace', () => {
    expect(normalizeUsername('  alice  ')).toBe('alice');
  });
});

describe('validateUsername', () => {
  it('accepts valid lowercase alphanumeric', () => {
    const result = validateUsername('alice');
    expect(result.valid).toBe(true);
    expect(result.username).toBe('alice');
    expect(result.error).toBeNull();
  });

  it('accepts hyphens internally', () => {
    expect(validateUsername('jane-smith-42').valid).toBe(true);
  });

  it('rejects single character', () => {
    expect(validateUsername('a').valid).toBe(false);
  });

  it('rejects usernames > 63 chars', () => {
    expect(validateUsername('a'.repeat(64)).valid).toBe(false);
  });

  it('rejects non-ASCII after normalization', () => {
    expect(validateUsername('café').valid).toBe(false);
  });

  it('rejects reserved words', () => {
    expect(validateUsername('www').valid).toBe(false);
    expect(validateUsername('admin').valid).toBe(false);
    expect(validateUsername('api').valid).toBe(false);
    expect(validateUsername('root').valid).toBe(false);
    expect(validateUsername('auth').valid).toBe(false);
    expect(validateUsername('null').valid).toBe(false);
    expect(validateUsername('undefined').valid).toBe(false);
  });

  it('normalizes before validation', () => {
    const result = validateUsername('  Jane_Smith  ');
    expect(result.valid).toBe(true);
    expect(result.username).toBe('jane-smith');
  });
});

describe('isReservedUsername', () => {
  it('returns true for known reserved words', () => {
    expect(isReservedUsername('www')).toBe(true);
    expect(isReservedUsername('ADMIN')).toBe(true);
  });

  it('returns false for normal names', () => {
    expect(isReservedUsername('alice')).toBe(false);
  });
});
