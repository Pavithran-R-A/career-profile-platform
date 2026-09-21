const CUSTOM_DOMAIN_ENV_KEY = 'PUBLIC_CUSTOM_DOMAIN';
const DEFAULT_FALLBACK_HOST = 'cv.example.com';

export interface ResolvedHostname {
  type: 'custom' | 'subdomain' | 'localhost';
  profileSlug?: string;
  customDomain?: string;
  isLocalhost: boolean;
}

export function resolveHostname(hostname: string): ResolvedHostname {
  if (hostname === 'localhost' || hostname.startsWith('localhost:')) {
    return {
      type: 'localhost',
      isLocalhost: true,
    };
  }

  const customDomain = import.meta.env[CUSTOM_DOMAIN_ENV_KEY];
  if (customDomain && hostname === customDomain) {
    return {
      type: 'custom',
      customDomain,
      isLocalhost: false,
    };
  }

  const fallbackHost = import.meta.env['PUBLIC_BASE_HOST'] || DEFAULT_FALLBACK_HOST;
  if (hostname.endsWith('.' + fallbackHost)) {
    const subdomain = hostname.replace('.' + fallbackHost, '');
    if (subdomain && !subdomain.includes('.')) {
      return {
        type: 'subdomain',
        profileSlug: subdomain,
        isLocalhost: false,
      };
    }
  }

  return {
    type: 'custom',
    customDomain: hostname,
    isLocalhost: false,
  };
}

export function getProfileSlugFromHostname(hostname: string): string | null {
  const resolved = resolveHostname(hostname);

  if (resolved.type === 'localhost') {
    return null;
  }

  if (resolved.type === 'subdomain' && resolved.profileSlug) {
    return resolved.profileSlug;
  }

  return null;
}

export function isCustomDomain(hostname: string): boolean {
  const customDomain = import.meta.env[CUSTOM_DOMAIN_ENV_KEY];
  return !!customDomain && hostname === customDomain;
}

export function getBaseUrl(hostname: string): string {
  const resolved = resolveHostname(hostname);
  const protocol = resolved.isLocalhost ? 'http' : 'https';

  if (resolved.type === 'localhost') {
    return `${protocol}://${hostname}`;
  }

  if (resolved.type === 'custom' && resolved.customDomain) {
    return `${protocol}://${resolved.customDomain}`;
  }

  if (resolved.type === 'subdomain') {
    return `${protocol}://${hostname}`;
  }

  return `${protocol}://${hostname}`;
}
