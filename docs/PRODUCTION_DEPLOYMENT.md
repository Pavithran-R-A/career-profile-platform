# CVentory Production Deployment

This runbook describes the production release path for CVentory on Cloudflare Workers.

## Verified build layout

`pnpm build` runs `tsc -b && vite build`. The current release pipeline verifies these outputs:

- `dist/client/` — the static React application and lazy-loaded route assets.
- `dist/cventory/` — the bundled Cloudflare Worker.
- `dist/cventory/wrangler.json` — the generated deploy configuration. This is the canonical Cloudflare deploy config.

Do not deploy the root `wrangler.toml` directly. The Cloudflare Vite plugin generates the production asset paths and merged Worker configuration in `dist/cventory/wrangler.json`.

The Worker runs before static assets for:

- `/api/*`
- `/`
- `/pricing`
- `/privacy`
- `/terms`
- `/refund-policy`
- `/contact`
- `/u/*`
- `/sitemap.xml`
- `/robots.txt`

This allows server-visible SEO metadata and security headers to be applied consistently.

## Release gates already enforced by CI

The pull-request pipeline must pass all of these on the exact candidate SHA:

- production dependency audit at `high` severity
- Prettier format check
- ESLint
- TypeScript typecheck
- unit tests
- production build
- bundle budget
- Playwright desktop and mobile E2E

The release branch also contains the Supabase launch-hardening migrations and the audited public-view exception documented in `docs/SECURITY_EXCEPTIONS.md`.

## Environment contract

Start from `.env.example`.

### Required base application values

| Variable                        | Purpose                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Browser and Worker public Supabase URL                                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key                                                  |
| `SUPABASE_SECRET_KEY`           | Server-only privileged operations; preferred over the legacy service-role key |
| `RATE_LIMIT_KEY_SECRET`         | Stable HMAC secret for recruiter anti-abuse keys                              |
| `ALLOWED_ORIGINS`               | Comma-separated production origins accepted by CORS                           |
| `VITE_SUPPORT_EMAIL`            | Public support/privacy/billing contact shown on launch pages                  |

`VITE_SUPPORT_PHONE`, `VITE_OPERATOR_NAME`, and `VITE_OPERATOR_ADDRESS` are optional public contact fields.

### Optional product integrations

Optional external features are explicit opt-ins. Missing or false flags stay disabled even in production.

| Feature        | Enable flag                            | Credentials required before enabling                                                                                                    |
| -------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Recruiter AI   | `RECRUITER_AI_ENABLED=true`            | `BHARATCODE_API_KEY`                                                                                                                    |
| Billing        | `BILLING_ENABLED=true`                 | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`                                                                     |
| GitHub App     | configured automatically when complete | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_STATE_SECRET`, `GITHUB_APP_SLUG` |
| Custom domains | `DOMAINS_ENABLED=true`                 | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, `PLATFORM_PROFILE_ORIGIN`                                        |
| .cv provider   | `DOTCV_ENABLED=true`                   | provider URL/key; purchases additionally require `DOTCV_PURCHASE_ENABLED=true`                                                          |

Never enable a feature flag before its full credential set is present and verified.

## Secret handling

- Never commit `.env.local`, private keys, API secrets, or service-role credentials.
- Only `VITE_*` values are intentionally visible to browser code.
- `SUPABASE_SECRET_KEY`, Razorpay secrets, GitHub private keys/secrets, Cloudflare tokens, AI keys, and rate-limit secrets are server-only.
- Rotate a secret immediately if it appears in a commit, issue, log, screenshot, or public chat.

## Pre-domain production preparation

These steps can be completed before selecting the final public domain:

