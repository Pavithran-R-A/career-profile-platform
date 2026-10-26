// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  createCustomHostname,
  getCustomHostname,
  deleteCustomHostname,
  isCloudflareSaaSConfigured,
  type CloudflareSaaSConfig,
} from '../../lib/domains/cloudflare';

const CONFIG: CloudflareSaaSConfig = {
  apiToken: 'token',
  accountId: 'acct',
  zoneId: 'zone',
};

/**
 * Fixtures mirror Cloudflare's OFFICIAL custom hostname response shapes:
 *   result.ownership_verification      → { type: "txt", name, value }
 *   result.ownership_verification_http → { status: "pending" | "active", ... }
 *   result.status                      → "pending" | "active" | "moved"
 *   result.ssl.status                  → "pending_validation" | "active"
 *   result.ssl.validation_records      → [{ type, name, value }]
 */
const PENDING_HOSTNAME_BODY = {
  success: true,
  result: {
    id: 'ch_1234567890abcdef',
    hostname: 'careers.example.io',
    status: 'pending',
    ownership_verification: {
      type: 'txt',
      name: '_acme-challenge.careers.example.io',
      value: 'dw8ZbtEcg0y3S_pH8F-jDGcFpNcR2TcXKjXdCBFsBBc',
    },
    ownership_verification_http: {
      status: 'pending',
    },
    ssl: {
      status: 'pending_validation',
      validation_records: [
        {
          type: 'txt',
          name: '_acme-challenge.careers.example.io',
          value: 'e5Hku2jpPB3vBn1Wpq0OZjG9V0u5fCq0UKcvXSDb7O8',
        },
      ],
    },
  },
};

const ACTIVE_HOSTNAME_BODY = {
  success: true,
  result: {
    id: 'ch_1234567890abcdef',
    hostname: 'careers.example.io',
    status: 'active',
    ownership_verification: {
      type: 'txt',
      name: '_acme-challenge.careers.example.io',
      value: 'dw8ZbtEcg0y3S_pH8F-jDGcFpNcR2TcXKjXdCBFsBBc',
    },
    ownership_verification_http: {
      status: 'active',
    },
    ssl: {
      status: 'active',
      validation_records: [],
    },
  },
};

function fetchOk(body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
}

describe('createCustomHostname (provider-actual response)', () => {
  it('exposes the provider TXT ownership verification record verbatim', async () => {
    const fetchImpl = fetchOk(PENDING_HOSTNAME_BODY);
    const result = await createCustomHostname(
      CONFIG,
      { hostname: 'careers.example.io', originHost: 'profiles.example.com' },
      fetchImpl
    );
    expect(result.id).toBe('ch_1234567890abcdef');
    expect(result.status).toBe('pending');
    expect(result.ownership_verification).toEqual({
      type: 'txt',
      name: '_acme-challenge.careers.example.io',
      value: 'dw8ZbtEcg0y3S_pH8F-jDGcFpNcR2TcXKjXdCBFsBBc',
    });
    expect(result.ownership_verification_http).toEqual({ status: 'pending' });
    expect(result.sslStatus).toBe('pending_validation');
    expect(result.sslValidationRecords).toHaveLength(1);
  });

  it('sends the custom origin server and HTTP SSL method', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify(PENDING_HOSTNAME_BODY), { status: 200 });
    }) as typeof fetch;
    await createCustomHostname(
      CONFIG,
      { hostname: 'careers.example.io', originHost: 'profiles.example.com' },
      fetchImpl
    );
    expect(captured!.url).toBe('https://api.cloudflare.com/client/v4/zones/zone/custom_hostnames');
    const body = JSON.parse(captured!.init.body as string) as {
      hostname: string;
      custom_origin_server: string;
      ssl: { method: string; type: string };
    };
    expect(body.hostname).toBe('careers.example.io');
    expect(body.custom_origin_server).toBe('profiles.example.com');
    expect(body.ssl.method).toBe('http');
  });

  it('never invents a verification token (no cv-verify value in the module)', async () => {
    const fetchImpl = fetchOk(PENDING_HOSTNAME_BODY);
    const result = await createCustomHostname(
      CONFIG,
      { hostname: 'careers.example.io', originHost: 'profiles.example.com' },
      fetchImpl
    );
    expect(JSON.stringify(result)).not.toContain('cv-verify');
  });

  it('throws on provider failure (caller marks the row failed and frees the slot)', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: false, errors: [{ code: 1000, message: 'bad' }] }), {
          status: 400,
        })
    ) as unknown as typeof fetch;
    await expect(
      createCustomHostname(
        CONFIG,
        { hostname: 'careers.example.io', originHost: 'profiles.example.com' },
        fetchImpl
      )
    ).rejects.toThrow('CLOUDFLARE_CREATE_HOSTNAME_FAILED_400');
  });

  it('rejects an unconfigured provider', async () => {
    await expect(
      createCustomHostname(
        { apiToken: '', accountId: '', zoneId: '' },
        { hostname: 'x.example.io', originHost: 'o' }
      )
    ).rejects.toThrow('CLOUDFLARE_SAAS_NOT_CONFIGURED');
  });
});

describe('getCustomHostname (status refresh)', () => {
  it('returns the CURRENT provider status for the refresh flow', async () => {
    const fetchImpl = fetchOk(ACTIVE_HOSTNAME_BODY);
    const result = await getCustomHostname(CONFIG, 'ch_1234567890abcdef', fetchImpl);
    expect(result?.status).toBe('active');
    expect(result?.sslStatus).toBe('active');
    expect(result?.ownership_verification_http).toEqual({ status: 'active' });
  });

  it('returns null on lookup failure', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 500 })) as typeof fetch;
    expect(await getCustomHostname(CONFIG, 'ch_x', fetchImpl)).toBeNull();
  });
});

describe('deleteCustomHostname (remove flow)', () => {
  it('calls DELETE on the hostname resource', async () => {
    let calledUrl = '';
    const fetchImpl = (async (url: string) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as typeof fetch;
    const ok = await deleteCustomHostname(CONFIG, 'ch_abc', fetchImpl);
    expect(ok).toBe(true);
    expect(calledUrl).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone/custom_hostnames/ch_abc'
    );
  });
});

describe('isCloudflareSaaSConfigured', () => {
  it('requires all three credentials', () => {
    expect(isCloudflareSaaSConfigured(CONFIG)).toBe(true);
    expect(isCloudflareSaaSConfigured({ ...CONFIG, zoneId: '' })).toBe(false);
  });
});
