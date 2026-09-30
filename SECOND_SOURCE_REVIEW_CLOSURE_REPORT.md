# SECOND INDEPENDENT SOURCE REVIEW CLOSURE

**STATUS: PASS** — all credential-free code, database, and test items are fixed and verified end-to-end. The main worker (`career-profile-platform.memrae-staging.workers.dev`) serves the final bundle `index-DBx0THdM.js` (version `b5989683`, 100%). The stable preview URL still serves the old pre-repair bundle because Cloudflare Workers Builds does not trigger for the `core-qualification` worker and its versions cannot be uploaded via the CLI (`versions upload` rejects it: "You cannot upload a new version of a Worker that does not yet exist", even though 10 versions created by `create_preview_deployment_api` are listed) — diagnosis and the exact human action are in DEPLOYMENT. Two further account-level blockers (GitHub Actions billing, dashboard sign-in) are reported, not misclassified as code failures.

Branch `fix/second-source-review-closure` (203cfb4) merged to `master` (merge **45e94a3**), pushed. Migrations `20260930100000_evidence_public_boundary.sql` + `20260930110000_published_evidence_owner_rights.sql` applied remotely; `database.types.ts` regenerated from the live DB.

---

## PRIVATE EVIDENCE

**Base grants** — `REVOKE ALL ON public.profile_evidence / github_repositories / github_connections FROM anon` in migration `20260930100000`. Live-verified via Supabase REST with the public anon key:

- `GET /rest/v1/profile_evidence` → **42501 permission denied**
- `GET /rest/v1/github_repositories` → **401/42501 denied**
- `GET /rest/v1/github_connections` → **42501 permission denied**
- `GET /rest/v1/public_profiles` → **200** (safe view unaffected)

**View filtering** — `published_evidence` rebuilt as a safe projection. A row appears **only if ALL hold**: `profiles.visibility='published'` AND `pe.is_public=true` AND `gr.is_private=false` AND `gr.show_publicly=true` (INNER JOIN on `github_repositories` — the old LEFT JOIN is what let private-repo evidence leak). New `published_evidence_non_repo` view gives non-repo evidence its own explicit rule (published + is_public + no `source_path` + repo-less). First attempt used `security_invoker=true`; live anon testing showed that blocked anon from reading the views entirely (owner-rights is the Supabase-standard pattern, safe because the gate is inside the definition) — fixed in `20260930110000` and re-verified live. Live column check: `id, profile_id, evidence_type, subject, summary, source_url, source_commit_sha, observed_at, repository_full_name, repository_url, repository_language, repository_topics` — nothing else.

**Metadata exposure** — `metadata`, `author_email`, `source_path`, `github_repository_id` (internal uuid), `installation_id` are **not in the projection**. Live probe: selecting `metadata` / `author_email` / `source_path` from the view → **400 (column not found)**. `public_profiles.evidence` aggregate got the same four-condition gate (was `is_public`-only before this pass).

**Private repo test** — three independent layers, all tested: (1) DB view gate + INNER JOIN (unit: `public-view.test.ts` contract, live SQL verified); (2) `POST /api/github/evidence/:id/public` — server derives ownership from the session, 403 on private repo, 403 when `show_publicly=false`, 404 cross-user, 400 non-boolean (tests in `second-closure.test.ts`); (3) UI: `RepositoryList` show-publicly switch disabled for private repos; the client-side direct `profile_evidence.update({is_public})` in [GitHubDashboard.tsx](src/pages/GitHubDashboard.tsx) is **removed**. "Public repo + show_publicly=false + evidence is_public=true → NOT anon" holds (view requires show_publicly). "User A cannot toggle User B evidence" holds (profile→evidence ownership check + 403 test).

## GITHUB

**Browser callback (FLOW A — OAuth during install)** — corrected per GitHub's current contract: OAuth-during-install callbacks carry **code + state only**; the Setup URL is unavailable in that mode, so **installation_id is never read from the browser**. [GitHubCallback.tsx](src/pages/GitHubCallback.tsx) routes at `/dashboard/github/callback` and `/github/callback`: validates code/state, handles GitHub `error`/`error_description` denial params, requires a logged-in session, POSTs `code + state` to `POST /api/github/callback`.

