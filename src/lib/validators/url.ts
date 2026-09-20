import { z } from 'zod';

export function isSafeRedirect(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  return true;
}

const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'blob:'];

function isSafeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return !DANGEROUS_SCHEMES.some((scheme) => lower.startsWith(scheme));
}

export const safeUrlSchema = z.string().url().refine(isSafeUrl, {
  message: 'URL contains a dangerous scheme',
});

export const optionalSafeUrlSchema = safeUrlSchema.nullable();
