# Deployed Workers QA — do not mistake guest tests for full customer acceptance

## What failed in the October 9 handoff

The previous local `account-qa.spec.ts` run timed out and Playwright later
reported that its page/context/browser had closed. One attempted login remained
on `/login`. These observations are **not proof the deployed Worker is unreachable**:
the browser may have navigated successfully and authentication may have failed.

The normal CI suite uses a local production Vite preview and placeholder Supabase
values. Its 64 tests **do not** create verified accounts or prove real profile
CRUD, email verification, resume processing or account deletion.

## Separate real-deployment test command

`playwright.config.ts` now starts a local Vite server only when
`E2E_BASE_URL` is unset.

For safe deployed QA, use a dedicated suite which never starts a local server:

```sh
E2E_BASE_URL=https://careerprofilego.memrae-staging.workers.dev pnpm test:e2e:live
```

The live configuration only accepts the exact preview origin and loads pages with
`domcontentloaded` rather than waiting for every third-party resource. It checks
real health, navigation, forms and non-disclosure of unknown profiles. It also
records failing browser screenshots/traces **for the guest suite only**.

The authenticated test is **skipped unless** the runner securely injects
`E2E_QA_ACCOUNT_DISPOSABLE=yes`, `E2E_QA_EMAIL`, and `E2E_QA_PASSWORD`.
Use only a verified disposable test user you are allowed to delete. Never paste
credentials into GitHub, chat, screenshots, CLI arguments or test logs. Inject
them from your existing private local secret mechanism.

The authenticated spec disables traces, videos and screenshots to avoid persisting
passwords in artifacts. It proves only sign-in, session persistence and sign-out.
A skipped test is **not** a pass. It does not claim to cover signup delivery or
account deletion.

## Remaining acceptance evidence (must be real, not mocked)

- Real two-user verified-email signup and login; password recovery via an actual inbox
- Profile, experiences, education, projects and skills CRUD; reload persistence
- Valid/invalid resume upload, extraction fallback, ATS download and PDF text extraction
- Job tailoring, template changes, appearance autosave and reload
- Publish, anonymous access, unpublish, share and two-user isolation
- Delete one disposable account after same-account reauthentication, verify its
  storage/DB/Auth removal and verify the other account remains intact
- Mobile/tablet/desktop screenshots, console/network errors, accessibility checks

For each test report `PASS`, `FAIL`, or `NOT RUN`, exact deployed SHA,
Worker Version ID, any test account IDs (redacted), and evidence paths.

## Diagnosing timeouts

1. Verify `/api/health` using Playwright's `request` fixture.
2. Navigate to `/login` with `waitUntil: 'domcontentloaded'` and assert
   the email/password controls render.
3. If the page loads but login stays on `/login`, inspect the displayed auth
   error and Supabase Auth logs; do not claim a browser connection failure.
4. Capture only sanitized pageerror/requestfailed metadata, never auth headers,
   access tokens, password values or full callback URLs.
5. Confirm test account verification status and Supabase Site URL/redirect
   allow-list before diagnosing callback failures.
6. Keep the final custom domain and credential rotation out of this task.

## Safe disposable-account provisioning (no user passwords needed)

Run this **only from the existing trusted local Wrangler/Supabase machine**,
after deploying the exact `origin/master` SHA:

```sh
pnpm test:e2e:disposable
```

The Node runner reads existing `.env.local` and gitignored
`.wrangler-secrets.local` **in memory**. It does not display keys, change
credentials, or commit secret values. It refuses to proceed if the Worker
`/api/health` build SHA differs from local `origin/master`. It generates
two random, unique `@example.test` accounts using the authorized
Supabase Admin API (email preconfirmed **without sending any email**).
It performs real owner vs cross-user RLS probes, publishes and unpublishes
a synthetic profile through the actual Worker, and runs the browser suite
with disposable credentials only in subprocess environment variables.

One browser test **deletes the second disposable account**, and the runner
verifies the first survives. Finally, it deletes the first account and
attempts to remove any leftover QA rows. No existing user account is touched.
An ID-only local `.qa-disposable-ids.local` checkpoint is left if cleanup
fails; inspect before manually cleaning **only those IDs**.

**Important limitations:** preconfirmed synthetic users do not verify SMTP
delivery or actual signup/recovery emails. The full resume/ATS/tailoring
customer workflow needs additional browser assertions and actual fixtures
before it may be marked complete.
