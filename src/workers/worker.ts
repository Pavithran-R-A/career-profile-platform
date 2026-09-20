import { handleRequest } from './handler';

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    return Promise.resolve(handleRequest(request, env, ctx));
  },
};
