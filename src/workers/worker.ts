import { handleRequest } from './handler';
import { handleHtmlPage, handleRobots, handleSitemap, isHtmlPagePath } from './seo';

interface Env {
  ASSETS: Fetcher;
  [key: string]: unknown;
}

function documentCsp(nonce: string): string {
  return [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.razorpay.com",
  'frame-src https://*.razorpay.com',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  ].join('; ');
}

function newCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function finalizeResponse(
  response: Response,
  requestId: string,
  environment: string,
  cspNonce: string
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Content-Security-Policy', documentCsp(cspNonce));

  if (environment === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
    const cspNonce = newCspNonce();
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
        response = await handleHtmlPage(request, env.ASSETS, envRecord, cspNonce);
      } else if ((request.headers.get('accept') ?? '').includes('text/html')) {
        // Unknown SPA routes: serve the shell through the same meta pipeline
        // so they get a truthful not-found title + noindex (SEO defect fix).
        response = await handleHtmlPage(request, env.ASSETS, envRecord, cspNonce);
      } else {
        response = await env.ASSETS.fetch(request);
      }

      response = finalizeResponse(response, requestId, environment, cspNonce);
      log(response.status);
      return response;
    } catch {
      const code = 'INTERNAL';
      log(500, code);
      console.error(JSON.stringify({ t: 'request_error', id: requestId, code }));
      return finalizeResponse(
        new Response(JSON.stringify({ error: 'Internal server error', code, requestId }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
        requestId,
        environment,
        cspNonce
      );
    }
  },
};
