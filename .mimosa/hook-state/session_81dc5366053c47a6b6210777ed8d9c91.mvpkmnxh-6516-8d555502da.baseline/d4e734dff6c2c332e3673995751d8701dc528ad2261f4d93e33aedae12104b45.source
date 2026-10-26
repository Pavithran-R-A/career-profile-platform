// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../../workers/handler';
import { createServerClient } from '../../lib/supabase/server';

vi.mock('../../lib/supabase/server', () => ({ createServerClient: vi.fn() }));

/**
 * Domain contract tests: the worker persists and returns the provider's OWN
 * verification payload (realistic Cloudflare for SaaS response shapes) and
 * the refresh/remove endpoints behave truthfully. ownership_verification is
 * the only authority — the app never invents a DNS value and the obsolete
 * `verification_token` is never written or returned.
 */

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface ChainState {
  rows?: unknown[] | null;
  error?: { code?: string; message: string } | null;
  count?: number | null;
  single?: unknown;
}

function chainable(state: ChainState): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: state.single ?? null, error: state.error })),
    then: (resolve: (v: { data: unknown; error: unknown; count?: number | null }) => void) =>
      resolve({ data: state.rows, error: state.error, count: state.count ?? null }),
  };
  return builder;
}

function makeAdminClient(
  tableStates: Record<string, () => ChainState>,
  rpcResults: Record<string, unknown> = {}
) {
  const from = vi.fn((table: string) =>
    chainable((tableStates[table] ?? (() => ({ rows: [], error: null })))())
  );
  const rpc = vi.fn(async (name: string) => ({
    data: rpcResults[name] ?? null,
    error: null,
  }));
  return { from, rpc };
}

