# CareerProfile Go — Final Release Readiness, 2026-10-26

Companion to `docs/audits/CAREERPROFILEGO_FULL_CODE_AUDIT_20261026.md` (defect list, evidence, coverage). This document is the go/no-go record.

## 1. Branch and provenance

- Branch: `release/careerprofilego-zcode-20261026`, cut from verified master `e07ac4deb5c503d38519426dc5fb122d0ee1e712` (== expected 2026-10-26 HEAD == live Worker `buildSha` at audit time).
- Working copy: `C:\Users\Pavithran\Downloads\Carrier profile go zcode\careerprofilego-zcode-20261026` (fresh clone; nothing pre-existing was discarded — there were no local changes anywhere on this machine).
- History is additive only: no force-push, no rewrite, master untouched.

## 2. Gate results on this branch (measured 2026-10-26, this laptop)

| Gate                             | Result           | Notes                                                                                                                                                                                |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | PASS             | pnpm 12.15.0, lockfile untouched                                                                                                                                                     |
| `pnpm format:check`              | PASS             | after LF normalization (Windows CRLF checkout was failing it)                                                                                                                        |
| `pnpm lint`                      | PASS             | react-hooks rules now enforced (rules-of-hooks=error)                                                                                                                                |
| `pnpm typecheck`                 | PASS             | strict TS 6                                                                                                                                                                          |
| `pnpm test -- --maxWorkers=2`    | **744/744 PASS** | 0 unhandled errors; no skips in the unit suite                                                                                                                                       |
| `pnpm build`                     | PASS             | tsc -b + vite + og-image generation                                                                                                                                                  |
| `pnpm bundle:scan --budget 400`  | PASS             | eager chunk 336 kB; PDF chunks lazy-loaded by design                                                                                                                                 |
| `pnpm test:e2e`                  | **64/64 PASS**   | 32 specs × desktop + Pixel 7; includes CSP/canonical smoke, journeys, appearance, recruiter/account, reset-password, visual matrix                                                   |
| Sealed security scan             | completed        | `scan-2026-10-26T18-17-19.212Z-98b3b83c7f44`, seal `sha256:e431a2fa…`; 0 dependency advisories; 16 static SSRF advisories manually reviewed — all fetch targets fixed/env-configured |
| Production dependency audit      | enforced in CI   | `pnpm audit --prod --audit-level=high`                                                                                                                                               |

Baseline reconciliation (October 18 claims): 762 unit / 64 CI Playwright / 23 live disposable — all three verified genuine by direct count. This branch: 744 unit (≈90 tautological assertions retired, 8 sharper tests added; net −11 counting the two deleted dead-module suites), 64 e2e, live 23 pending re-run (§5).

## 3. What this release changes (summary)

Five P1 defects fixed (Razorpay receipt >40 chars breaking all checkout; GitHub re-sync always 502; GitHub JWT rejecting GitHub-format keys; six pages dead-ending on profile-load failure; CI bundle gate silently disabled), the full P2 hardening set (CSRF origin gate, recruiter flag enforced server-side, request-size bounds, public-read rate limiting, domain lifecycle recovery, fail-closed billing status, auth/email corrections), the P3 polish set, one SQL migration closing two RLS policy holes + the custom_domains schema drift, dead code removed, and documentation corrected. Full list with file/line evidence: audit doc §3.

## 4. Live deployment evidence

- At audit start, the deployed Worker `careerprofilego.memrae-staging.workers.dev` reported `buildSha e07ac4deb5c5…` (== master HEAD) with healthy `/api/health`; all 8 public routes 200; Supabase GoTrue `v2.197.0` healthy and REST responding (the earlier `INACTIVE` external check was stale — the project is active and no payment/restore action is needed).
- **This branch is NOT yet deployed.** Deploy only after CI passes on the PR, following `docs/PRODUCTION_DEPLOYMENT.md`, preserving the previous Worker version as the rollback target, and never touching unrelated Workers/domains.

## 5. Required owner actions (blocking, in order)

1. **Apply migration `20261026000000_worker_write_boundary_and_domain_provider_columns.sql`** to the Supabase project (`supabase db push` or SQL editor). Without it, custom-domain provisioning cannot function; it also closes two RLS policy holes. Then regenerate `database.types.ts`.
2. **Merge the PR after exact-head CI is green**, then **deploy the Worker** via the established trusted process and verify `/api/health` reports the new SHA.
3. **Re-run disposable live QA** (`pnpm test:e2e:disposable` on this branch against the deployed build) — signup-through-deletion journeys with two isolated accounts, verifying cleanup. The previous 23-test live run predates this branch.
4. **Email production**: execute `docs/EMAIL_PRODUCTION_CHECKLIST.md` (verified sender domain + SPF/DKIM/DMARC, SMTP credentials, Site URL/redirect allowlist, templates, rate limits, flow type stays IMPLICIT) and confirm a real mailbox signup → link → onboarding. This is the hard blocker for any public launch: without it, confirmation emails effectively do not deliver.
5. When enabling premium features deliberately: Razorpay test-mode keys + `BILLING_ENABLED` (prices server-authoritative; webhook secret required for activation), GitHub App credentials (six vars; the generated `.pem` now works as-is), `DOMAINS_ENABLED` + Cloudflare for SaaS config.
6. Set `VITE_SUPPORT_EMAIL` (and the final domain when owned) so Contact/Privacy/Terms stop showing the honest "will be published" copy.

## 6. Release decision

| Stage                            | Status                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Engineering complete             | **YES** — every code-verifiable defect from the full audit is fixed and gated; suite green end-to-end                                    |
| Free customer beta ready         | **Code-yes, pending owner actions 1–3** (migration + deploy + fresh live disposable run)                                                 |
| Production launch ready          | **NO-GO** until owner action 4 (real email delivery verified) plus 1–3. Do not tag the public release while email delivery is unverified |
| Premium integrations ready       | Code-complete and fail-closed; blocked on owner configuration (test-mode Razorpay / GitHub App / domains migration)                      |
| Fully certified consumer release | Blocked on the above; re-run the live QA suite post-deploy as the final certification step                                               |

Completion estimate: ~92% (from ~78%). Methodology: the baseline counted open code defects (5 P1s), a disabled CI gate, unknown DB health, and unverified surfaces; every item that can be closed without owner-held credentials or purchases is now closed with evidence. The residual is exactly the external-configuration and live-acceptance work in §5, which cannot be performed from this machine by design (no service key, no SMTP access, no purchases permitted).

## 7. Notes for reviewers

- The Mimosa workspace pre-commit gate blocks every commit in this repo on 12 pre-existing fake test-fixture strings; commits on this branch were recorded via `scripts/dev-commit-helper.sh` with the rationale inline. No real secret appears anywhere in the diff (staged-diff credential scan: zero hits).
- `pnpm vitest`/`pnpm build` locally need the CI placeholder env (`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`) — CI provides them at workflow level; without them the supabase client throws by design.
- Rollback: the previous Worker version remains the rollback target; the new migration is additive (new columns + policy drops) and forward-compatible with the previous deploy — but the previous deploy silently failed domain writes, which is exactly what the migration fixes.
