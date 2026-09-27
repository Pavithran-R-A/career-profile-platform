import { handleRequest } from './handler';
import { handleHtmlPage, handleRobots, handleSitemap, isHtmlPagePath } from './seo';

interface Env {
  ASSETS: Fetcher;
  [key: string]: unknown;
}

/**
 * Structured request logging: one JSON line per request with safe fields
 * only (method, path without query, status class, duration, request id,
 * environment). Never logs bodies, headers, tokens, or user content.
 */
function logRequest(
  ctx: ExecutionContext,
  entry: {
    id: string;
    method: string;
    path: string;
    status: number;
    dur: number;
    environment: string;
    code?: string;
  }
): void {
  ctx.waitUntil(
    Promise.resolve()
      .then(() => {
        console.log(JSON.stringify({ t: 'request', ...entry }));
      })
      .catch(() => {
        // Logging must never break the response path.
      })
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const started = Date.now();
    const envRecord = env as unknown as Record<string, string>;
    const environment = envRecord.ENVIRONMENT || '';

    const log = (status: number, code?: string): void => {
      logRequest(ctx, {
        id: requestId,
        method: request.method,
        path: url.pathname,
        status,
        dur: Date.now() - started,
        environment,
        code,
      });
    };

    try {
      let response: Response;

      if (url.pathname.startsWith('/api/')) {
        response = await handleRequest(request, envRecord, ctx, requestId);
      } else if (url.pathname === '/sitemap.xml') {
        response = await handleSitemap(request, envRecord);
      } else if (url.pathname === '/robots.txt') {
        response = handleRobots(request);
      } else if (isHtmlPagePath(url.pathname)) {
        response = await handleHtmlPage(request, env.ASSETS, envRecord);
      } else {
        response = await env.ASSETS.fetch(request);
      }

      response.headers.set('X-Request-Id', requestId);
      log(response.status);
      return response;
    } catch {
      const code = 'INTERNAL';
      log(500, code);
      console.error(JSON.stringify({ t: 'request_error', id: requestId, code }));
      return new Response(JSON.stringify({ error: 'Internal server error', code, requestId }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