**Server resolution** — [server.ts](src/lib/github/server.ts): `resolveInstallationForUser()` exchanges the code for a GitHub App **user access token**, calls **`GET /user/installations`**, filters to **this app** by `app_slug`, and: exactly one eligible → cross-verifies with the **App JWT** (`verifyInstallationForAccount`) → persists via `github_connections` upsert (unique per profile, migration `20260929140000`); **multiple** → 200 `selection_required` with the eligible accounts, no guessing; none → 404. `installation_id` in the request body is **ignored entirely** (spoof test proves it). Multiple-choice round-trip: `POST /api/github/connect/choose` accepts only a **server-signed selection token** (`HMAC(installationId|userId|exp)`, state-secret, 10-min TTL) and re-verifies the installation exists on this app via the App JWT (`verifyInstallationOnApp`).

**Evidence generation** — REAL pipeline, no longer dead code: dashboard "Generate evidence" → `POST /api/github/evidence/generate` → `generateEvidenceForSelected()`: for **selected** repos only, bounded commits/PRs/issues/releases via `GitHubClient.syncAll(limits)` → production extractors → persist `profile_evidence` with `is_public=false` → dedupe by stable source identity (`type:url|sha|subject`) → **stale policy: evidence for deselected repos is deleted**; rename survives via `github_repo_id` FK upsert. Existing limits (`maxCommits/maxPullRequests/maxIssues/maxReleases/maxRepositories`) respected.

