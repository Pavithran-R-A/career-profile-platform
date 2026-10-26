import { describe, it, expect } from 'vitest';
import {
  normalizeHostname,
  isValidHostname,
  isValidDomainLabel,
  parseDotCvInput,
  validateCustomDomain,
} from '../../lib/domains/validators';

// Tests the SHIPPED hostname/domain resolvers (src/lib/domains/validators.ts)
// — the same functions the custom-domain and .cv endpoints run in the worker.
// No parsing logic is duplicated here.

describe('normalizeHostname (production)', () => {
  it('lowercases and trims, and strips a single trailing dot', () => {
    expect(normalizeHostname('  Alice.Example.COM. ')).toBe('alice.example.com');
  });

  it('keeps interior dots intact', () => {
    expect(normalizeHostname('docs.alice.example.com')).toBe('docs.alice.example.com');
  });
});

describe('isValidHostname (production)', () => {
  it('accepts normal profile hosts', () => {
    expect(isValidHostname('careers.yourname.com')).toBe(true);
    expect(isValidHostname('www.alice.dev')).toBe(true);
  });

  it('rejects garbage, empty, and uppercase-hostile-but-normalizable input consistently', () => {
    expect(isValidHostname('')).toBe(false);
    expect(isValidHostname('not a domain')).toBe(false);
    expect(isValidHostname('-leading-dash.example.com')).toBe(false);
    expect(isValidHostname('under_score.example.com')).toBe(false);
  });

  it('rejects reserved and internal hosts', () => {
    expect(isValidHostname('localhost')).toBe(false);
    expect(isValidHostname('invalid')).toBe(false);
    expect(isValidHostname('internal')).toBe(false);
  });

  it('rejects bare IPs (regex requires a letters-only TLD)', () => {
    expect(isValidHostname('127.0.0.1')).toBe(false);
  });

  it('rejects documentation/example domains outright', () => {
    expect(isValidHostname('alice.example.com')).toBe(false);
    expect(isValidHostname('example.com')).toBe(false);
  });
});

describe('isValidDomainLabel (production)', () => {
  it('accepts a plain label and rejects dots inside it', () => {
    expect(isValidDomainLabel('alice')).toBe(true);
    expect(isValidDomainLabel('alice.smith')).toBe(false);
  });

  it('enforces length bounds', () => {
    expect(isValidDomainLabel('')).toBe(false);
    expect(isValidDomainLabel('a'.repeat(64))).toBe(false);
    expect(isValidDomainLabel('a'.repeat(63))).toBe(true);
  });
});

describe('parseDotCvInput (production)', () => {
  it('parses a bare label and label.cv equally', () => {
    expect(parseDotCvInput('alice')).toEqual({ label: 'alice', fqdn: 'alice.cv' });
    expect(parseDotCvInput('Alice.CV')).toEqual({ label: 'alice', fqdn: 'alice.cv' });
  });

  it('rejects multi-label and invalid input', () => {
    expect(parseDotCvInput('alice.example.com')).toBeNull();
    expect(parseDotCvInput('')).toBeNull();
    expect(parseDotCvInput('bad_label')).toBeNull();
  });
});

describe('validateCustomDomain (production)', () => {
  it('normalizes and accepts a valid custom host', () => {
    const result = validateCustomDomain('Careers.YourName.COM');
    expect(result.valid).toBe(true);
    expect(result.hostname).toBe('careers.yourname.com');
    expect(result.error).toBeNull();
  });

  it('reports a customer-safe error for invalid input', () => {
    const result = validateCustomDomain('not a domain');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/valid domain/i);
  });

  it('requires non-empty input', () => {
    const result = validateCustomDomain('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });
});