1. Confirm the release PR is green on its exact head SHA.
2. Confirm the Supabase project is healthy and all checked-in migrations are applied.
3. Configure `SUPABASE_SECRET_KEY` on the production Worker. The release Worker requires it for server-only public-profile, sitemap, SEO, recruiter, deletion, billing, GitHub, and domain operations.
4. Keep the current owner-rights public views unchanged until the release Worker is deployed; see `docs/SECURITY_EXCEPTIONS.md`.
5. Configure a strong Supabase Auth password policy in Authentication settings.
6. Configure production SMTP before relying on auth email delivery at public scale.
7. Create/verify external provider credentials for only the features intended at launch.
8. Leave feature flags false for integrations that are not fully configured.
9. Prepare Cloudflare Worker secrets/vars without committing them.

Supabase leaked-password protection is a paid-plan feature. If the project remains on a plan that does not provide it, the advisor warning is expected; do not fake or suppress the finding.

## Domain-dependent final stage

Domain selection is intentionally last. After the production domain is chosen:

1. Set `ALLOWED_ORIGINS` to the exact HTTPS production origin(s).
2. Set `VITE_SUPPORT_EMAIL` to the final public support address and rebuild.
3. Set `PLATFORM_PROFILE_ORIGIN` and `PUBLIC_BASE_HOST` if platform/custom profile domains are enabled.
4. Set the Supabase Auth Site URL to the final production origin.
5. Add only the required Supabase redirect URLs for:
   - auth callback
   - email verification
   - password reset
   - GitHub callback, if the GitHub App launches
6. Update the GitHub App homepage/callback URLs if GitHub integration launches.
7. Configure Cloudflare DNS/routes/custom hostnames.
8. Rebuild after all `VITE_*` public values are final.
9. Deploy and smoke-test `GET /api/public/profile/<published-username>` while the old view grants still exist.
10. Apply `20261004154500_server_only_public_views.sql` only after that Worker smoke test succeeds.
11. Re-run the public-profile smoke test plus the Supabase security advisors; the three `security_definer_view` findings must be gone.
12. Run the remaining live smoke checks below.

## Build and deploy

With the final production environment available locally to Wrangler:

```bash
pnpm install --frozen-lockfile
pnpm build
npx wrangler deploy \
  --config dist/cventory/wrangler.json \
  --secrets-file .env.local \
  --message "CVentory production release"
```

The Worker name comes from the generated configuration and release `wrangler.toml` (`cventory`). Avoid overriding it with the legacy `career-profile-platform` name.

## Post-deploy smoke checks

Verify against the actual production origin:

1. `GET /` returns 200 with the CVentory title, canonical, Organization/WebSite JSON-LD, absolute Open Graph image, CSP, `nosniff`, frame denial, referrer policy, permissions policy, and HSTS.
2. `GET /og-cover.png` returns the generated 1200×630 CVentory social image.
3. `GET /privacy`, `/terms`, `/refund-policy`, and `/contact` return 200 with correct canonicals.
4. `GET /robots.txt` and `GET /sitemap.xml` return 200 with the production origin.
5. A published `/u/<username>` returns public profile metadata; an unknown/unpublished username returns noindex metadata.
6. Anonymous database/API access cannot read private base tables.
7. `POST /api/recruiter/ask` rejects unauthenticated access and respects both anti-abuse and plan quotas when enabled.
8. Signup, verification, login, forgot-password, reset-password, logout, and account deletion are exercised with a real inbox.
9. If GitHub is enabled, complete a real install/callback/sync/disconnect flow.
10. If billing is enabled, complete Razorpay test-mode checkout/webhook verification before any live-mode transaction.
11. If domains are enabled, validate hostname ownership/provisioning with a non-critical test hostname first.

## Rollback

For the CVentory Worker:

```bash
npx wrangler deployments list --name cventory
npx wrangler deployments rollback --name cventory
```

If a rollback is caused by a database migration, do not blindly reverse production data changes. First classify whether the application can be rolled back while keeping the forward-compatible schema.

## Release rule

Do not merge the release PR or point the final domain at CVentory until:

- the exact head SHA is green;
- required provider credentials are configured;
- production Auth/SMTP settings are verified;
- the final domain-dependent values are set;
- live post-deploy smoke checks pass.
