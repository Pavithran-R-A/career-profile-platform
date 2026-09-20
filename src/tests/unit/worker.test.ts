import { describe, it, expect } from 'vitest';
import { handleRequest } from '../../workers/handler';

function makeRequest(path: string, method = 'GET', origin?: string): Request {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  return new Request(`https://example.com${path}`, { method, headers });
}

describe('Worker API handler', () => {
  it('GET /api/health returns 200 with status ok', () => {
    const res = handleRequest(makeRequest('/api/health'), {}, {} as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown routes', () => {
    const res = handleRequest(makeRequest('/api/unknown'), {}, {} as ExecutionContext);
    expect(res.status).toBe(404);
  });

  it('handles CORS preflight', () => {
    const res = handleRequest(
      makeRequest('/api/health', 'OPTIONS', 'https://test.com'),
      {},
      {} as ExecutionContext
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://test.com');
  });
});
