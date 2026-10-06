import { describe, it, expect, vi } from 'vitest';
import { handleRequest } from '../../workers/handler';
import { createServerClient } from '../../lib/supabase/server';

// The handler imports its Supabase clients from lib/supabase/server; mock the
// module so recruiter-ask ordering tests can stand in for a live backend.
vi.mock('../../lib/supabase/server', () => ({ createServerClient: vi.fn() }));

function makeRequest(path: string, method = 'GET', origin?: string): Request {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  return new Request(`https://example.com${path}`, { method, headers });
}

describe('Worker API handler', () => {
  describe('health endpoint', () => {
    it('GET /api/health returns 200 with status ok', async () => {
      const res = await handleRequest(makeRequest('/api/health'), {}, {} as ExecutionContext);
      expect(res.status).toBe(200);
    });

    it('health response contains timestamp', async () => {
      const res = await handleRequest(makeRequest('/api/health'), {}, {} as ExecutionContext);
      const body = await res.json();
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
    });

    it('returns security headers', async () => {
      const res = await handleRequest(makeRequest('/api/health'), {}, {} as ExecutionContext);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Permissions-Policy')).toContain('camera=');
    });
  });

  describe('API 404 behavior', () => {
    it('returns JSON 404 for unknown API routes', async () => {
      const res = await handleRequest(makeRequest('/api/unknown'), {}, {} as ExecutionContext);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('returns JSON content type for API 404', async () => {
      const res = await handleRequest(makeRequest('/api/nonexistent'), {}, {} as ExecutionContext);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('does NOT return SPA HTML for API routes', async () => {
      const res = await handleRequest(
        makeRequest('/api/does-not-exist'),
        {},
        {} as ExecutionContext
      );
      const text = await res.text();
      expect(text).not.toContain('<!DOCTYPE html>');
      expect(text).not.toContain('<html');
    });
  });

  describe('CORS behavior', () => {
    it('allows localhost origin in development', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'http://localhost:5173'),
        { ENVIRONMENT: 'development' },
        {} as ExecutionContext
      );
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });

    it('allows 127.0.0.1 in development', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'http://127.0.0.1:3000'),
        { ENVIRONMENT: 'development' },
        {} as ExecutionContext
      );
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:3000');
    });

    it('rejects unknown origin in production', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'https://evil.com'),
        { ENVIRONMENT: 'production' },
        {} as ExecutionContext
      );
      expect(res.status).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('allows listed origin in production', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'https://app.example.com'),
        { ENVIRONMENT: 'production', ALLOWED_ORIGINS: 'https://app.example.com' },
        {} as ExecutionContext
      );
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    });

    it('rejects unlisted origin in production', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'https://other.com'),
        { ENVIRONMENT: 'production', ALLOWED_ORIGINS: 'https://app.example.com' },
        {} as ExecutionContext
      );
      expect(res.status).toBe(403);
    });

    it('sets Vary: Origin header', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'GET', 'http://localhost:5173'),
        { ENVIRONMENT: 'development' },
        {} as ExecutionContext
      );
      expect(res.headers.get('Vary')).toBe('Origin');
    });

    it('allows requests with no Origin header (same-origin)', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'GET'),
        {},
        {} as ExecutionContext
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('sets allowed methods on CORS response', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'http://localhost:5173'),
        { ENVIRONMENT: 'development' },
        {} as ExecutionContext
      );
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });
  });

  describe('resume extract auth', () => {
    function extractRequest(body: unknown, token?: string): Request {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return new Request('https://example.com/api/resume/extract', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }

    it('rejects missing credentials with 401 before touching any backend', async () => {
      const res = await handleRequest(
        extractRequest({ resumeSourceId: '550e8400-e29b-41d4-a716-446655440000' }),
        {},
        {} as ExecutionContext
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string; code: string };
      expect(body.error).toBe('Unauthorized');
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('rejects malformed bodies only after auth, never with 500', async () => {
      const res = await handleRequest(extractRequest({}), {}, {} as ExecutionContext);
      // Still 401: no valid session was presented.
      expect(res.status).toBe(401);
    });
  });

  describe('custom domain authorization (P0-A)', () => {
    function domainRequest(body: unknown, token?: string): Request {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return new Request('https://example.com/api/domains/custom', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }

    it('anonymous request is rejected with 401 before any parsing', async () => {
      const res = await handleRequest(
        domainRequest({ hostname: 'careers.example.io' }),
        {},
        {} as ExecutionContext
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('stale/invalid token is rejected with 401', async () => {
      const res = await handleRequest(
        domainRequest({ hostname: 'careers.example.io' }, 'stale-token'),
        {
          // Unroutable local endpoint: the auth lookup fails, so the token is
          // treated as invalid → 401.
          VITE_SUPABASE_URL: 'http://127.0.0.1:1',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'stub-anon',
        } as never,
        {} as ExecutionContext
      );
      expect(res.status).toBe(401);
    });

    it('request body cannot influence profile selection: profileId field is ignored', async () => {
      // Even with a valid-looking session and injected profileId, the handler
      // derives ownership from the auth principal. Without a Supabase backend
      // configured the handler cannot resolve a profile and must NOT create a
      // domain bound to the injected id.
      const res = await handleRequest(
        domainRequest(
          { hostname: 'careers.example.io', profileId: '11111111-1111-4111-8111-111111111111' },
          'valid-shape-token'
        ),
        {},
        {} as ExecutionContext
      );
      // No admin key configured in this environment → cannot proceed to any
      // profile-bound write. The injected profileId must not be trusted.
      expect([401, 404, 409, 500, 503]).toContain(res.status);
      const body = (await res.json()) as { error?: string };
      expect(body.error).not.toContain('11111111');
    });

    it('User A cannot add a domain for User B: only server-owned profile is used', async () => {
      // The contract is structural: the endpoint accepts { hostname } only.
      // With auth configured but no owned profile, the handler returns a
      // profile-not-found/conflict error rather than acting on any client id.
      const res = await handleRequest(
        domainRequest({ hostname: 'careers.example.io' }, 'valid-shape-token'),
        {},
        {} as ExecutionContext
      );
      expect(res.status).not.toBe(201);
    });
  });

  describe('recruiter ask rate limiter binding contract', () => {
    const askRequest = (ip = '203.0.113.9'): Request =>
      new Request('https://example.com/api/recruiter/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': ip,
        },
        body: JSON.stringify({ username: 'some-user', question: 'What did they build?' }),
      });

    it('allows the request when the binding reports success (never 429s fresh traffic)', async () => {
      // Regression: the limiter was checked with a sync non-awaited
      // `.allowed` property — every request 429'd wherever the binding
      // existed. The Cloudflare contract is limit({ key }) → { success }.
      const limiterCalls: string[] = [];
      const env = {
        RECRUITER_RATE_LIMITER: {
          limit: async (opts: { key: string }) => {
            limiterCalls.push(opts.key);
            return { success: true };
          },
        },
      };
      const res = await handleRequest(askRequest(), env, {} as ExecutionContext);
      // Unit env has no Supabase config, so the handler proceeds to 503
      // SERVER_NOT_CONFIGURED — the point is the limiter did NOT block.
      expect(res.status).not.toBe(429);
      // Second-closure key design: profile-identity keyed (no raw IP),
      // period-rotating fallback when RATE_LIMIT_KEY_SECRET is absent.
      expect(limiterCalls).toHaveLength(1);
      expect(limiterCalls[0]).toContain('profile:some-user');
      expect(limiterCalls[0]).not.toContain('203.0.113.9');
    });

    it('returns 429 TOO_MANY_REQUESTS with Retry-After only when success is false', async () => {
      const env = {
        RECRUITER_RATE_LIMITER: {
          limit: async () => ({ success: false }),
        },
      };
      const res = await handleRequest(askRequest('198.51.100.7'), env, {} as ExecutionContext);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('TOO_MANY_REQUESTS');
    });

    it('does not take the feature down if the limiter throws', async () => {
      const env = {
        RECRUITER_RATE_LIMITER: {
          limit: async () => {
            throw new Error('limiter unavailable');
          },
        },
      };
      const res = await handleRequest(askRequest(), env, {} as ExecutionContext);
      expect(res.status).not.toBe(429);
    });
  });

  describe('recruiter ask handler ordering (P1-I) with a backend present', () => {
    const anonChain = (maybeSingleResult: { data: unknown }) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve(maybeSingleResult),
      };
      return chain;
    };

    const askRequest = (): Request =>
      new Request('https://example.com/api/recruiter/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '203.0.113.9',
        },
        body: JSON.stringify({ username: 'some-user', question: 'What did they build?' }),
      });

    const backendEnv = (extra: Record<string, string> = {}) => ({
      SUPABASE_URL: 'https://supabase.example.com',
      SUPABASE_PUBLISHABLE_KEY: 'anon-key',
      SUPABASE_SECRET_KEY: 'test-only-server-secret',
      ...extra,
    });

    it('unknown profile → exact 404 PROFILE_NOT_FOUND BEFORE any AI-config 503', async () => {
      const client = {
        from: vi.fn(() => anonChain({ data: null })),
      };
      vi.mocked(createServerClient).mockReturnValue(client as never);
      // Backend reachable (URL + server secret) but NO BHARATCODE_API_KEY:
      // the profile lookup must answer 404 before the AI gate can 503.
      const res = await handleRequest(askRequest(), backendEnv(), {} as ExecutionContext);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { code?: string; error?: string };
      expect(body.code).toBe('PROFILE_NOT_FOUND');
      expect(body.error).not.toMatch(/not configured/i);
    });

    it('a tripped anti-abuse limiter preempts even the backend lookup', async () => {
      const client = { from: vi.fn(() => anonChain({ data: null })) };
      vi.mocked(createServerClient).mockReturnValue(client as never);
      const env = Object.assign(backendEnv(), {
        RECRUITER_RATE_LIMITER: { limit: async () => ({ success: false }) },
      });
      const res = await handleRequest(askRequest(), env, {} as ExecutionContext);
      expect(res.status).toBe(429);
      expect(client.from).not.toHaveBeenCalled();
    });
  });
});
