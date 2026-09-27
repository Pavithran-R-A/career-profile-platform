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
});
