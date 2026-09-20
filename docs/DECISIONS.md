# Architectural Decisions

## ADR-001: Cloudflare Workers + Supabase

**Decision:** Use Cloudflare Workers for API/static hosting and Supabase for database/auth/storage.

**Alternatives Rejected:**

- Vercel/Next.js: Serverless functions have cold start concerns; Supabase still needed.
- Self-hosted PostgreSQL: Operational overhead contradicts zero-cost bootstrap goal.
- Firebase: Less flexible RLS; vendor lock-in concerns.

**Rationale:** Cloudflare Workers free tier is generous. Supabase free tier includes PostgreSQL with RLS, auth, and storage. Combined cost is ₹0 for MVP.

## ADR-002: Canonical Profile as JSONB in Single Table

**Decision:** Store profile sections (experiences, education, projects, skills, links) as JSONB arrays in a single profiles table for Stage 0.

**Alternatives Rejected:**

- Separate relational tables for each section: More joins, more migration complexity at this stage.
- Document database (MongoDB): Loses RLS, SQL power, and Supabase compatibility.

**Rationale:** JSONB provides flexibility for schema evolution without destructive migrations. Normalized tables can be introduced later if query patterns demand it.

## ADR-003: No Router Library

**Decision:** Use pathname-based routing without a client-side router library.

**Alternatives Rejected:**

- React Router: Adds bundle size and complexity not justified for 2-3 pages in Stage 0.
- TanStack Router: Overkill for current route count.

**Rationale:** Simple switch-case routing is sufficient for the app shell. A router can be introduced when route count exceeds ~5.

## ADR-004: AI Provider Abstraction Without Implementation

**Decision:** Define the `AIProvider` interface but do not implement any real provider.

**Alternatives Rejected:**

- Implementing a mock provider: Risks being mistaken for production code.
- Hardcoding a specific provider SDK: Creates vendor coupling.

**Rationale:** The interface locks in the architectural boundary. Implementation belongs in Stage 2+.
