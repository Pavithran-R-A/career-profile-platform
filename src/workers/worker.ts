import { handleRequest } from './handler';

interface Env {
  ASSETS: Fetcher;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleRequest(request, env as unknown as Record<string, string>, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
