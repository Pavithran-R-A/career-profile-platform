import { z } from 'zod';

export function isSafeRedirect(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  // '/\evil.com' normalizes to a protocol-relative URL in WHATWG parsing, and
  // control characters can smuggle separators into downstream header/link
  // contexts. Reject both rather than keeping a trapdoor in the validator.
  if (path.includes('\\')) return false;
  if (/[\u0000-\u001f]/.test(path)) return false;
  return true;
}

const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'blob:'];

/** True only for absolute http/https URLs (input validation). */
export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return !DANGEROUS_SCHEMES.some((scheme) => lower.startsWith(scheme));
}

export const safeUrlSchema = z.string().url().refine(isSafeUrl, {
  message: 'URL contains a dangerous scheme',
});

export const optionalSafeUrlSchema = safeUrlSchema.nullable();

export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    // Safe for navigation and required for genuine contact links ("Email"
    // buttons on a public profile). Every other scheme (javascript:, data:,
    // vbscript:, blob:) still falls through to undefined.
    if (parsed.protocol === 'mailto:') {
      return url;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
