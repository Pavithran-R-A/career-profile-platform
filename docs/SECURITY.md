# Security

## Trust Boundaries

| Boundary          | Trust Level | Examples                        |
| ----------------- | ----------- | ------------------------------- |
| Browser           | Untrusted   | User input, localStorage        |
| Cloudflare Worker | Trusted     | API routes, AI calls, DB access |
| Supabase          | Trusted     | PostgreSQL, RLS enforcement     |

## Threat Model

### In Scope (Stage 0)

- Unauthorized profile access (mitigated by RLS)
- Service-role key exposure (never in browser code)
- AI provider key exposure (server-side only)
- CSRF on state-changing API routes
- Excessive file upload sizes (future)
- Dependency supply chain vulnerabilities

### Mitigations

- RLS-first Supabase design: every table has owner-only policies
- Environment validation: fail fast on missing config
- Input validation via Zod at system boundaries
- Output encoding handled by React (automatic JSX escaping)
- No secrets in source control (.gitignore enforced)
- CORS headers on Worker API responses
- Dependency audit via pnpm

## Secrets Policy

- Never commit .env files
- Service-role keys stay in server environment only
- AI provider keys stay in Worker environment only
- OAuth tokens encrypted at rest (future)
- Resume files treated as sensitive user data
