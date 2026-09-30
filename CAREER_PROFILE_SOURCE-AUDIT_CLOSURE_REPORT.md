# CAREER PROFILE SOURCE-AUDIT CLOSURE REPORT

**Repo:** `Pavithran-R-A/career-profile-platform` · **Baseline audited HEAD:** `222f78d` · **Repair branch:** `fix/source-audit-closure` (merged) · **master final:** `b71f2b8`

---

## VERDICT

**PASS WITH EXTERNAL BLOCKERS (code-complete, gate-green, partially live-certified).**

Every confirmed audit defect (P0-A…F, P1-A…I, P2-A…I), the full TEST-DEBT list, docs truth, CI, and entitlements truth were fixed and committed. All gates pass locally: **586/586 unit (54 files), 10/10 integration (live RLS), 58/58 E2E (desktop+mobile), format/lint/typecheck/build/bundle-budget/audit clean**. Live verification on the deployed Worker (`career-profile-platform.memrae-staging.workers.dev`) proved the marquee repairs end-to-end, including a **P0 found and fixed during qualification** (recruiter limiter violated the Cloudflare binding contract and 429'd every request). Two items remain blocked by **external account issues, not code**: GitHub Actions CI (billing: "recent account payments have failed or your spending limit needs to be increased") and the stable `core-qualification` preview URL (Workers Builds webhook did not fire for the new pushes; the same account likely paused builds). The repaired code is live and verified on the Worker's main URL.

## P0 — CONFIRMED + FIXED

- **P0-A Domain IDOR** — ownership derived from auth principal only; client-supplied `profileId` ignored; contract tests prove cross-user writes impossible. (`src/lib/domains/custom.ts`, `src/workers/handler.ts`)
- **P0-B/C Webhook forgery** — real Razorpay event shapes, `x-razorpay-event-id` idempotency via `billing_webhook_events` + `process_paid_order_webhook` RPC (migration `20260929120000`); unsigned requests rejected. Applied remotely; local/remote parity confirmed.
- **P0-D Deletion with stale session** — `validateAuthFreshness`/`getClaims` gate `handleAccountDelete`; no deletion on forged/expired tokens.
- **P0-E Public evidence leak** — public view exposes evidence **id only** (migration `20260929130000`); contract test vs fixture `src/tests/fixtures/public-view-row.json` (username `qual-1790169841172`).
- **P0-F CI** — quality + e2e jobs in `.github/workflows/ci.yml`. **Runs are blocked by GitHub account billing (see VERDICT); the identical pipeline passes locally step-for-step.**
- **P0 (new, found in qualification) Recruiter limiter outage** — the handler called the rate-limiting binding with a bare string, never awaited it, and checked a nonexistent `.allowed` property: `!rate.allowed` was always true → **429 for EVERY `/api/recruiter/ask` request wherever the binding existed**. Fixed to the real contract `limit({ key }) → Promise<{ success }>`, with dedicated `TOO_MANY_REQUESTS` code + `Retry-After` for pre-auth 429s (owner-quota 429s keep `RATE_LIMITED`), catch-and-continue on limiter failure. Verified empirically: fresh-server probes went 429 → 503 → (with public vars) 404; the E2E suite now carries a 429-forbidden canary.

## P1 — CONFIRMED + FIXED

- **P1-A unpdf boundary** — `src/lib/resume/pdf.ts` with `PDFExtractionError` kinds `malformed|too_many_pages|no_text|too_long`; 6 MiB / 20 pages / 100 k chars; fresh-ArrayBuffer copy per parse (unpdf detaches input); node-env tests.
- **P1-B Resume storage** — upload compensation (row rollback when object write fails), storage-first deletion, prefix pagination enumeration.
- **P1-C GitHub App** — server routes (`src/lib/github/server.ts`), HMAC-signed OAuth state, entitlement enforcement (migration `20260929140000`, unique connection per profile).
- **P1-D/E/F/H Billing truth** — one-time annual Pro (no renewal), `consume_recruiter_quota` RPC (migration `20260929150000`), strict citation parser (no fabricated citations), Billing.tsx rewrite, legacy cancel/resume → 410.
- **P1-G Achievements** — real inline edit form replacing the no-op Edit affordance.
- **P1-I Handler ordering** — unknown profile → exact **404 `PROFILE_NOT_FOUND`** before any AI-config 503; proven by unit tests with mocked backend **and live** on the deployed Worker (see LIVE PROOF).

## P2 — CONFIRMED + FIXED

P2-A auth error copy (`src/lib/auth/errors.ts`), P2-B ResetPassword session guard, P2-C VerifyEmail invariants, P2-D `main` landmark, P2-E 44 px touch targets, P2-F SSR meta/title truth, P2-G padded-length badge removal, P2-H EditorialTemplate aria-label, P2-I recruiter-and-account e2e tightened to exact 404+body. New `e2e/reset-password.spec.ts` covers QA-003/004 session/stale-validation invariants.

## TEST DEBT

Five copied-logic suites rewritten against **shipped production code**: `job-parser` (8 tests), `ats-view-model` (4), `pdf-renderer` (4, `@vitest-environment node`), `dedup` (7), `hostname` (14). Added: `github-server` (10), `pdf-worker-extraction` (9), `resume-storage` (5), `public-view` (4), integration `cancellation-live` (10), `worker.test` limiter/ordering suites (5), recruiter-ask expansions (+3). Unit count moved **615 → 586** (−1647 lines of copied tests; + rewritten/added suites above); every test imports the code users run.

## GATES

| Gate                                                      | Result                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`                                       | clean                                                                                                                                                      |
| `pnpm lint` (typed eslint, incl. e2e via default-project) | clean                                                                                                                                                      |
| `pnpm exec tsc --noEmit`                                  | clean                                                                                                                                                      |
| `pnpm test` (unit+ui)                                     | **586/586**, 54 files, 0 unhandled errors                                                                                                                  |
| `pnpm test:integration` (live RLS, explicit)              | **10/10**                                                                                                                                                  |
| `pnpm test:e2e` (desktop+mobile)                          | **58/58**                                                                                                                                                  |
| `pnpm build` / `bundle:scan --budget`                     | ok / exit 0 (3674 kB; pdfjs 1563 kB + react-pdf.browser 1171 kB lazy = OK)                                                                                 |
| `pnpm audit` / `--prod`                                   | no known vulnerabilities (undici override in `pnpm-workspace.yaml` fixes GHSA-3wwx-pv8p-q78v, dev-only miniflare transitive, unreachable in Worker bundle) |
| Secret scan of all changed files vs master                | clean; only tracked env file is `.env.example`                                                                                                             |
| Migrations                                                | forward-only, applied remotely, local/remote list parity (through `20260929150000`)                                                                        |

## LIVE PROOF (deployed Worker)

Deployed version `bd8969ec` at 100% on `https://career-profile-platform.memrae-staging.workers.dev` (verified serving the new bundle `index-DgZm7NHr.js` + public anon vars):

- `POST /api/recruiter/ask` unknown profile → **404 `PROFILE_NOT_FOUND`** (P1-I proven live, backend reachable)
- same on real published profile → 503 truthful AI-not-configured class (BharatCode key is credential-blocked)
- `POST /api/billing/subscription/cancel` and `/resume` → **410** with truthful one-time-annual explanation
- unauthenticated: domains / resume / variant / delete → **401**; webhook unsigned → 503 `BILLING_NOT_CONFIGURED`; unknown API → JSON 404
- `/u/qual-1790169841172` 200 with real SSR og:title/description; `/og-cover.png` 200 `image/png`; robots/sitemap 200; SPA fallback for unknown `/u/` 200
- `/api/recruiter/config` truthful (`enabled:false` — feature flag off on preview)

## BLOCKED (credential/account, report-only)

- **GitHub Actions CI**: run `36616118207` failed before start — _"The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings."_ The identical pipeline passes locally step-for-step; re-run after billing is fixed.
- **Stable preview URL** `https://core-qualification-career-profile-platform.memrae-staging.workers.dev`: served by a separate Workers Builds worker named `core-qualification` (a branch-preview for branch `core-qualification`; all 10 versions via `create_preview_deployment_api`). Branch `core-qualification` @ merge SHA `b71f2b8` was pushed (unprotected, confirmed on GitHub) but **no build fired** in 15+ minutes — consistent with the Cloudflare account pausing builds (same payment/spending-limit class of issue). The URL still serves the pre-repair Sep 28 build (`index-CFz4kC0e.js`). Remediation: Cloudflare dashboard → Workers & Pages → `core-qualification` → Builds (resume build / check billing), or trigger a build manually; the URL converges automatically once built. The repaired code is independently live on the main Worker URL above.
- Credentials (unchanged, code-complete paths): GitHub App creds, Razorpay keys, BharatCode key, SMTP, DNS. Live GitHub OAuth + live payments remain CREDENTIAL_BLOCKED.

## INTERRUPTED-WORK RECOVERY

- **branch found:** `fix/source-audit-closure` (~25 commits incl. docs + gate fixes)
- **HEAD found:** `0bee505` ("chore: gate fixes — eslint default-project config, undici override, prettier, webhooks test import")
- **uncommitted files found:** none at recovery point; during the resumed pass the 6 in-flight rate-limit-semantics files (handler, ask client, component, tests, eslint config, docs) were recovered fully from disk and committed as `42abf1f`
- **preserved:** all commits; the in-flight TOO_MANY_REQUESTS semantics; prettier state; interrupted `pnpm test` runs were re-executed to completion
- **discarded:** one exploratory `scripts/debug-pdf-fixture.mjs` scratch script (deleted, never committed); one partial `wrangler.toml` var append (restored via `git checkout -- wrangler.toml` — my own edit only, then redone correctly); temp log `e2e/last-unit-run.log`
- **reason:** Freebuff free-session limit ended the prior turn mid-gate-pass; state was recoverable entirely from git + workspace

## PDF PARSER PROOF

- **parser:** unpdf (pdf.js) behind the `src/lib/resume/pdf.ts` boundary; fresh ArrayBuffer copy per parse (pdf.js detaches its input)
- **serverless/Worker build:** `pnpm build` + `bundle:scan --budget` exit 0 — pdfjs 1563 kB + react-pdf.browser 1171 kB **lazy-loaded** (ATS route only); deployed worker 3047.64 KiB / gzip 747.73 KiB, startup 21–25 ms
- **real ATS PDF:** `pdf-renderer` (4 tests) + `pdf-worker-extraction` (9 tests) round-trip: `generatePDFBlob` → `extractTextFromPDF`
- **compressed PDF:** FlateDecode content streams parsed (`extracts text from Flate-compressed streams the byte-regex parser could not read`)
- **multi-page:** 3-page fixture → text + `pageCount: 3`
- **no-text:** `PDF_NO_TEXT` kind, safe error
- **malformed:** bad magic bytes → `PDF_MALFORMED`, never a parser stack (benign pdf.js "Indexing all PDF objects" warning observed for the crafted fixture)
- **max pages:** 20-page boundary → `PDF_TOO_MANY_PAGES`
- **timeout:** extractor guards bound work; tests use explicit 30 s timeouts for pdf.js cold start (documented flake fix)
- **live Worker:** deployed `bd8969ec` contains the boundary; upload-path smoke requires an authenticated session (credential-blocked), not a code gap

## RESUME STORAGE INTEGRITY

- **upload compensation:** DB-row failure after object write (and inverse) triggers rollback — pinned in `resume-storage.test.ts` (5 tests)
- **metadata consistency:** metadata row and storage object kept 1:1 by compensation; types regenerated (`database.types.ts`)
- **orphan enumeration:** prefix pagination avoids unbounded `list()`; orphan sweep covered by the deletion flow
- **account deletion cleanup:** storage-first delete + DB rows + server-only auth-user delete; `account-deletion.test.ts` incl. recoverable pending-marker semantics
- **cross-user isolation:** admin clients bypass RLS → ownership always from auth principal; live-RLS integration suite (10 tests) proves anon cannot read `user_subscriptions`, forge `account_deletion_requests`, or cross user boundaries

## BILLING TRUTH

One-time annual Pro (no auto-renewal, no cancel/resume — legacy routes **410**, live-verified); payment extends access from `max(now, current_period_end) + 1 year`; `cancel_at_period_end` column retained as unused schema (removal would be destructive); daily AI quota consumed atomically server-side via `consume_recruiter_quota` RPC; visitor-facing copy distinguishes owner-quota exhaustion from anti-abuse `TOO_MANY_REQUESTS` (distinct codes); docs (STAGE_7 / ROADMAP / PRIVATE_BETA / PRODUCTION_DEPLOYMENT) match handler behavior; live payments remain credential-blocked with code-complete Razorpay Orders + idempotent webhook paths.

## GITHUB SECURITY

Secret scan of all changed files vs master: **no leaked keys**; only tracked env file is `.env.example` (placeholders). `wrangler.toml` now ships **public, non-secret** anon values (project URL + publishable key — public by design, already inside the client bundle; RLS enforces authorization; **no** secret/service-role key anywhere). GitHub App keys (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_STATE_SECRET`, `GITHUB_APP_SLUG`) remain secret-config-only; CI uses non-secret placeholders; OAuth state is HMAC-signed; `docs/GITHUB_APP_SETUP.md` lists exact var names. `pnpm audit` / `--prod` clean.

## AUTHENTICATED E2E

58 tests across smoke, journeys, visual-matrix, appearance-live, cwv-baseline, recruiter-and-account, reset-password (desktop + mobile). Signed-in flows (dashboard, editors, billing, GitHub sync, deletion) require live credentials — **credential-blocked** as reported. Signed-out/contract coverage: account-deletion reauth gates, reset-password session guard + stale-validation invariants, recruiter contracts (429-forbidden canary, config shape, 404 panel absence), a11y targets, noindex rules. Auth-gated APIs were live-verified to deny unauthenticated access (401) rather than leak.

## QA DEFECT RECONCILIATION

| QA finding                             | Disposition                                                                                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-A…F (6)                             | fixed, committed, gate-verified                                                                                                                                                                                               |
| P1-A…I (8)                             | fixed, committed; P1-I also live-verified                                                                                                                                                                                     |
| P2-A…I (9)                             | fixed, committed                                                                                                                                                                                                              |
| TEST DEBT (5 suites)                   | rewritten against shipped production code                                                                                                                                                                                     |
| Docs drift (docs/* + README)           | truth pass + prettier; README feature/migration/commands refresh                                                                                                                                                              |
| CI missing (P0-F)                      | added; execution blocked by GitHub billing (external)                                                                                                                                                                         |
| Entitlements truth                     | enforced via migrations + RPCs; tests pin plan limits                                                                                                                                                                         |
| **New P0 (limiter binding contract)**  | caught by E2E gate during qualification; fixed + regression tests + live proof                                                                                                                                                |
| **New defects found in qualification** | ProfileEditor supabase TDZ (achievements query dead on first render); `fetchRecruiterConfig` unhandled rejection; preview limiter-state persistence (`persistState:false`); eslint default-project cap — all fixed with tests |
| Stable preview URL freshness           | blocked externally (Workers Builds not triggered); repaired code live on main Worker URL                                                                                                                                      |
