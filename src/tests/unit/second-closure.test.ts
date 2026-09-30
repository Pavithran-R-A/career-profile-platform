// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { handleRequest } from '../../workers/handler';
import { createServerClient } from '../../lib/supabase/server';

vi.mock('../../lib/supabase/server', () => ({ createServerClient: vi.fn() }));

// ─── Helpers ───────────────────────────────────────────────────

type Json = Record<string, unknown>;

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Minimal thenable chain builder supporting the patterns handler.ts uses. */
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

/** A mock admin client whose per-table responses are programmable. */
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

// verifyAuth in handler uses SUPABASE_URL + publishable key fetch to
// /auth/v1/user; make it succeed with a fixed userId for authenticated flows.
function mockAuthUser(userId: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/auth/v1/user')) {
        return jsonRes({ id: userId });
      }
      return jsonRes({ error: 'unexpected' }, 404);
    })
  );
}

const AUTH_ENV = {
  SUPABASE_URL: 'https://sb.example.com',
  SUPABASE_SECRET_KEY: 'test-only-admin-key-not-a-real-secret',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

// ─── 1. Feature flags: missing flag = disabled, even in production ──────

describe('feature flags are explicit opt-in', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');
  });

  it('POST /api/billing/order is 503 in production when BILLING_ENABLED is absent', async () => {
    const res = await handleRequest(
      makeRequest('/api/billing/order', {
        method: 'POST',
        token: 'tok',
      }),
      { ...AUTH_ENV, ENVIRONMENT: 'production' } as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as Json;
    expect(body.code).toBe('FEATURE_DISABLED');
  });

  it('POST /api/domains/custom is 503 in production when DOMAINS_ENABLED is absent', async () => {
    const res = await handleRequest(
      makeRequest('/api/domains/custom', {
        method: 'POST',
        token: 'tok',
        body: { hostname: 'x.example.io' },
      }),
      { ...AUTH_ENV, ENVIRONMENT: 'production' } as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(503);
  });

  it('explicit false disables even in production', async () => {
    const res = await handleRequest(
      makeRequest('/api/billing/order', { method: 'POST', token: 'tok' }),
      { ...AUTH_ENV, ENVIRONMENT: 'production', BILLING_ENABLED: 'false' } as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(503);
  });
});

// ─── 2. GitHub endpoints: auth + config-truthfulness ────────────────────

describe('github config endpoint', () => {
  it('reports configured=false without any GITHUB_* env', async () => {
    const res = await handleRequest(
      makeRequest('/api/github/config'),
      { ENVIRONMENT: 'production' } as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;
    expect(body.configured).toBe(false);
    expect(body.installUrl).toBeNull();
  });

  it('builds the install URL only from a COMPLETE Flow-A configuration', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const full = {
      GITHUB_APP_ID: '12345',
      GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      GITHUB_APP_CLIENT_ID: 'Iv1_cid',
      GITHUB_APP_CLIENT_SECRET: 'cs',
      GITHUB_STATE_SECRET: 'state-secret',
      GITHUB_APP_SLUG: 'test-app',
    };
    const res = await handleRequest(
      makeRequest('/api/github/config'),
      full as never,
      {} as ExecutionContext
    );
    const body = (await res.json()) as Json;
    expect(body.configured).toBe(true);
    expect(body.installUrl).toBe('https://github.com/apps/test-app/installations/new');

    // A partial configuration (missing ANY of the six) must NOT look ready:
    // the dashboard shows no Install button when OAuth cannot complete.
    for (const key of Object.keys(full)) {
      const partial = { ...full, [key]: undefined } as Record<string, unknown>;
      const partialRes = await handleRequest(
        makeRequest('/api/github/config'),
        partial as never,
        {} as ExecutionContext
      );
      const partialBody = (await partialRes.json()) as Json;
      expect(partialBody.configured, `missing ${key} must not be configured`).toBe(false);
      expect(partialBody.installUrl).toBeNull();
    }
  });
});

// ─── 3. Evidence publish toggle: ownership + private-repo denial ────────

describe('POST /api/github/evidence/:id/public', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');
    vi.mocked(createServerClient).mockClear();
  });

  it('requires auth', async () => {
    const res = await handleRequest(
      makeRequest('/api/github/evidence/00000000-0000-0000-0000-000000000001/public', {
        method: 'POST',
        body: { value: true },
      }),
      AUTH_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(401);
  });

  it('404s for an evidence row the caller does not own (cross-user denial)', async () => {
    const admin = makeAdminClient({
      // profiles lookup → user's own profile
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
      // evidence row belongs to another profile
      profile_evidence: () => ({
        rows: [{ id: 'ev-1', profile_id: 'profile-B', github_repository_id: 'repo-1' }],
        error: null,
      }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await handleRequest(
      makeRequest('/api/github/evidence/ev-1/public', {
        method: 'POST',
        token: 't',
        body: { value: true },
      }),
      AUTH_ENV as never,
      {} as ExecutionContext
    );
    expect([403, 404]).toContain(res.status);
  });

  it('rejects value≠boolean', async () => {
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await handleRequest(
      makeRequest('/api/github/evidence/10000000-0000-0000-0000-000000000001/public', {
        method: 'POST',
        token: 't',
        body: { value: 'yes' },
      }),
      AUTH_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(400);
  });
});

// ─── 3b. Flow A: OAuth-during-install callback contract ─────────────────

describe('POST /api/github/callback (Flow A: code + state, no installation id)', () => {
  // The App-JWT cross-check really signs, so provide a real RSA key.
  const { privateKey: rsaKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const CALLBACK_ENV = {
    ...AUTH_ENV,
    GITHUB_APP_ID: '12345',
    GITHUB_APP_CLIENT_ID: 'Iv1_cid',
    GITHUB_APP_CLIENT_SECRET: 'cs',
    GITHUB_APP_PRIVATE_KEY: rsaKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    GITHUB_STATE_SECRET: 'state-secret',
    GITHUB_APP_SLUG: 'test-app',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');
  });

  function githubFlowStubs(options: {
    exchangeOk?: boolean;
    installations?: unknown[] | null;
    installationsStatus?: number;
    appJwtStatus?: number;
  }) {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
      if (url.startsWith('https://github.com/login/oauth/access_token')) {
        return options.exchangeOk === false
          ? jsonRes({ error: 'bad_verification_code' })
          : jsonRes({ access_token: 'ghu_t' });
      }
      if (url.startsWith('https://api.github.com/user/installations')) {
        if (options.installationsStatus) return jsonRes({}, options.installationsStatus);
        return jsonRes({ installations: options.installations ?? [] });
      }
      if (url.includes('/app/installations/')) {
        return jsonRes(
          { id: 42, account: { login: 'octocat', id: 7, type: 'User' } },
          options.appJwtStatus ?? 200
        );
      }
      return jsonRes({ error: 'unexpected' }, 404);
    });
  }

  async function callCallback(body: unknown, env = CALLBACK_ENV): Promise<Response> {
    return handleRequest(
      makeRequest('/api/github/callback', { method: 'POST', token: 't', body }),
      env as never,
      {} as ExecutionContext
    );
  }

  it('succeeds with code + state and NO installation_id (Flow A)', async () => {
    vi.stubGlobal(
      'fetch',
      githubFlowStubs({
        installations: [
          {
            id: 42,
            account: { login: 'octocat', id: 7, type: 'User' },
            app_slug: 'test-app',
          },
        ],
      })
    );
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const state = createSignedState('user-1', resolveGitHubConfig(CALLBACK_ENV));

    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
      github_connections: () => ({ rows: [], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await callCallback({ code: 'c', state });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected?: boolean };
    expect(body.connected).toBe(true);
    // Persisted by github_repo id 42 — resolved from GitHub, not the browser.
    const upsertCall = admin.from.mock.calls.find((c: unknown[]) => c[0] === 'github_connections');
    expect(upsertCall).toBeTruthy();
  });

  it('missing code fails safely', async () => {
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const state = createSignedState('user-1', resolveGitHubConfig(CALLBACK_ENV));
    const res = await callCallback({ state });
    expect(res.status).toBe(400);
  });

  it('missing state fails', async () => {
    const res = await callCallback({ code: 'c' });
    expect(res.status).toBe(400);
  });

  it('invalid state fails', async () => {
    const res = await callCallback({ code: 'c', state: 'garbage.state' });
    expect(res.status).toBe(400);
  });

  it('expired state fails', async () => {
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const config = resolveGitHubConfig(CALLBACK_ENV);
    const state = createSignedState('user-1', config);
    // Travel past the 10-minute TTL.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60_000);
    try {
      const res = await callCallback({ code: 'c', state });
      expect(res.status).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a state minted for User B cannot be used by User A (cross-user denial)', async () => {
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const state = createSignedState('user-2', resolveGitHubConfig(CALLBACK_ENV));
    const res = await callCallback({ code: 'c', state });
    expect(res.status).toBe(400);
  });

  it('replayed/invalid code maps to 502 (exchange failed)', async () => {
    vi.stubGlobal('fetch', githubFlowStubs({ exchangeOk: false }));
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const state = createSignedState('user-1', resolveGitHubConfig(CALLBACK_ENV));
    const res = await callCallback({ code: 'replayed', state });
    expect(res.status).toBe(502);
  });

  it('a GitHub user with NO installation of this app gets 404 and no connection row', async () => {
    vi.stubGlobal('fetch', githubFlowStubs({ installations: [] }));
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const state = createSignedState('user-1', resolveGitHubConfig(CALLBACK_ENV));
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await callCallback({ code: 'c', state });
    expect(res.status).toBe(404);
    expect(admin.from.mock.calls.some((c: unknown[]) => c[0] === 'github_connections')).toBe(false);
  });

  it('multiple eligible installations → selection_required, never a silent guess', async () => {
    vi.stubGlobal(
      'fetch',
      githubFlowStubs({
        installations: [
          {
            id: 42,
            account: { login: 'octocat', id: 7, type: 'User' },
            app_slug: 'test-app',
          },
          {
            id: 99,
            account: { login: 'org-1', id: 55, type: 'Organization' },
            app_slug: 'test-app',
          },
        ],
      })
    );
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const state = createSignedState('user-1', resolveGitHubConfig(CALLBACK_ENV));
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await callCallback({ code: 'c', state });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      installations?: Array<{ installationId: number; selectionToken: string }>;
    };
    expect(body.status).toBe('selection_required');
    expect(body.installations?.map((i) => i.installationId).sort()).toEqual([42, 99]);
    expect(body.installations?.every((i) => i.selectionToken.length > 0)).toBe(true);
    // No connection was persisted during the multiple case.
    expect(admin.from.mock.calls.some((c: unknown[]) => c[0] === 'github_connections')).toBe(false);
  });

  it('a spoofed installation id in the callback body is ignored entirely', async () => {
    vi.stubGlobal(
      'fetch',
      githubFlowStubs({
        installations: [
          {
            id: 42,
            account: { login: 'octocat', id: 7, type: 'User' },
            app_slug: 'test-app',
          },
        ],
      })
    );
    const { createSignedState } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const state = createSignedState('user-1', resolveGitHubConfig(CALLBACK_ENV));
    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    // The attacker-supplied installation id must not influence anything; the
    // server connects the installation GitHub itself listed (42).
    const res = await callCallback({ code: 'c', state, installationId: 999999 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { account?: { login?: string } };
    expect(body.account?.login).toBe('octocat');
  });

  it('logged-out callers are 401 before any state or code handling', async () => {
    const res = await handleRequest(
      makeRequest('/api/github/callback', {
        method: 'POST',
        body: { code: 'c', state: 's' },
      }),
      CALLBACK_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(401);
  });

  it('POST /api/github/connect/choose rejects a selection token minted for another user', async () => {
    const { createSelectionToken } = await import('../../lib/github/server');
    const { resolveGitHubConfig } = await import('../../lib/github/config');
    const config = resolveGitHubConfig(CALLBACK_ENV);
    const token = createSelectionToken(42, 'user-2', config); // minted for user-2

    const res = await handleRequest(
      makeRequest('/api/github/connect/choose', {
        method: 'POST',
        token: 't',
        body: { selectionToken: token },
      }),
      CALLBACK_ENV as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(400);
  });
});

// ─── 4. Recruiter rate limit key: HMAC + privacy (unit-level) ───────────

describe('recruiter rate-limit key design', () => {
  it('key is HMAC-derived, period-rotating, and never contains the raw IP', async () => {
    const { createHmac } = await import('node:crypto');
    const username = 'ada';
    const ip = '203.0.113.9';
    const secret = 'rate-limit-secret';
    const period = Math.floor(Date.now() / 60_000);
    const expected = createHmac('sha256', secret)
      .update(`${username}|${ip}|${period}`)
      .digest('hex')
      .slice(0, 32);

    const seenKeys: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        seenKeys.push(key);
        return { success: true };
      },
    };
    const env = {
      ...AUTH_ENV,
      RATE_LIMIT_KEY_SECRET: secret,
      RECRUITER_RATE_LIMITER: limiter,
    };
    // Recruiter ask for an unknown profile → 404 after the limiter ran.
    const admin = makeAdminClient({
      public_profiles: () => ({ rows: [], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const req = new Request('https://example.com/api/recruiter/ask', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        'cf-connecting-ip': ip,
      }),
      body: JSON.stringify({ username, question: 'Who are you?' }),
    });
    const res = await handleRequest(req, env as never, {} as ExecutionContext);
    expect(res.status).toBe(404);
    expect(seenKeys).toHaveLength(1);
    expect(seenKeys[0]).toBe(`h1:${expected}`);
    expect(seenKeys[0]).not.toContain(ip);
  });

  it('fallback (no RATE_LIMIT_KEY_SECRET) still includes profile identity, not raw IP', async () => {
    const seenKeys: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        seenKeys.push(key);
        return { success: true };
      },
    };
    const admin = makeAdminClient({
      public_profiles: () => ({ rows: [], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const req = new Request('https://example.com/api/recruiter/ask', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.9',
      }),
      body: JSON.stringify({ username: 'ada', question: 'Who are you?' }),
    });
    const res = await handleRequest(
      req,
      { ...AUTH_ENV, RECRUITER_RATE_LIMITER: limiter } as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(404);
    expect(seenKeys[0]).toContain('profile:ada');
    expect(seenKeys[0]).not.toContain('203.0.113.9');
  });
});

// ─── 5. Quota refund RPC wiring ─────────────────────────────────────────

describe('recruiter quota refund on provider failure', () => {
  it('calls refund_recruiter_quota when the provider errors after consumption', async () => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');

    // Provider exists but its completion call fails → refund path.
    // maybeSingle-based lookups read `single`.
    const admin = makeAdminClient(
      {
        public_profiles: () => ({
          single: {
            id: 'p1',
            username: 'ada',
            display_name: 'Ada',
            headline: null,
            about: 'about',
            location: null,
            experiences: [],
            education: [],
            skills: [],
            projects: [],
            links: [],
            evidence: [],
            achievements: [],
          },
          error: null,
        }),
        profiles: () => ({ single: { user_id: 'owner-1' }, error: null }),
      },
      { consume_recruiter_quota: 1 }
    );
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    // BHARATCODE key present so we reach provider.complete, which will fail
    // (fetch mock returns a provider error → AI provider 502 → refund).
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/auth/v1/user')) return jsonRes({ id: 'user-1' });
        return jsonRes({ error: { message: 'provider down' } }, 502);
      })
    );

    const req = new Request('https://example.com/api/recruiter/ask', {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username: 'ada', question: 'What have you built?' }),
    });
    await handleRequest(
      req,
      {
        ...AUTH_ENV,
        BHARATCODE_API_KEY: 'k',
        RECRUITER_AI_ENABLED: 'true',
      } as never,
      {} as ExecutionContext
    );

    const rpcNames = admin.rpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(rpcNames).toContain('consume_recruiter_quota');
    expect(rpcNames).toContain('refund_recruiter_quota');
  });
});

