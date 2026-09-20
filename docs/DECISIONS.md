# Architectural Decisions

## ADR-001: Cloudflare Workers + Supabase

**Decision:** Use Cloudflare Workers for API/static hosting and Supabase for database/auth/storage.

**Alternatives Rejected:**

- Vercel/Next.js: Serverless functions have cold start concerns; Supabase still needed.
- Self-hosted PostgreSQL: Operational overhead contradicts zero-cost bootstrap goal.
- Firebase: Less flexible RLS; vendor lock-in concerns.

**Rationale:** Cloudflare Workers free tier is generous. Supabase free tier includes PostgreSQL with RLS, auth, and storage. Combined cost is ₹0 for MVP.

## ADR-002: Separate Tables for Profile Sections

**Decision:** Store profile sections (experiences, education, projects, skills, links) as separate relational tables instead of JSONB arrays.

**Alternatives Rejected:**

- JSONB arrays in single table: Limited query capability, no RLS per section, harder to enforce constraints.
- Document database: Loses RLS, SQL power, and Supabase compatibility.

**Rationale:** Separate tables enable RLS per section, proper constraints, and efficient queries. Migration complexity is acceptable for Stage 1.

## ADR-003: React Router for Client-Side Routing

**Decision:** Use React Router for client-side routing instead of pathname-based switch-case.

**Alternatives Rejected:**

- Manual pathname routing: Becomes complex with protected routes and redirects.
- TanStack Router: Overkill for current route count.

**Rationale:** React Router provides protected routes, redirects, and location state without custom implementation.

## ADR-004: AI Provider Abstraction Without Implementation

**Decision:** Define the `AIProvider` interface but do not implement any real provider.

**Alternatives Rejected:**

- Implementing a mock provider: Risks being mistaken for production code.
- Hardcoding a specific provider SDK: Creates vendor coupling.

**Rationale:** The interface locks in the architectural boundary. Implementation belongs in Stage 2+.

## ADR-005: Publishable Key Naming

**Decision:** Use `VITE_SUPABASE_PUBLISHABLE_KEY` instead of `VITE_SUPABASE_ANON_KEY`.

**Alternatives Rejected:**

- Keep legacy `VITE_SUPABASE_ANON_KEY`: Confusing naming, not aligned with current Supabase guidance.

**Rationale:** Project has not launched yet; renaming is safe and aligns with Supabase's preferred terminology.

## ADR-006: Email-Only Authentication (No OAuth)

**Decision:** Implement email/password authentication only in Stage 1. Defer Google OAuth.

**Alternatives Rejected:**

- Add Google OAuth: Risks coupling login permissions with future GitHub integration permissions.

**Rationale:** GitHub OAuth will be used for repository access in Stage 4. Keeping login OAuth separate avoids permission coupling.

## ADR-007: Client-Side Auth Flow (No Server Callback)

**Decision:** Use Supabase's implicit/client-side auth flow without server-side callback handling.

**Alternatives Rejected:**

- Server-side callback: Requires additional Worker route complexity; Supabase client handles session exchange automatically.

**Rationale:** Supabase JS client automatically handles auth state changes. No server callback needed for email/password flow.

## ADR-008: Open Redirect Protection

**Decision:** Validate redirect paths to prevent open redirect attacks.

**Alternatives Rejected:**

- Allow any redirect path: Vulnerable to phishing attacks.
- Only allow specific paths: Too restrictive for UX.

**Rationale:** Validate that paths start with `/` and don't contain protocol separators. Balances security with flexibility.

## ADR-009: URL Scheme Validation

**Decision:** Reject dangerous URL schemes (javascript:, data:, vbscript:, blob:) in user-supplied URLs.

**Alternatives Rejected:**

- Allow all URL schemes: XSS risk via javascript: URLs.
- Only validate HTTPS: Misses other dangerous schemes.

**Rationale:** Prevents XSS attacks while allowing legitimate HTTP/HTTPS URLs.
