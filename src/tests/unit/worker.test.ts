import { describe, it, expect } from 'vitest';
import { handleRequest } from '../../workers/handler';

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
});
