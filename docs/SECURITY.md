# Security

## Trust Boundaries

| Boundary          | Trust Level | Examples                                 |
| ----------------- | ----------- | ---------------------------------------- |
| Browser           | Untrusted   | User input, localStorage                 |
| Supabase Client   | Trusted     | Uses publishable key only                |
| Cloudflare Worker | Trusted     | API routes, health endpoint              |
| Supabase Database | Trusted     | RLS enforcement, auth.uid() verification |

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
- **Explicit GRANT statements:** Authenticated role receives only intended operations
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
- Anonymous users cannot access any application data

## OAuth Considerations

- Google OAuth deferred to avoid coupling with GitHub integration
- Future OAuth flows must use PKCE
- Tokens stored server-side only
- Refresh tokens handled by Supabase client

## File Upload Risks

- Resume uploads validate MIME type and PDF magic bytes
- File size limits enforced (6 MiB, 20 pages)
- Storage bucket is private; access goes through RLS-scoped paths (`{userId}/{fileId}.pdf`)
- No direct public access to uploaded files

## Account Deletion

- `POST /api/account/delete` requires a valid session **and** recent
  authentication: the access token's `iat` must be within the last 10
  minutes (`REAUTH_REQUIRED` otherwise). Long-lived sessions re-authenticate
  in the UI first.
- Deletion order: Storage objects (resumes bucket) → explicit non-cascading
  rows (`user_subscriptions`, `resume_sources`) → Supabase Auth admin delete
  (cascades all remaining owned rows).
- The admin/secret key is used only inside the worker; the browser never
  sees it and no admin operation is exposed through any client path.
- Failure semantics: storage/row cleanup problems are logged and skipped;
  a failed auth delete returns 502 and the account remains fully usable so
  the user can retry — no observable half-deleted state.
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
