-- CVentory production cutover: public projection views become server-only.
--
-- DEPLOYMENT ORDER MATTERS:
-- 1. Configure SUPABASE_SECRET_KEY on the production Worker.
-- 2. Deploy the release Worker that serves /api/public/profile/:username and
--    uses the server credential for SEO/sitemap/recruiter projection reads.
-- 3. Smoke-test that Worker path while the current owner-rights views remain.
-- 4. Only then apply this migration.
--
-- Applying this migration before deploying the new Worker would intentionally
-- remove the anonymous database path used by older clients.

begin;

alter view public.public_profiles set (security_invoker = true);
alter view public.published_evidence set (security_invoker = true);
alter view public.published_evidence_non_repo set (security_invoker = true);

revoke all privileges on table public.public_profiles from public, anon, authenticated;
revoke all privileges on table public.published_evidence from public, anon, authenticated;
revoke all privileges on table public.published_evidence_non_repo from public, anon, authenticated;

grant select on table public.public_profiles to service_role;
grant select on table public.published_evidence to service_role;
grant select on table public.published_evidence_non_repo to service_role;

comment on view public.public_profiles is
  'Server-only published profile projection. security_invoker=true; client roles have no grants. Public reads are served by the CVentory Worker.';
comment on view public.published_evidence is
  'Server-only published GitHub evidence projection. security_invoker=true; client roles have no grants.';
comment on view public.published_evidence_non_repo is
  'Server-only published non-repository evidence projection. security_invoker=true; client roles have no grants.';

commit;
