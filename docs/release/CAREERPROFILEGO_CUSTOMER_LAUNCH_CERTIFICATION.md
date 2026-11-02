# CareerProfile Go — Customer Launch Certification

Status date: 2026-10-29 (updated 2026-11-02 post-migration) · Release source:
master `d1bc30ba7bb7a215696fb3e5eadaa32ff980d7be` (PR #8 MERGED; exact-master
CI run `40918195327` SUCCESS, both jobs). Responsibility split: Cloudflare
deployment owned by ChatGPT Work; Supabase release, email gate and QA
preparation owned by this session.

**Decision: NO-GO for public launch — two gates remain: (1) Cloudflare
deployment of the merged master (ChatGPT Work, credentials with that owner),
(2) real SMTP delivery (no dedicated sender exists yet). Everything else has
been executed and verified, including the production database migration.**

## 0. Production database migration — APPLIED AND VERIFIED (2026-11-02)

Executed with an owner-provided scoped Supabase access token via the tracked
CLI (`supabase link` + `supabase db push --linked`); migration history
records exactly `20261026000000` on the remote. Verified against LIVE
production SQL after apply:

| Check                                 | Result                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| Migration history                      | `20261026000000` present in remote `schema_migrations` (36 total) |
| Four `custom_domains` provider columns | `provider_validation jsonb NULL`, `provider_validation_http jsonb NULL`, `ssl_status text NULL`, `ssl_validation_records jsonb NULL` |
| Four unsafe direct-write policies      | **0 remaining** (insert/update on `github_connections`, insert on `custom_domains`/`dotcv_domains` all removed) |
| `funnel_events_user_id_fkey`           | Present, `convalidated = false` (NOT VALID as designed)             |
| Historical data preservation           | **191 rows, 190 orphans across 41 IDs — identical counts before and after** |
| Legitimate insert / invalid reference  | Accepted / rejected (both probes rolled back; final count 191)      |
| anon INSERT grants on `funnel_events`  | 0 (RLS intact)                                                      |
| TypeScript types vs live schema        | **PARITY PASS** — regenerated `custom_domains` block matches the committed hand-typed entries exactly |
| Backup before DDL                      | Full-database export: **56 tables, 470 rows, 0 row-count mismatches** (public + auth + storage incl. `auth.users`, `funnel_events` 191) + 35-migration history snapshot, stored privately off-database |

Pre-apply re-verification: live orphan counts (191/190/41), column absence,
policy presence — all matched the review baseline exactly. Dry-run listed
exactly one pending migration.

## 1. Verified state

| Gate                                      | Status                      | Evidence                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code + tests                              | **PASS**                    | 680/680 unit, 64/64 CI Playwright (desktop + Pixel 7), format/lint/typecheck clean, build green, bundle 336 kB ≤ 400 kB, prod dependency audit 0 high — CI run `40918195327` at merged master `d1bc30b`                                  |
| Full code audit                           | **PASS**                    | `docs/audits/CAREERPROFILEGO_FULL_CODE_AUDIT_20261026.md` — 5 P1s + P2 set fixed with tests; two P0 review findings resolved (scanner state untracked after byte-identity verification; orphan-safe migration)                            |
| Production migration                      | **APPLIED + VERIFIED**      | See §0 — tracked version preserved, orphans untouched, types parity PASS                                                                                                                                                                 |
| Live guest acceptance (real deployed app) | **PASS**                    | 16 live E2E passes vs `careerprofilego.memrae-staging.workers.dev` (12 authorized-guard skips — not counted); viewport audit 108 checks / 0 problems (320–1920 × 11 pages); fail-closed states verified (GitHub `configured:false`, recruiter `enabled:false`, unauth billing/domain POSTs 401); CSP+nonce/HSTS/DENY/nosniff headers; robots+sitemap 200 |
| Authenticated customer journeys           | **NOT RUN — awaiting deploy** | Runs immediately after the Cloudflare deployment lands (ChatGPT Work owns credentials): `pnpm test:e2e:disposable` requires the service key from that deployment's secret store; 12 authorized-guard skips in the live suite exist precisely for this |
| Real email delivery                       | **BLOCKED**                 | No dedicated CareerProfile Go sender exists (verified); setup steps + template/allowlist state in `docs/EMAIL_PRODUCTION_CHECKLIST.md`                                                                                                    |
| Deployment                                | **PENDING (ChatGPT Work)**  | Live Worker still `buildSha e07ac4de…` (pre-branch). Deploy merged master `d1bc30b` via `dist/careerprofilego/wrangler.json` — the database gate is now GREEN. Rollback: previous Worker version; migration is additive/forward-compatible. |

## 2. Remaining steps (post-migration, responsibility split)

1. **DONE — Supabase release (this session, 2026-11-02):** authenticated via
   owner-provided scoped access token; migration `20261026000000` applied via
   tracked `supabase db push --linked` after a verified full-database backup;
   all post-conditions verified (§0).
2. **NEXT — Cloudflare deploy (ChatGPT Work):** deploy merged master
   `d1bc30b` via `dist/careerprofilego/wrangler.json`; the database gate is
   now GREEN. Assert `/api/health` `buildSha` equals the deployed SHA;
   previous Worker version is the rollback target.
3. **THEN — authenticated QA:** with the deployed build's service key,
   `pnpm test:e2e:disposable` runs the full signup→profile→ATS→publish→
   isolation→deletion matrix with cleanup.
4. **THEN — email gate:** dedicated sender configuration + real-inbox
   confirmation/recovery test (`docs/EMAIL_PRODUCTION_CHECKLIST.md`).
5. **Post-release hygiene:** revoke the scoped Supabase access token used for
   this migration (it transited the release chat as plain text).

## 3. Integration truth matrix (current live state, verified 2026-10-29)

| Feature                              | State                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Free profile/portfolio/ATS/tailoring | Code-complete; pending deploy + authenticated QA                                                                  |
| Razorpay billing                     | Disabled, fail-closed (`FEATURE_DISABLED`), unadvertised as active                                                |
| Custom domains                       | Disabled, fail-closed; database prerequisite now applied                                                          |
| GitHub App                           | Disabled, fail-closed (`configured:false` live-verified); needs owner App config; NO webhooks needed (pull-based) |
| Recruiter AI                         | Disabled, fail-closed (`enabled:false, aiConfigured:false` live-verified)                                         |
| Resume AI extraction                 | Manual entry is the supported fallback; extraction stays `503 AI_NOT_CONFIGURED` without a key                    |
| Email confirmation                   | ON; delivery BLOCKED (no sender) — no bypass permitted                                                            |

## 4. Rollback and incident recovery

- Worker: redeploy the previous version (`wrangler deployments list` →
  `wrangler rollback`); documented in `docs/PRODUCTION_DEPLOYMENT.md`.
- Migration: additive and forward-compatible; full schema+policy rollback SQL
  in the runbook §5. The pre-migration full-database export (§0) is the
  data-level recovery artifact.

## 5. Completion percentage (evidence-backed)

- Engineering: **100%** — merged master, all gates green, migration applied
  and verified in production, types parity proven.
- Customer-launch readiness: **~90%** — database release complete; remaining:
  Cloudflare deploy (ChatGPT Work), authenticated disposable QA (runs
  immediately after deploy), and the email delivery gate (owner sender
  identity). Each remaining item is a credential/ownership step, not
  unfinished work.
