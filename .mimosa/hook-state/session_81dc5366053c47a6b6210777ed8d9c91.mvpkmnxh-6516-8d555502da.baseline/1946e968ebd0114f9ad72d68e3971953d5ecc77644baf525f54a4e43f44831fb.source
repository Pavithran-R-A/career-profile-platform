import { describe, it, expect } from 'vitest';
import { sanitizeUrl, isSafeRedirect, isHttpUrl } from '../../lib/validators/url';

describe('sanitizeUrl', () => {
  it('allows http URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('allows https URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('rejects javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('rejects data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });

  it('rejects vbscript: URLs', () => {
    expect(sanitizeUrl('vbscript:MsgBox(1)')).toBeUndefined();
  });

  it('rejects blob: URLs', () => {
    expect(sanitizeUrl('blob:https://example.com/id')).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(sanitizeUrl(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(sanitizeUrl('')).toBeUndefined();
  });

  it('returns undefined for invalid URLs', () => {
    expect(sanitizeUrl('not-a-url')).toBeUndefined();
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeUrl('//evil.com')).toBeUndefined();
  });

  it('preserves query parameters and fragments', () => {
    expect(sanitizeUrl('https://example.com/path?q=1#hash')).toBe(
      'https://example.com/path?q=1#hash'
    );
  });
});

describe('isSafeRedirect', () => {
  it('allows relative paths', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true);
  });

  it('rejects protocol-relative paths', () => {
    expect(isSafeRedirect('//evil.com')).toBe(false);
  });

  it('rejects absolute URLs', () => {
    expect(isSafeRedirect('https://evil.com')).toBe(false);
  });
});

describe('isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('https://example.com/x')).toBe(true);
    expect(isHttpUrl('http://localhost:3000/')).toBe(true);
  });

  it('rejects dangerous and non-web schemes', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/plain,hi')).toBe(false);
    expect(isHttpUrl('ftp://files.example.com')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isHttpUrl('notaurl')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl('example.com/page')).toBe(false);
  });
});
