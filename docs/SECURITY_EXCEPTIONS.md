# Security Exceptions — CVentory

Last reviewed: 2026-10-04

This file records intentional security-advisor findings that remain after launch hardening. An item belongs here only when removing the finding would weaken a required product boundary or introduce a materially riskier design.

## Owner-rights public projection views — temporary production state

Supabase currently reports `security_definer_view` for:

- `public.public_profiles`
- `public.published_evidence`
- `public.published_evidence_non_repo`

These views intentionally execute with the view owner's rights. The underlying profile, GitHub, and evidence tables remain unavailable to the anonymous role. A prior `security_invoker=true` conversion was live-tested and correctly caused anonymous public-profile reads to fail because anon has no base-table grants.

The owner-rights views therefore act as a deliberately narrow publication boundary rather than as a generic bypass of RLS.

### Required invariants

The release is not safe if any invariant below stops holding.

1. Base private tables remain inaccessible to `anon`.
2. The three views are granted `SELECT` only to `anon` and `authenticated`; no client role receives INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER privileges on them.
3. `public_profiles` returns only rows where `profiles.visibility = 'published'`.
4. `public_profiles` never projects `profiles.user_id`.
5. GitHub-backed evidence is exposed only when:
   - the profile is published;
   - `profile_evidence.is_public = true`;
   - the repository is not private; and
   - `github_repositories.show_publicly = true`.
6. Public evidence projections never expose `metadata`, `author_email`, `source_path`, `github_repository_id`, or GitHub installation identifiers.
7. Non-repository evidence is exposed only when the profile is published, the evidence is public, `github_repository_id IS NULL`, and `source_path IS NULL`.
8. Public-profile achievements require `profile_achievements.is_public = true`.
9. Public-profile lookups in the browser and Worker use the publishable key and the public view, never a service-role credential.

### Live verification on 2026-10-04

The live database was inspected after the launch-hardening migrations.

`public_profiles` exposes exactly:

`id, username, display_name, headline, about, location, avatar_url, visibility, published_at, created_at, updated_at, experiences, education, skills, projects, links, evidence, achievements, preferences`

`published_evidence` exposes exactly:

`id, profile_id, evidence_type, subject, summary, source_url, source_commit_sha, observed_at, repository_full_name, repository_url, repository_language, repository_topics`

`published_evidence_non_repo` exposes exactly:

`id, profile_id, evidence_type, subject, summary, source_url, source_commit_sha, observed_at`

The live definitions contain the publication predicates described above. Migration `20261004143000_public_view_least_privilege.sql` revokes all client privileges first and re-grants only SELECT.

### Why the advisor remains red

The advisor detects the execution mode, not whether a specific projection is safe. Supabase recommends security-invoker views for ordinary RLS-backed access. In this architecture, changing these views to security-invoker without also opening the private source tables to anon breaks the public portfolio contract. Opening those base tables simply to clear the lint would enlarge the anonymous attack surface.

The accepted design is therefore:

- private base tables;
- owner-rights publication views;
- narrow projections;
- row predicates embedded in the view definitions;
- SELECT-only client grants;
- regression tests and live release checks.

This is an explicit temporary exception, not a suppressed or ignored finding.

### Staged retirement

The release branch now contains `20261004154500_server_only_public_views.sql`, which retires this exception by:
- moving all browser public-profile reads behind the same-origin Worker API;
- moving SEO, sitemap, and recruiter projection reads to the Worker server credential;
- setting all three views to `security_invoker = true`; and
- revoking `anon` and `authenticated` access entirely.

A live rollback-only proof on 2026-10-04 confirmed that `service_role` can still read the published projection after those changes.

**Do not apply that migration before the new Worker is deployed with `SUPABASE_SECRET_KEY`.** Doing so would intentionally break the old anonymous database read path. The correct production order is recorded in `docs/PRODUCTION_DEPLOYMENT.md`.

Once the cutover migration is applied and the post-deploy smoke test passes, this exception is considered retired and the three `security_definer_view` advisor findings should disappear.

### Revisit conditions

Replace this exception if any of the following becomes available and proves safer in qualification:

- an isolated public snapshot/read model that remains transactionally correct for all profile relations;
- an API layer that can serve public profiles without privileged database reads in the browser;
- a Supabase access model that allows security-invoker views while keeping all private base columns and rows inaccessible.

Any future edit to these view definitions requires another live anonymous-boundary test before release.
