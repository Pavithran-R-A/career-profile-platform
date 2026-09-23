export interface CloudflareSaaSConfig {
  apiToken: string;
  accountId: string;
  zoneId: string;
}

export interface CustomHostnameInput {
  hostname: string;
  originHost: string;
}

export interface CustomHostnameResult {
  id: string;
  hostname: string;
  status: string;
  validationRecord: { type: string; name: string; value: string } | null;
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

  const body = result.data as {
    result?: {
      id?: string;
      hostname?: string;
      status?: string;
      ssl_validation_records?: { type: string; name: string; value: string }[];
    };
  };

  const hostname = body.result?.hostname ?? input.hostname;
  const records = body.result?.ssl_validation_records ?? [];
  const validationRecord = records[0]
    ? {
        type: records[0].type,
        name: records[0].name,
        value: records[0].value,
      }
    : null;

  return {
    id: body.result?.id ?? hostname,
    hostname,
    status: body.result?.status ?? 'pending',
    validationRecord,
  };
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
