# Security

## Trust Boundaries

| Boundary          | Trust Level | Examples                                               |
| ----------------- | ----------- | ------------------------------------------------------ |
| Browser           | Untrusted   | User input, localStorage                               |
| Supabase Client   | Trusted     | Uses publishable key only                              |
| Cloudflare Worker | Trusted     | API routes, public projection boundary, server secrets |
| Supabase Database | Trusted     | RLS enforcement, auth.uid() verification               |

## Threat Model

### In Scope (Stage 1)

- Unauthorized profile access (mitigated by RLS)
- Publishable key exposure (only in browser code)
- Service-role key exposure (never in browser code)
- Open redirect attacks (mitigated by URL validation)
- XSS via profile fields/URLs (mitigated by URL scheme validation)
- CSRF on state-changing operations
- Session hijacking (mitigated by Supabase session management)
- Username enumeration (not revealing email ownership)
- Dependency supply chain vulnerabilities

### Mitigations

- **RLS-first Supabase design:** Every table has owner-only policies
- **Explicit GRANT statements:** Client roles receive only intended operations; production public projection views are server-only after cutover
- **Environment validation:** Fail fast on missing config
- **Input validation via Zod:** At system boundaries
- **URL scheme validation:** Rejects javascript:, data:, vbscript:, blob:
- **Open redirect protection:** Only allows internal paths
- **Output encoding:** React JSX automatic escaping
- **No secrets in source control:** .gitignore enforced
- **CORS headers:** Deliberate configuration on Worker responses
- **Dependency audit:** Via pnpm

## Secrets Policy

- Never commit .env files
- Service-role keys stay in server environment only
- Publishable keys are safe for browser use
- OAuth tokens encrypted at rest (future)
- Resume files treated as sensitive user data

## RLS Model

### Profiles Table

- **SELECT:** `auth.uid() = user_id`
- **INSERT:** `WITH CHECK (auth.uid() = user_id)`
- **UPDATE:** `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- **DELETE:** `USING (auth.uid() = user_id)`

### Child Tables

- All operations verify parent profile ownership via EXISTS check
- Anonymous users cannot access private application tables

### Published profile boundary

- Browser public-profile reads use `GET /api/public/profile/:username`.
- The Worker holds the server-side Supabase credential; it is never returned to the browser.
- The database projection still contains the published-only predicates and safe-column projection.
- Production cutover sets those views to `security_invoker=true` and revokes `anon`/`authenticated` grants, removing direct public Data API access.

## OAuth Considerations

- Google OAuth deferred to avoid coupling with GitHub integration
- Future OAuth flows must use PKCE
- Tokens stored server-side only
- Refresh tokens handled by Supabase client

## File Upload Risks

- Resume uploads validate MIME type and PDF magic bytes
- File/resource bounds enforced in the shared extraction boundary: 6 MiB
  input, %PDF magic bytes, 20 pages, 100k extracted characters, a
  deterministic 10-second parse timeout, password-protected PDF rejection,
  and document cleanup after extraction. The Worker additionally rejects
  oversized downloads before parsing.
- Storage bucket is private; access goes through RLS-scoped paths (`{userId}/{fileId}.pdf`)
- No direct public access to uploaded files

## Account Deletion

- `POST /api/account/delete` requires a valid session **and** recent
  authentication: the access token's `iat` must be within the last 10
  minutes (`REAUTH_REQUIRED` otherwise). Long-lived sessions re-authenticate
  in the UI first.
- Deletion order: durable pending-deletion marker → Storage objects (resumes
  bucket) → explicit non-cascading rows (`user_subscriptions`,
  `resume_sources`) → Supabase Auth admin delete (cascades all remaining
  owned rows **and** the marker row).
- **These steps are NOT one transaction.** Deletion is therefore designed to
  be idempotent and recoverable, not atomic:
  - already-absent Storage objects and already-deleted rows are success
    ("0 affected"), never errors;
  - a 404 from the auth admin delete means a prior attempt already deleted
    the user — the retry completes successfully;
  - every request re-runs the whole plan, so a retry after any failure
    safely continues from wherever the previous attempt stopped.
- A durable `account_deletion_requests` row is upserted at the start of each
  attempt (stage: requested → storage_cleaned → rows_cleaned → completed;
  attempts counter). It makes interrupted attempts observable and retries
  explicit. It is written only by the worker (no client policies at all)
  and is cascade-deleted with the auth user, so no orphan marker survives.
- **Partial-failure truthfulness:** if cleanup steps succeeded but the auth
  delete failed, the customer is told exactly that — "We couldn't finish
  deleting your account. Some cleanup may already have completed. Please
  retry." — with no implementation details exposed. The account is NOT
  claimed to be fully intact in that state.
- The admin/secret key is used only inside the worker; the browser never
  sees it and no admin operation is exposed through any client path.
- Cross-user isolation: all cleanup is keyed by the userId verified against
  the fresh session; the client never supplies an identifier, and Storage
  paths are additionally prefix-filtered to that userId.
- The UI path (`/dashboard/account/delete`) is noindex, requires typing
  "DELETE", states the permanence warning, and signs the user out on success.

## CORS Policy

- **Health endpoint:** Allows configured origins
- **API routes:** Same-origin preferred for authenticated requests
- **No wildcard origins with credentials**

## Open Redirect Protection

- Login redirect only allows internal paths starting with `/`
- Protocol-relative URLs (`//`) rejected
- Absolute URLs with protocol rejected
- Empty strings rejected
