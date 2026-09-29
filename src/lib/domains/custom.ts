import type { PlanEntitlements } from '../billing/plans';
import { checkUsage } from '../billing/usage';
import { validateCustomDomain } from './validators';

export type CustomDomainStatus = 'pending' | 'pending_validation' | 'active' | 'failed' | 'removed';

export interface CustomDomainRecord {
  id: string;
  profileId: string;
  hostname: string;
  status: CustomDomainStatus;
  verificationToken: string | null;
  cloudflareHostnameId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainQuotaCheck {
  allowed: boolean;
  reason: string | null;
  used: number;
  limit: number;
}

export function checkDomainQuota(used: number, entitlements: PlanEntitlements): DomainQuotaCheck {
  const result = checkUsage('custom_domains', used, entitlements);
  if (!result.allowed) {
    return {
      allowed: false,
      reason:
        entitlements.customDomains === 0
          ? 'Custom domains require the Pro plan'
          : 'Custom domain limit reached',
      used: result.used,
      limit: result.limit,
    };
  }
  return { allowed: true, reason: null, used: result.used, limit: result.limit };
}

export function validateAddDomain(
  input: string,
  used: number,
  entitlements: PlanEntitlements
): {
  ok: boolean;
  error: string | null;
  hostname: string | null;
} {
  const quota = checkDomainQuota(used, entitlements);
  if (!quota.allowed) {
    return { ok: false, error: quota.reason, hostname: null };
  }

  const validation = validateCustomDomain(input);
  if (!validation.valid) {
    return { ok: false, error: validation.error, hostname: null };
  }

  return { ok: true, error: null, hostname: validation.hostname };
}

/**
 * Cryptographically random per-domain verification token, generated once at
 * insert time and stored server-side. Never derived from a predictable
 * secret (an HMAC over a fallback like "cv" would be guessable), so a
 * token's presence in DNS genuinely proves control of the hostname.
 */
export function generateVerificationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `cv-verify-${encoded}`;
}
