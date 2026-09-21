import { describe, it, expect } from 'vitest';

function extractUsernameFromHostname(hostname: string, apexDomain: string): string | null {
  const suffix = `.${apexDomain}`;
  if (!hostname.endsWith(suffix)) return null;
  const subdomain = hostname.slice(0, hostname.length - suffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  return subdomain;
}

function buildProfileHostname(username: string, apexDomain: string): string {
  return `${username}.${apexDomain}`;
}

describe('Hostname resolver', () => {
  const APEX = 'example.com';

  describe('extractUsernameFromHostname', () => {
    it('extracts username from a valid subdomain', () => {
      expect(extractUsernameFromHostname('alice.example.com', APEX)).toBe('alice');
    });

    it('extracts multi-segment usernames (with hyphens)', () => {
      expect(extractUsernameFromHostname('jane-smith.example.com', APEX)).toBe('jane-smith');
    });

    it('returns null for the bare apex domain', () => {
      expect(extractUsernameFromHostname('example.com', APEX)).toBeNull();
    });

    it('returns null for a non-matching domain', () => {
      expect(extractUsernameFromHostname('alice.evil.com', APEX)).toBeNull();
    });

    it('returns null for nested subdomains', () => {
      expect(extractUsernameFromHostname('a.b.example.com', APEX)).toBeNull();
    });

    it('returns null for an empty subdomain', () => {
      expect(extractUsernameFromHostname('.example.com', APEX)).toBeNull();
    });

    it('handles www as a subdomain', () => {
      expect(extractUsernameFromHostname('www.example.com', APEX)).toBe('www');
    });
  });

  describe('buildProfileHostname', () => {
    it('combines username and apex domain', () => {
      expect(buildProfileHostname('alice', APEX)).toBe('alice.example.com');
    });

    it('works with hyphenated usernames', () => {
      expect(buildProfileHostname('jane-doe', APEX)).toBe('jane-doe.example.com');
    });

    it('produces a hostname equal to what extractUsernameFromHostname round-trips', () => {
      const username = 'bob-jones';
      const hostname = buildProfileHostname(username, APEX);
      expect(extractUsernameFromHostname(hostname, APEX)).toBe(username);
    });
  });
});
