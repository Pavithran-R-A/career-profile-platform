import { describe, it, expect } from 'vitest';
import { isSafeRedirect } from '../../lib/validators/url';

describe('isSafeRedirect', () => {
  it('allows internal paths starting with /', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true);
    expect(isSafeRedirect('/dashboard/profile')).toBe(true);
    expect(isSafeRedirect('/')).toBe(true);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isSafeRedirect('//evil.example.com')).toBe(false);
    expect(isSafeRedirect('//malicious.com/path')).toBe(false);
  });

  it('rejects absolute URLs with protocol', () => {
    expect(isSafeRedirect('https://evil.example.com')).toBe(false);
    expect(isSafeRedirect('http://malicious.com')).toBe(false);
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isSafeRedirect('')).toBe(false);
  });

  it('rejects paths without leading slash', () => {
    expect(isSafeRedirect('dashboard')).toBe(false);
    expect(isSafeRedirect('evil.com')).toBe(false);
  });
});
