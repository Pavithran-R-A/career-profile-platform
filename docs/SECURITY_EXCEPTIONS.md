# Security Exceptions — CVentory

Last reviewed: 2026-10-04

This file records security-advisor exceptions and their disposition.

## Public projection views — exception retired

The earlier release candidate temporarily retained three owner-rights views:

- `public.public_profiles`
- `public.published_evidence`
- `public.published_evidence_non_repo`

That temporary exception has now been retired in production.

### Current production design

Migration `20261004170512_server_only_public_views.sql` is applied.

The three views now:

- use `security_invoker = true`;
- grant no access to `anon`;
- grant no access to `authenticated`;
- grant `SELECT` only to `service_role`.

Browser public-profile reads use the same-origin Worker endpoint:

`GET /api/public/profile/:username`

SEO, sitemap, and recruiter projection reads also run through the Worker server boundary. The Supabase server secret never reaches browser code.

### Live verification on 2026-10-04

After the cutover:

- `anon` SELECT on all three projection views: **false**
- `authenticated` SELECT on all three projection views: **false**
- `service_role` SELECT on all three projection views: **true**
- all three views report `security_invoker=true`
- `service_role` successfully reads the published profile projection
- Supabase no longer reports any `security_definer_view` security errors

The only remaining Supabase security advisor finding is the separate Auth warning for leaked-password protection.

### Public DTO invariants

The server-side projection boundary must continue to preserve these invariants:

1. Only published profiles are returned.
2. `profiles.user_id` is never projected.
3. GitHub-backed evidence is public only when the profile is published, evidence is public, the repository is non-private, and the repository is selected for public display.
4. Public evidence never exposes `metadata`, `author_email`, `source_path`, `github_repository_id`, or GitHub installation identifiers.
5. Non-repository evidence is exposed only when it is public and has no repository/source-path association.
6. Public achievements require `profile_achievements.is_public = true`.
7. Browser code never receives a service-role/server Supabase credential.
8. Direct client access to the three projection views remains revoked.

### Revisit conditions

Re-review this boundary if any of the following changes:

- the projection view definitions;
- the public profile DTO;
- GitHub evidence publication rules;
- Worker credential handling;
- Supabase grants/RLS on any underlying table;
- a new direct browser Data API path is introduced.

Any such change requires another live anonymous-boundary test before release.
