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
    it('handles OPTIONS preflight', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'https://test.com'),
        {},
        {} as ExecutionContext
      );
      expect(res.status).toBe(204);
    });

    it('sets Access-Control-Allow-Origin for credentialed requests', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'GET', 'https://test.com'),
        {},
        {} as ExecutionContext
      );
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://test.com');
    });

    it('sets allowed methods', async () => {
      const res = await handleRequest(
        makeRequest('/api/health', 'OPTIONS', 'https://test.com'),
        {},
        {} as ExecutionContext
      );
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });
  });
});