function makeRequest(
  path: string,
  options: { method?: string; token?: string; body?: unknown; origin?: string } = {}
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.origin) headers.set('Origin', options.origin);
  return new Request(`https://example.com${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function mockAuthUser(userId: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/auth/v1/user')) return jsonRes({ id: userId });
      return jsonRes({ error: 'unexpected' }, 404);
    })
  );
}

const AUTH_ENV = {
  SUPABASE_URL: 'https://sb.example.com',
  SUPABASE_SECRET_KEY: 'test-only-admin-key-not-a-real-secret',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

const DOMAINS_ENV = {
  ...AUTH_ENV,
  DOMAINS_ENABLED: 'true',
  CLOUDFLARE_API_TOKEN: 'tok',
  CLOUDFLARE_ACCOUNT_ID: 'acct',
  CLOUDFLARE_ZONE_ID: 'zone',
  PLATFORM_PROFILE_ORIGIN: 'profiles.example.com',
};

/** Realistic Cloudflare custom-hostname create/fetch response (TXT ownership). */
const CF_TXT_RESPONSE = {
  result: {
    id: 'cf-hostname-1',
    hostname: 'careers.example.io',
    status: 'pending',
    ownership_verification: {
      type: 'txt',
      name: '_cf-custom-domain.careers.example.io',
      value: '6f8fa1e4-0d5a-4b0e-9d1a-cloudflare-verify',
    },
    ssl: {
      status: 'pending_validation',
      validation_records: [],
      validation_errors: [],
    },
  },
};

/** Realistic Cloudflare response using HTTP token verification instead. */
const CF_HTTP_RESPONSE = {
  result: {
    id: 'cf-hostname-2',
    hostname: 'careers.example.io',
    status: 'pending',
    ownership_verification_http: {
      status: 'pending',
      http_url: 'http://careers.example.io/.well-known/acme-challenge/cf-token',
      http_body: 'cf-http-body-token-9f2c',
    },
    ssl: { status: 'pending_validation', validation_records: [] },
  },
};

/** Cloudflare state after the TXT record has been added and validated. */
const CF_ACTIVE_RESPONSE = {
  result: {
    id: 'cf-hostname-1',
    hostname: 'careers.example.io',
    status: 'active',
    ssl: {
      status: 'active',
      validation_records: [],
      validation_errors: [],
    },
  },
};

const DOMAIN_ROW = {
  id: 'd1',
  profile_id: 'profile-A',
  hostname: 'careers.example.io',
  status: 'pending_validation',
  cloudflare_hostname_id: 'cf-hostname-1',
  provider_validation: { type: 'txt', name: '_cf-custom-domain.careers.example.io', value: 'v0' },
  provider_validation_http: null,
  ssl_status: 'pending_validation',
  ssl_validation_records: [],
  last_error: null,
};

describe('POST /api/domains/custom returns the provider verification immediately', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');
  });

  it('returns verification record for TXT ownership (provider is authoritative)', async () => {
    const admin = makeAdminClient(
      {
        profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
      },
      { create_custom_domain_atomic: 'd1' }
    );
    vi.mocked(createServerClient).mockReturnValue(admin as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
        if (url.includes('/custom_hostnames')) return jsonRes(CF_TXT_RESPONSE, 200);
        return jsonRes({ error: 'unexpected' }, 404);
      })
    );

    const res = await handleRequest(
      makeRequest('/api/domains/custom', {
        method: 'POST',
        token: 't',
        body: { hostname: 'careers.example.io' },
      }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      hostname: string;
      status: string;
      verification: {
        method: string;
        record: { type: string; name: string; value: string } | null;
      };
    };
    expect(body.id).toBe('d1');
    expect(body.hostname).toBe('careers.example.io');
    expect(body.status).toBe('pending_validation');
    expect(body.verification.method).toBe('txt');
    expect(body.verification.record).toEqual(CF_TXT_RESPONSE.result.ownership_verification);
  });

  it('returns HTTP verification when the provider uses ownership_verification_http', async () => {
    const admin = makeAdminClient(
      { profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }) },
      { create_custom_domain_atomic: 'd2' }
    );
    vi.mocked(createServerClient).mockReturnValue(admin as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
        if (url.includes('/custom_hostnames')) return jsonRes(CF_HTTP_RESPONSE, 200);
        return jsonRes({ error: 'unexpected' }, 404);
      })
    );

    const res = await handleRequest(
      makeRequest('/api/domains/custom', {
        method: 'POST',
        token: 't',
        body: { hostname: 'careers.example.io' },
      }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      verification: { method: string; record: { http_url?: string; http_body?: string } | null };
    };
    expect(body.verification.method).toBe('http');
    expect(body.verification.record?.http_url).toBe(
      'http://careers.example.io/.well-known/acme-challenge/cf-token'
    );
    expect(body.verification.record?.http_body).toBe('cf-http-body-token-9f2c');
  });

  it('maps a provider failure to a safe failed response (no invented instructions)', async () => {
    const admin = makeAdminClient(
      { profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }) },
      { create_custom_domain_atomic: 'd3' }
    );
    vi.mocked(createServerClient).mockReturnValue(admin as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
        if (url.includes('/custom_hostnames'))
          return jsonRes({ errors: [{ message: 'boom' }] }, 500);
        return jsonRes({ error: 'unexpected' }, 404);
      })
    );

    const res = await handleRequest(
      makeRequest('/api/domains/custom', {
        method: 'POST',
        token: 't',
        body: { hostname: 'careers.example.io' },
      }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { status: string; error: string };
    expect(body.status).toBe('failed');
    expect(body.error).toBe('Domain provider is temporarily unavailable. Please retry.');
  });
});

describe('POST /api/domains/custom/refresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');
  });

  it('updates pending_validation -> active with the provider state + SSL', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const domainBuilder = chainable({ rows: [DOMAIN_ROW], error: null });
    domainBuilder.update = vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return domainBuilder;
    });
    const admin = {
      from: vi.fn((table: string) =>
        table === 'custom_domains'
          ? domainBuilder
          : chainable({ rows: [{ id: 'profile-A' }], error: null })
      ),
      rpc: vi.fn(),
    };
    vi.mocked(createServerClient).mockReturnValue(admin as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
        if (url.includes('/custom_hostnames/cf-hostname-1'))
          return jsonRes(CF_ACTIVE_RESPONSE, 200);
        return jsonRes({ error: 'unexpected' }, 404);
      })
    );

    const res = await handleRequest(
      makeRequest('/api/domains/custom/refresh', {
        method: 'POST',
        token: 't',
        body: { id: 'd1' },
      }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      status: string;
      sslStatus: string | null;
      verification: { type?: string } | null;
    };
    expect(body.status).toBe('active');
    expect(body.sslStatus).toBe('active');
    expect(body.verification).toBeNull(); // TXT no longer required once active

    // The DB update carried the provider's OWN state (no invented values).
    expect(updates.length).toBeGreaterThan(0);
    const last = updates[updates.length - 1];
    expect(last.status).toBe('active');
    expect(last.ssl_status).toBe('active');
  });

  it("404s for another user's domain id (cross-user access denied)", async () => {
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
      custom_domains: () => ({ rows: [], error: null }), // ownership filter excludes it
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await handleRequest(
      makeRequest('/api/domains/custom/refresh', {
        method: 'POST',
        token: 't',
        body: { id: 'someone-elses-domain' },
      }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Domain not found');
  });

  it('fails safely when the provider lookup fails (no state mutation)', async () => {
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
      custom_domains: () => ({ rows: [DOMAIN_ROW], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
        if (url.includes('/custom_hostnames')) return jsonRes({}, 502);
        return jsonRes({ error: 'unexpected' }, 404);
      })
    );

    const res = await handleRequest(
      makeRequest('/api/domains/custom/refresh', {
        method: 'POST',
        token: 't',
        body: { id: 'd1' },
      }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Provider lookup failed');
  });
});

describe('POST /api/domains/custom/remove', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');
  });

  it('removes the provider resource then marks the row removed', async () => {
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
      custom_domains: () => ({ rows: [DOMAIN_ROW], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
        if (url.includes('/custom_hostnames/cf-hostname-1'))
          return new Response(null, { status: 204 });
        return jsonRes({ error: 'unexpected' }, 404);
      })
    );

    const res = await handleRequest(
      makeRequest('/api/domains/custom/remove', { method: 'POST', token: 't', body: { id: 'd1' } }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: boolean };
    expect(body.removed).toBe(true);
  });

  it("404s for another user's domain id (ownership enforced on remove)", async () => {
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
      custom_domains: () => ({ rows: [], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await handleRequest(
      makeRequest('/api/domains/custom/remove', {
        method: 'POST',
        token: 't',
        body: { id: 'not-yours' },
      }),
      DOMAINS_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(404);
  });
});