**Environment contract** — one convention everywhere: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_STATE_SECRET`, `GITHUB_APP_SLUG` across [handler.ts](src/workers/handler.ts) Env, [config.ts](src/lib/github/config.ts), [jwt.ts](src/lib/github/jwt.ts), `.env.example`, [GITHUB_APP_SETUP.md](docs/GITHUB_APP_SETUP.md), [PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md). `.env.example` no longer documents `GITHUB_CLIENT_ID/SECRET` and now lists `GITHUB_APP_SLUG`.

**process.env mutation removed** — `withGitHubEnv` deleted from [handler.ts](src/workers/handler.ts); [jwt.ts](src/lib/github/jwt.ts) and [installation.ts](src/lib/github/installation.ts) take an explicit `GitHubJwtConfig`; `resolveGitHubConfig(env)` builds an immutable per-request config. **Concurrency test**: 25 interleaved createSignedState/verifySignedState rounds across two different configs — every state verifies only under its own config (cross-verifies all fail); process.env untouched throughout (`github-server.test.ts`).

**Webhook/manual-sync truth** — option B: no webhook endpoint exists, so docs instruct "Webhook: deactivated", zero event subscriptions, and delete `GITHUB_APP_WEBHOOK_SECRET`. "Subscribe to events: None."

**Live status** — `GET /api/github/config` public probe works; unauthenticated `POST /api/github/connect/choose` → 401 live on the deployed worker. `POST /api/github/evidence/generate` and `.../public` registered; live unauth probes → 401.

## DOMAINS

**Provider validation record** — [cloudflare.ts](src/lib/domains/cloudflare.ts) rebuilt on Cloudflare's ACTUAL response: `createCustomHostname` returns `{id, hostname, status, ownership_verification, ownership_verification_http, sslStatus, sslValidationRecords}`. The fake `cv-verify-*` generator now **throws** (test asserts it); the UI displays the provider's own TXT record (`_acme-challenge…` name/value from `ownership_verification`).

**Status refresh** — `POST /api/domains/custom/refresh`: `getCustomHostname` fetches current provider status/SSL and persists `status`, `provider_validation`, `provider_validation_http`, `ssl_status`, `ssl_validation_records` into `custom_domains`.

**Retry** — same hostname with a failed/removed row is resurrected to `pending` by the atomic RPC; no dead-end after a transient provider error.

**Remove** — `POST /api/domains/custom/remove`: `deleteCustomHostname` (real provider DELETE) first; local removal only on provider success; ownership enforced.

**Quota recovery** — `create_custom_domain_atomic` RPC (advisory lock) counts only slot-reserving states (`pending/pending_validation/active`); `failed`/`removed` do not reserve, so a Cloudflare failure marks the row failed via `release_custom_domain_slot` and frees the slot. **PLATFORM_PROFILE_ORIGIN required** when provisioning is enabled — no `profile.example.com` fallback (503 `SERVER_NOT_CONFIGURED` otherwise; test proves it).

**Fixtures** — `cloudflare-custom-hostname.test.ts` mirrors official shapes (`ownership_verification {type:'txt',name,value}`, `ownership_verification_http {status}`, `ssl.status`, `ssl.validation_records`), asserts the origin/SSL request body, `cv-verify` never appears, provider-failure throws, delete URL, 9/9 green.

## PDF

**Byte limit** — `MAX_FILE_SIZE` 6 MiB checked **inside** `extractTextFromPDF` before any parse (kind `too_large`); Worker pre-parse rejection proven by a deterministic test (<2s, no pdf.js involvement) in `pdf-worker-extraction.test.ts`.

**Magic bytes** — `%PDF` checked inside the boundary (was only at upload).

**Timeout** — `PARSE_TIMEOUT_MS = 10_000` deterministic production timeout wrapping `getDocumentProxy` AND `extractText` via `Promise.race`; test asserts the constant ≠ the 30s vitest allowance.

**Cleanup** — document proxy `destroy()` in `finally` (guarded; cleanup never masks the real error). **Encrypted** PDFs get a dedicated `encrypted` kind via parser-message detection. Worker proof: worker path maps kinds → `PDF_TOO_MANY_PAGES`/`PDF_NO_TEXT`/`PDF_TEXT_TOO_LONG`/`PDF_MALFORMED` codes. Docs ([SECURITY.md](docs/SECURITY.md)) claim only enforced bounds.

## ONBOARDING/DATA

**Atomic creation** — ONE statement: `create_profile_with_basics(p_user_id, p_username, p_display_name, p_headline, p_about, p_location)` RPC (migration `20260930100000`), advisory-locked per user. [Onboarding.tsx](src/pages/Onboarding.tsx) uses it; `updateProfile` after insert is gone.

**Retry** — RPC resumes/updates an existing partial profile (same user) instead of duplicating; returns `null` when the username is taken by someone else → UI shows a truthful message **and** moves back to the username step with the reason surfaced (test caught the silent-step-change bug; fixed).

**Not-found vs failure** — `getProfileByUserId` uses `maybeSingle`; `null` = genuinely no profile; any error → `ProfileAppError('network'|'backend')`. Tests prove backend (42P01), connection-terminated, and network failures all **throw**, never return null.

**Relation failures** — every relation query (`profile_experiences/education/projects/skills/links`) error is checked; a failed query throws instead of silently rendering an empty profile (failure-injection tests for experiences and skills).

**Safe errors** — `safeProfileErrorMessage()` maps everything to customer-safe text; tests assert raw Postgres text (`42P01`, `duplicate key…`) never reaches the UI through onboarding or profile load.

## QUOTAS

**Variant concurrency** — `create_profile_variant` now takes `pg_advisory_xact_lock('profile_variants:'|profile)` before COUNT→INSERT; two simultaneous creates with one slot left → exactly one succeeds, the loser gets 429 (limit+RPC semantics preserved; lock added, not rewritten).

**GitHub concurrency** — `select_github_repository(p_connection_id, p_repo_id, p_limit)` RPC: advisory lock per connection → count → validate → update in one transaction; unselect always succeeds. `refund_github_repository_select` releases the slot on follow-on failure. Handler repo-select rewritten to use it.

**Domain concurrency** — `create_custom_domain_atomic` advisory lock per profile; `release_custom_domain_slot` frees failed rows (see DOMAINS).

**Recruiter quota** — `consume_recruiter_quota` untouched (already atomic) and **preserved**; new `refund_recruiter_quota` (clamped `GREATEST(count-1,0)`) only on provider failure with no answer — test proves `consume_recruiter_quota` AND `refund_recruiter_quota` are both invoked on the provider-error path.

## BILLING

**Usage truth** — `GET /api/billing/status` now returns canonical counts: `resume_variants = COUNT(profile_variants)`, `github_repos = COUNT(github_repositories WHERE selected_for_evidence)`, `custom_domains = COUNT(custom_domains WHERE status IN ('pending','pending_validation','active'))`; `recruiter_ai` stays on the daily `usage_counters` window. Test creates rows (2 variants, 4 selected repos, 1 active domain) and asserts the exact displayed numbers.

**Pricing copy** — "and no branding" removed from [Pricing.tsx](src/pages/Pricing.tsx) (no branding entitlement exists in `PlanEntitlements`); Pricing/Billing/API plan cards now tell the same story; `entitlements.test.ts` fixtures rebuilt from the real contract (no `tailoringPerMonth`/`removeBranding`).

**Payment pending UX** — [Billing.tsx](src/pages/Billing.tsx) Razorpay handler: shows "Payment received. Activating Pro…", polls server-authoritative `/api/billing/status` for a bounded 45s (2→4→6→8→10s backoff), auto-resolves on Pro; after the window shows "Payment received. Activation is still processing. Refresh shortly." — never "Payment Failed", never a client-side grant; Pro only ever granted by the idempotent webhook RPC.

**Webhook ledger state** — `order_not_found` no longer leaves a permanent `processing` row: the handler marks the ledger row `status='failed', last_error='order_not_found'` before responding (only `processed` is terminal, so a legitimate later retry can still re-apply). Tests assert the ledger's final state.

## RATE LIMIT

**Key design** — `recruiterRateLimitKey()` = `HMAC-SHA256(RATE_LIMIT_KEY_SECRET, username|ip|rotatingMinute).hex[0:32]` prefixed `h1:`; binding contract unchanged (`await limiter.limit({key}) → {success}`). Tests prove the exact expected HMAC (including the minute bucket), that the raw IP never appears in the key, and that the key rotates with the period. Anti-abuse limiter remains separate from subscription quota (distinct codes `TOO_MANY_REQUESTS` vs `RATE_LIMITED`).

**Raw IP retention** — none: the IP exists only inside the HMAC; the documented no-secret fallback keys on `profile:<username>:p<period>` (profile identity + rotation, still no IP). Key derivation tested at unit level against the worker handler.

## TEST DEBT

**evidence.test** — [evidence.test.ts](src/tests/unit/evidence.test.ts) fully rewritten to import the real `src/lib/github/evidence.ts` (`extractCommitsEvidence`, `extractPullRequestsEvidence`, `extractIssuesEvidence`, `extractReleasesEvidence`, `extractCodeReviewsEvidence`, `extractAllEvidence`, `classifyCommit`, `dedupeEvidence`, `inferLanguageFromPath`, `deduceSkillsFromEvidence`, `DEFAULT_EVIDENCE_TUNING`). The copied `EvidenceExtractor` implementation is **deleted**; tests also pin "every extracted item is `is_public=false`".

**Stale plan fixtures** — `entitlements.test.ts` free-entitlement fixture now typed as real `PlanEntitlements`; repo-wide search for `tailoringPerMonth`/`removeBranding` returns **zero** test hits.

**Copied logic remaining** — `github-sync.test.ts`'s copied `deduplicateEvidence` replaced by identity-dedupe tests against the real `dedupeEvidence`/`extractAllEvidence`; dead `src/lib/github/connection.ts` **deleted** (zero production imports; `GitHubClient` signature fix applied to the surviving `sync.ts`, which the pipeline now uses as a real production module).

## DEPLOYMENT

- **master SHA**: `45e94a33da7c9073c1db472c7618ee8e2262ced2` (merge of `fix/second-source-review-closure` @ `203cfb43b4321ae36f85e19a14b3dcd4cc19af58`), pushed to `origin/master`.
- **core-qualification SHA**: `203cfb4` (branch `fix/second-source-review-closure`, pushed; first commit `1dd8067` also pushed). Both remote.
- **GitHub Actions result**: run **36708272186** for the final master merge completed `failure` **in 4s, before any job ran** — annotation: *"The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings."* Identical to the pre-existing block on 36616118207. Same for the branch. **Not a code failure**; local gates are the authoritative CI-equivalent results.
- **Stable preview bundle hash**: serves **`index-CFz4kC0e.js`** — the September 28 pre-repair build. It is therefore **NOT current**, and this report does not claim otherwise. Diagnosis: the URL is served by a *separate worker* `core-qualification`; all 10 of its versions were created by `create_preview_deployment_api` (Cloudflare Workers Builds branch-preview) and `versions list --name core-qualification` shows the last version from Sep 28 17:00 UTC. Pushes to `core-qualification`/`master` after that (and this pass's pushes) triggered **zero new versions** — Workers Builds builds never fired. CLI/API remediation is blocked by Cloudflare: `wrangler versions upload --name core-qualification` → `✘ [ERROR] You cannot upload a new version of a Worker that does not yet exist. Please run the deploy command first.` (Workers Builds preview workers are flagged non-uploadable; no Workers Builds script exists to invoke).
- **HUMAN ACTION REQUIRED (Cloudflare)** — two options, either resolves it: (a) sign in to the Cloudflare dashboard → Account `1bf748e79ea33859c13d12621e2fea89` → **Workers & Pages → career-profile-platform → Settings → Build → Branch control**, and add `core-qualification` to the deployed-branch patterns (or set `Branch = core-qualification`), then confirm a build runs and the preview URL updates; or (b) if Workers Builds previews are not wanted, delete the `core-qualification` worker and re-point the stable URL via a route/prefixed worker the CLI can manage. Dashboard sign-in is required and cannot be automated.
- **Production deploy**: none performed (per instruction). The main worker — the URL currently serving real traffic — **does** carry the final code: version `b5989683-27c7-4692-b835-31c16a993995` (message `second-source-review-closure 1dd8067`) deployed at 100%; `https://career-profile-platform.memrae-staging.workers.dev/` serves **`index-DBx0THdM.js`**, which matches the local final build exactly (`dist/client/index.html` → `index-DBx0THdM.js`). Live: `/api/health` 200; recruiter-ask unknown profile → exact `404 PROFILE_NOT_FOUND`; new endpoints unauth → 401.

