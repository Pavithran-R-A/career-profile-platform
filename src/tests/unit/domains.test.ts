import { describe, it, expect } from 'vitest';
import {
  normalizeHostname,
  isValidHostname,
  isValidDomainLabel,
  parseDotCvInput,
  validateCustomDomain,
} from '../../lib/domains/validators';
import {
  checkDomainQuota,
  validateAddDomain,
  generateVerificationToken,
} from '../../lib/domains/custom';
import type { PlanEntitlements } from '../../lib/billing/plans';

const freeEnt: PlanEntitlements = {
  planId: 'free',
  resumeVariants: 3,
  githubRepos: 5,
  recruiterAiPerDay: 10,
  tailoringPerMonth: 3,
  customDomains: 0,
  removeBranding: false,
};

const proEnt: PlanEntitlements = {
  planId: 'pro',
  resumeVariants: 20,
  githubRepos: 20,
  recruiterAiPerDay: 100,
  tailoringPerMonth: 30,
  customDomains: 1,
  removeBranding: true,
};

describe('validators', () => {
  it('normalizes hostname', () => {
    expect(normalizeHostname('  Example.COM. ')).toBe('example.com');
  });

  it('accepts valid hostname', () => {
    expect(isValidHostname('careers.example.io')).toBe(true);
    expect(isValidHostname('sub.domain.co.uk')).toBe(true);
  });

  it('rejects invalid hostname', () => {
    expect(isValidHostname('not_a_domain')).toBe(false);
    expect(isValidHostname('')).toBe(false);
    expect(isValidHostname('localhost')).toBe(false);
    expect(isValidHostname('example.com')).toBe(false);
    expect(isValidHostname('foo.example.com')).toBe(false);
  });

  it('validates domain labels', () => {
    expect(isValidDomainLabel('myname')).toBe(true);
    expect(isValidDomainLabel('my-name')).toBe(true);
    expect(isValidDomainLabel('-bad')).toBe(false);
    expect(isValidDomainLabel('bad-')).toBe(false);
    expect(isValidDomainLabel('')).toBe(false);
    expect(isValidDomainLabel('has.dot')).toBe(false);
  });

  it('parses .cv input', () => {
    expect(parseDotCvInput('myname')).toEqual({ label: 'myname', fqdn: 'myname.cv' });
    expect(parseDotCvInput('myname.cv')).toEqual({ label: 'myname', fqdn: 'myname.cv' });
    expect(parseDotCvInput('MyName.CV')).toEqual({ label: 'myname', fqdn: 'myname.cv' });
  });

  it('rejects invalid .cv input', () => {
    expect(parseDotCvInput('')).toBeNull();
    expect(parseDotCvInput('has.dot')).toBeNull();
    expect(parseDotCvInput('-bad')).toBeNull();
    expect(parseDotCvInput('bad-')).toBeNull();
  });

  it('validateCustomDomain returns error for invalid', () => {
    const result = validateCustomDomain('not_valid');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('validateCustomDomain returns valid hostname', () => {
    const result = validateCustomDomain('careers.example.io');
    expect(result.valid).toBe(true);
    expect(result.hostname).toBe('careers.example.io');
  });
});

describe('custom domain quota', () => {
  it('free plan blocks custom domains', () => {
    const result = checkDomainQuota(0, freeEnt);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Pro plan');
  });

  it('pro plan allows first domain', () => {
    const result = checkDomainQuota(0, proEnt);
    expect(result.allowed).toBe(true);
  });

  it('pro plan blocks second domain', () => {
    const result = checkDomainQuota(1, proEnt);
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(1);
  });

  it('validateAddDomain blocks free plan', () => {
    const result = validateAddDomain('careers.example.io', 0, freeEnt);
    expect(result.ok).toBe(false);
    expect(result.hostname).toBeNull();
  });

  it('validateAddDomain allows pro with valid host', () => {
    const result = validateAddDomain('careers.example.io', 0, proEnt);
    expect(result.ok).toBe(true);
    expect(result.hostname).toBe('careers.example.io');
  });

  it('validateAddDomain rejects invalid host on pro', () => {
    const result = validateAddDomain('not_valid', 0, proEnt);
    expect(result.ok).toBe(false);
  });

  it('generateVerificationToken is random per call and URL-safe', () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^cv-verify-[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^cv-verify-[A-Za-z0-9_-]{43}$/);
  });
});
