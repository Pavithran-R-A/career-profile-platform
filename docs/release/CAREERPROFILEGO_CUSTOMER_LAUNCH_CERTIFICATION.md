# CareerProfile Go — Customer Launch Certification

Status date: 2026-10-29 · Branch: `release/careerprofilego-zcode-20261026` at
`8fb51639944bb50935761871672d6352ec0d830d` (PR #8; CI run `40908069619`
SUCCESS, both jobs, exact head).

**Decision at this document's commit: NO-GO for public launch — two owner-held
credential gates are not yet executable from the release machine. Everything
executable without them has been executed and verified; this document states
precisely what remains.**

## 1. Verified state

| Gate                                      | Status                 | Evidence                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code + tests                              | **PASS**               | 680/680 unit, 64/64 CI Playwright (desktop + Pixel 7), format/lint/typecheck clean, build green, bundle 336 kB ≤ 400 kB, prod dependency audit 0 high — CI run `40908069619` at the exact head                                                                                                                                                           |
| Full code audit                           | **PASS**               | `docs/audits/CAREERPROFILEGO_FULL_CODE_AUDIT_20261026.md` — 5 P1s + P2 set fixed with tests; two P0 review findings resolved (scanner state untracked after byte-identity verification; orphan-safe migration)                                                                                                                                           |
| Migration readiness                       | **PASS (not applied)** | Isolated PostgreSQL 18 verification: forced-failure atomicity (zero partial effects), apply with `190 orphans / 41 user ids` WARNING, legitimate-insert accepted, invalid-insert rejected, deletion cascade, reconciliation+VALIDATE path. Runbook: `docs/MIGRATION_20261026000000_RUNBOOK.md`                                                           |
| Live guest acceptance (real deployed app) | **PASS**               | 16 live E2E passes vs `careerprofilego.memrae-staging.workers.dev` (12 authorized-guard skips — not counted); viewport audit 108 checks / 0 problems (320–1920 × 11 pages); fail-closed states verified (GitHub `configured:false`, recruiter `enabled:false`, unauth billing/domain POSTs 401); CSP+nonce/HSTS/DENY/nosniff headers; robots+sitemap 200 |
| Authenticated customer journeys           | **NOT RUN**            | Requires the disposable-QA service key (owner-held `.wrangler-secrets.local`) — 12 authorized-guard skips in the live suite exist precisely for this                                                                                                                                                                                                     |
| Real email delivery                       | **BLOCKED**            | No dedicated CareerProfile Go sender exists (verified); setup steps + template/allowlist state in `docs/EMAIL_PRODUCTION_CHECKLIST.md`                                                                                                                                                                                                                   |
| Deployment                                | **PENDING**            | Live Worker still `buildSha e07ac4de…` (pre-branch). Deploy is owner-gated and MUST follow the migration (the new Worker writes the 4 `custom_domains` provider columns; `DOMAINS_ENABLED` stays off until then, so no runtime impact before migration)                                                                                                  |

## 2. Dependency-ordered remaining steps (owner)

1. **Authenticate CLIs on the release machine** (verified absent on 2026-10-29:
   no `SUPABASE_ACCESS_TOKEN`/`CLOUDFLARE_API_TOKEN` env, no
   `.wrangler-secrets.local`, `supabase whoami`/`wrangler whoami`
   unauthenticated, browser shows the Cloudflare login page):
   - `supabase login` (browser consent) — or set `SUPABASE_ACCESS_TOKEN`
   - `wrangler login` (browser consent) — or set `CLOUDFLARE_API_TOKEN`
     These unlock steps 2–4 directly; no other owner input is needed for them.
2. **Apply migration `20261026000000`** exactly per
   `docs/MIGRATION_20261026000000_RUNBOOK.md` (tracked `supabase db push`;
   NOT VALID FK preserves all 190 orphan rows; reconciliation + VALIDATE is a
   separate, later approval).
3. **Merge PR #8** (mergeable at `8fb5163`; if this certification merged with
   it, master already carries the doc) and **deploy the merged SHA** via the
   trusted process; assert `/api/health` `buildSha` == merged SHA; previous
   Worker version is the rollback target (deploy AFTER step 2).
4. **Run `pnpm test:e2e:disposable`** against the deployed build —
   authenticated signup→profile→ATS→publish→isolation→deletion journeys with
   full cleanup (the suite self-verifies the service key and refuses
   otherwise).
5. **Email gate**: configure a dedicated sender per the checklist, then the
   real-inbox confirmation + recovery test (Phase 5 of the release mission).

## 3. Integration truth matrix (current live state, verified 2026-10-29)

| Feature                              | State                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Free profile/portfolio/ATS/tailoring | Code-complete; pending deploy + authenticated QA                                                                  |
| Razorpay billing                     | Disabled, fail-closed (`FEATURE_DISABLED`), unadvertised as active                                                |
| Custom domains                       | Disabled, fail-closed; migration prerequisite documented                                                          |
| GitHub App                           | Disabled, fail-closed (`configured:false` live-verified); needs owner App config; NO webhooks needed (pull-based) |
| Recruiter AI                         | Disabled, fail-closed (`enabled:false, aiConfigured:false` live-verified)                                         |
| Resume AI extraction                 | Manual entry is the supported fallback; extraction stays `503 AI_NOT_CONFIGURED` without a key                    |
| Email confirmation                   | ON; delivery BLOCKED (no sender) — no bypass permitted                                                            |

## 4. Rollback and incident recovery

- Worker: redeploy the previous version (`wrangler deployments list` →
  `wrangler rollback`); documented in `docs/PRODUCTION_DEPLOYMENT.md`.
- Migration: additive and forward-compatible; full schema+policy rollback SQL
  in the runbook §5. Data dump taken in runbook step 1 is the data-level
  recovery artifact.

## 5. Completion percentage (evidence-backed)

- Engineering: **100%** of code-verifiable scope (all gates green at the
  certified head).
- Customer-launch readiness: **~85%** — the merge can happen now; deployment,
  authenticated QA, and email delivery each require one owner authentication
  step that cannot be performed from this machine (verified: §2.1).
- The exact blocker for each remaining percentage point is a credential
  login, not work: no code, test, or documentation gap remains open.