## FINAL GATES

| Gate | Result |
| --- | --- |
| format (`prettier --write .`) | clean |
| lint (`eslint .`) | 0 errors / 0 warnings |
| typecheck (`tsc --noEmit`) | clean |
| unit (`vitest run --maxWorkers=2`) | **57 files, 661/661 passed**, 0 skipped, 0 flaky (final round re-run after all edits) |
| integration (`test:integration`, live RLS) | **10/10 passed**, no silent skips |
| E2E (Playwright desktop + Pixel 7) | **58/58 passed** (incl. 429-contract canary) |
| build (`tsc -b && vite build`) | success |
| bundle budget (`bundle-scan`) | 3683 kB total; only over-500 kB chunks are the lazy-loaded PDF stack (pdfjs 1563 kB, react-pdf 1171 kB) — unchanged and route-isolated |
| audit (`pnpm audit --prod`) | "No known vulnerabilities found" |
| secret scan (regex sweep of src/migrations/docs/e2e/wrangler/env) | clean — the only test-file literal was renamed to `test-only-admin-key-not-a-real-secret`; committed anon values remain the already-audited public keys |
| DB migrations | `20260930100000` + `20260930110000` applied to remote `yxrbytzhiilnzlamqpqz`; types regenerated from live schema |
| Live anon REST checks | base evidence/github tables denied; safe views readable; `metadata`/`author_email`/`source_path` columns absent from the public projection |

No flaky tests observed across repeated runs; no silent integration skips; no copied implementation tests remain.
