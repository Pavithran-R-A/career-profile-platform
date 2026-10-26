/**
 * Cloudflare for SaaS custom-hostname integration, built around the
 * provider's ACTUAL responses. Every result exposes the provider's own
 * ownership verification record(s) and SSL validation state — the app never
 * invents a verification value (the old made-up `cv-verify-*` TXT token is
 * gone).
 *
 * Response shapes mirror Cloudflare's official API:
 *   result.ownership_verification       = { type, name, value }   (TXT)
 *   result.ownership_verification_http  = { status, ... }          (HTTP)
 *   result.status                       = pending | active | moved | ...
 *   result.ssl.status                   = pending_validation | active | ...
 *   result.ssl.validation_records       = [{ type, name, value }]
 */
export interface CloudflareSaaSConfig {
  apiToken: string;
  accountId: string;
  zoneId: string;
}

export interface CustomHostnameInput {
  hostname: string;
  originHost: string;
}

export interface OwnershipVerificationTxt {
  type: 'txt';
  name: string;
  value: string;
}

export interface OwnershipVerificationHttp {
  status: string;
  [key: string]: unknown;
}

export interface CustomHostnameResult {
  id: string;
  hostname: string;
  status: string;
  /** Provider's TXT ownership record — display EXACTLY this. */
  ownership_verification: OwnershipVerificationTxt | null;
  /** Provider's HTTP ownership verification details. */
  ownership_verification_http: OwnershipVerificationHttp | null;
  /** SSL certificate status from the provider. */
  sslStatus: string | null;
  /** SSL validation records the provider reports (when relevant). */
  sslValidationRecords: Array<{ type: string; name: string; value: string }>;
}

interface CloudflareCustomHostnameBody {
  result?: {
    id?: string;
    hostname?: string;
    status?: string;
    ownership_verification?: { type?: string; name?: string; value?: string };
    ownership_verification_http?: { status?: string } & Record<string, unknown>;
    ssl?: {
      status?: string;
      validation_records?: Array<{ type?: string; name?: string; value?: string }>;
      validation_errors?: Array<{ message?: string }>;
    };
  };
  errors?: Array<{ code?: number; message?: string }>;
}

export function isCloudflareSaaSConfigured(config: Partial<CloudflareSaaSConfig>): boolean {
  return Boolean(config.apiToken && config.accountId && config.zoneId);
}

function baseUrl(config: CloudflareSaaSConfig): string {
  return `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames`;
}

async function cloudflareFetch(
  config: CloudflareSaaSConfig,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetchImpl(`${baseUrl(config)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => null)) as unknown;
  return { ok: response.ok, status: response.status, data };
}

function normalizeResult(
  body: CloudflareCustomHostnameBody,
  fallbackHostname: string
): CustomHostnameResult {
  const r = body.result ?? {};
  const ssl = r.ssl ?? {};
  const ownership = r.ownership_verification ?? null;
  const ownershipHttp = r.ownership_verification_http ?? null;

  return {
    id: r.id ?? '',
    hostname: r.hostname ?? fallbackHostname,
    status: r.status ?? 'pending',
    ownership_verification:
      ownership && typeof ownership.value === 'string' && ownership.value.length > 0
        ? {
            type: 'txt',
            name: ownership.name ?? `_acme-challenge.${fallbackHostname}`,
            value: ownership.value,
          }
        : null,
    ownership_verification_http: (ownershipHttp as OwnershipVerificationHttp | null) ?? null,
    sslStatus: ssl.status ?? null,
    sslValidationRecords: (ssl.validation_records ?? []).map((rec) => ({
      type: rec.type ?? 'txt',
      name: rec.name ?? '',
      value: rec.value ?? '',
    })),
  };
}

export async function createCustomHostname(
  config: CloudflareSaaSConfig,
  input: CustomHostnameInput,
  fetchImpl: typeof fetch = fetch
): Promise<CustomHostnameResult> {
  if (!isCloudflareSaaSConfigured(config)) {
    throw new Error('CLOUDFLARE_SAAS_NOT_CONFIGURED');
  }

  const result = await cloudflareFetch(
    config,
    '',
    {
      method: 'POST',
      body: JSON.stringify({
        hostname: input.hostname,
        ssl: {
          method: 'http',
          type: 'dv',
        },
        custom_origin_server: input.originHost,
      }),
    },
    fetchImpl
  );

  if (!result.ok) {
    throw new Error(`CLOUDFLARE_CREATE_HOSTNAME_FAILED_${result.status}`);
  }

  const normalized = normalizeResult(result.data as CloudflareCustomHostnameBody, input.hostname);
  if (!normalized.id) {
    throw new Error('CLOUDFLARE_CREATE_HOSTNAME_NO_ID');
  }
  return normalized;
}

/** Fetches the hostname's CURRENT provider state (status refresh). */
export async function getCustomHostname(
  config: CloudflareSaaSConfig,
  hostnameId: string,
  fetchImpl: typeof fetch = fetch
): Promise<CustomHostnameResult | null> {
  if (!isCloudflareSaaSConfigured(config)) {
    throw new Error('CLOUDFLARE_SAAS_NOT_CONFIGURED');
  }

  const result = await cloudflareFetch(
    config,
    `/${encodeURIComponent(hostnameId)}`,
    { method: 'GET' },
    fetchImpl
  );
  if (!result.ok) return null;

  const normalized = normalizeResult(result.data as CloudflareCustomHostnameBody, '');
  if (!normalized.id) return null;
  return normalized;
}

export async function deleteCustomHostname(
  config: CloudflareSaaSConfig,
  hostnameId: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (!isCloudflareSaaSConfigured(config)) {
    throw new Error('CLOUDFLARE_SAAS_NOT_CONFIGURED');
  }

  const result = await cloudflareFetch(
    config,
    `/${encodeURIComponent(hostnameId)}`,
    { method: 'DELETE' },
    fetchImpl
  );

  return result.ok;
}
