const HOSTNAME_REGEX = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'invalid',
  'local',
  'internal',
]);

export function normalizeHostname(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, '');
}

export function isValidHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!HOSTNAME_REGEX.test(normalized)) return false;
  if (BLOCKED_HOSTNAMES.has(normalized)) return false;
  if (normalized.endsWith('.example.com')) return false;
  return true;
}

export function isValidDomainLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (normalized.length < 1 || normalized.length > 63) return false;
  return LABEL_REGEX.test(normalized);
}

export function parseDotCvInput(input: string): { label: string; fqdn: string } | null {
  let value = input.trim().toLowerCase();
  if (value.endsWith('.cv')) {
    value = value.slice(0, -3);
  }
  if (!value || value.includes('.')) return null;
  if (!isValidDomainLabel(value)) return null;
  return { label: value, fqdn: `${value}.cv` };
}

export function validateCustomDomain(input: string): {
  valid: boolean;
  hostname: string;
  error: string | null;
} {
  const hostname = normalizeHostname(input);
  if (!hostname) {
    return { valid: false, hostname, error: 'Domain is required' };
  }
  if (!isValidHostname(hostname)) {
    return {
      valid: false,
      hostname,
      error: 'Enter a valid domain (e.g. careers.yourname.com)',
    };
  }
  return { valid: true, hostname, error: null };
}