// ─── 6. Billing status: canonical usage counts ──────────────────────────

describe('GET /api/billing/status returns canonical usage', () => {
  it('counts variants/repos/domains from their own feature tables', async () => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');

    const admin = makeAdminClient(
      {
        profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
        profile_variants: () => ({ rows: [], error: null, count: 2 }),
        github_connections: () => ({ rows: [{ id: 'conn-1' }], error: null }),
        github_repositories: () => ({ rows: [], error: null, count: 4 }),
        custom_domains: () => ({ rows: [], error: null, count: 1 }),
        usage_counters: () => ({
          single: { count: 3 },
          rows: null,
          error: null,
        }),
        user_subscriptions: () => ({ single: null, rows: null, error: null }),
      },
      {}
    );
    vi.mocked(createServerClient).mockImplementation(((url: string) => {
      void url;
      return admin;
    }) as never);

    const res = await handleRequest(
      makeRequest('/api/billing/status', { token: 't' }),
      { ...AUTH_ENV, BILLING_ENABLED: 'true' } as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      usage: Record<string, { used: number; limit: number }>;
    };
    expect(body.usage.resume_variants.used).toBe(2);
    expect(body.usage.github_repos.used).toBe(4);
    expect(body.usage.custom_domains.used).toBe(1);
  });
});

// ─── 7. Domains: PLATFORM_PROFILE_ORIGIN is required when provisioning ──

describe('custom domain add requires PLATFORM_PROFILE_ORIGIN when provisioning enabled', () => {
  it('503s instead of falling back to a placeholder origin', async () => {
    vi.restoreAllMocks();
    mockAuthUser('user-1');

    const admin = makeAdminClient({
      profiles: () => ({ rows: [{ id: 'profile-A' }], error: null }),
    });
    vi.mocked(createServerClient).mockReturnValue(admin as never);

    const res = await handleRequest(
      makeRequest('/api/domains/custom', {
        method: 'POST',
        token: 't',
        body: { hostname: 'careers.example.io' },
      }),
      {
        ...AUTH_ENV,
        DOMAINS_ENABLED: 'true',
        CLOUDFLARE_API_TOKEN: 'tok',
        CLOUDFLARE_ACCOUNT_ID: 'acct',
        CLOUDFLARE_ZONE_ID: 'zone',
        // PLATFORM_PROFILE_ORIGIN deliberately missing
      } as never,
      {} as ExecutionContext
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as Json;
    expect(body.code).toBe('SERVER_NOT_CONFIGURED');
  });
});
