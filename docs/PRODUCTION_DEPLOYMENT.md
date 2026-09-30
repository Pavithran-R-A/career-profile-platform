# Production Deployment

How the app ships to Cloudflare Workers, and how the stable preview is updated in place.

## Architecture

- `pnpm build` runs `tsc -b && vite build`. The Cloudflare Vite plugin produces:
  - `dist/client/` — static SPA (`index.html` + `assets/`)
  - `dist/career_profile_platform/` — bundled worker (`index.js`) plus a generated `wrangler.json` that merges the repo `wrangler.toml` (assets dir `../client`, `run_worker_first`, rate-limit bindings).
- The worker (`src/workers/worker.ts` + `src/workers/handler.ts`) serves the assets with `not_found_handling = "single-page-app"` and runs before static serving for (see `wrangler.toml`):
  - `/api/*` — JSON API (auth helpers, billing, domains, resume, recruiter AI) with error sanitizer + `X-Request-Id`
  - `/` and `/pricing` — SEO meta injection (canonical, OG, Twitter) with absolute URLs
  - `/u/*` — published-profile meta + ProfilePage JSON-LD, or noindex for unpublished/unknown
  - `/sitemap.xml` — public pages + published profiles (publishable key only)
  - `/robots.txt` — allow public, disallow app routes, absolute sitemap ref
- Recruiter AI is protected by the native Cloudflare rate-limit binding `RECRUITER_RATE_LIMITER` (30 requests / 60 s; configured in `wrangler.toml`, namespace `1001`). Keys are HMAC(RATE_LIMIT_KEY_SECRET, username|ip|rotatingMinute) — raw IPs are never stored or logged. Without `RATE_LIMIT_KEY_SECRET` the documented fallback keys on profile identity + rotating period (coarser under shared NAT, still profile-specific). It is a transport guard, not a product quota.

## Environment variables

Full reference: `.env.example`. Resolution in the worker (`getEnvValue`) falls back from each key to its `VITE_`-prefixed name, so one `.env.local` works for the client build and the worker.

| Key                                                                                                                                     | Needed for                                | Required                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                                                                                    | everything (client + worker public reads) | yes                                                                                                                                                        |
| `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)                                                                                  | service-role operations                   | no in beta                                                                                                                                                 |
| `BHARATCODE_API_KEY`                                                                                                                    | CV extraction + recruiter AI              | no — routes answer 503 `AI extraction is not configured` until set                                                                                         |
| `RAZORPAY_*`                                                                                                                            | billing                                   | no — billing shows a truthful disabled state                                                                                                               |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_STATE_SECRET`, `GITHUB_APP_SLUG` | GitHub integration                        | no — integration truthfully reports "not configured" until the signing identity and slug are set; no webhook endpoint exists, so no webhook secret is used |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`                                                                   | custom domains (Workers for SaaS)         | no — disabled                                                                                                                                              |
| `DOTCV_*`                                                                                                                               | `.cv` domain provider                     | no — off by default                                                                                                                                        |
| `ENVIRONMENT`                                                                                                                           | worker behavior                           | set in `wrangler.toml` (`production` / `preview` via `[previews.vars]`)                                                                                    |

Secrets are never written into `dist/`; only `VITE_`-prefixed values are visible to browser code.

## Local development

- `pnpm dev` — Vite dev server; the Cloudflare plugin runs the worker locally, so API routes and server-rendered metadata behave like production (port 5173, strict).
- `pnpm preview` (or `pnpm exec vite preview --port 4173`) — serves the production build with the worker; this is what the E2E suite runs against.
- Local worker env: the plugin copies `.env.local` into `dist/career_profile_platform/.dev.vars` at build time.

## Stable preview (in-place update)

Stable URL: <https://core-qualification-career-profile-platform.memrae-staging.workers.dev>

This is a **named preview deployment** (`core-qualification`) of the worker
`career-profile-platform` on the account subdomain `memrae-staging`
(`wrangler preview`, open beta). Re-deploying with the same name keeps the URL
unchanged — do not create a new preview name.

```bash
pnpm build
npx wrangler preview \
  --name core-qualification \
  --worker-name career-profile-platform \
  --config dist/career_profile_platform/wrangler.json \
  --secrets-file .env.local \
  --message "<what changed>"
```

- `--secrets-file .env.local` is required: the preview has no base-config secrets, so every deployment must carry the keys again (uploads are additive; omitted secrets are preserved).
- The generated `dist/career_profile_platform/wrangler.json` is the canonical deploy config (assets `../client`, SPA fallback, `run_worker_first`, rate limits). Do not deploy the root `wrangler.toml` directly — its `assets.directory` is overridden by the plugin output.
- Production URL (separate from the preview): `career-profile-platform.memrae-staging.workers.dev`, via
  `npx wrangler deploy -c dist/career_profile_platform/wrangler.json --secrets-file .env.local`.

## Post-deploy verification

1. `GET /` — 200; correct `<title>`; SSR meta present (`og:title`, `og:image` with absolute URL, canonical).
2. `GET /robots.txt`, `GET /sitemap.xml` — 200, absolute URLs on the deployed origin.
3. `GET /u/<published-username>` — 200 + ProfilePage JSON-LD; unknown username → `noindex` + 404-style meta.
4. `POST /api/recruiter/ask` — 401 `UNAUTHORIZED` without a session; 429 `TOO_MANY_REQUESTS` past 30 calls/min per IP (anti-abuse limiter, includes `Retry-After`) and 429 `RATE_LIMITED` when the profile owner's daily plan quota is exhausted; 503 `AI_NOT_CONFIGURED` while no AI key is set.
5. Locally: `pnpm test:e2e` (Playwright + system Chrome, desktop + Pixel 7) and the full unit gate `npx vitest run --maxWorkers=2`.

## Rollback

- Production: `npx wrangler deployments list --name career-profile-platform`, then `npx wrangler deployments rollback` (or redeploy a previous `dist/`).
- Preview: redeploy the previous `dist/career_profile_platform` + `dist/client` with the same `--name core-qualification`; the URL stays constant.
