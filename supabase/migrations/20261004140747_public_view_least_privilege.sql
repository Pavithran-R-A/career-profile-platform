-- CVentory launch: make the intentional anonymous publication views
-- explicitly read-only at the privilege layer.
--
-- These views are owner-rights by design because their source tables remain
-- private to anon. Their definitions are the publication boundary: published
-- profiles only, safe projected columns only, and explicit evidence gates.

begin;

revoke all privileges on table public.public_profiles from public, anon, authenticated;
revoke all privileges on table public.published_evidence from public, anon, authenticated;
revoke all privileges on table public.published_evidence_non_repo from public, anon, authenticated;

grant select on table public.public_profiles to anon, authenticated;
grant select on table public.published_evidence to anon, authenticated;
grant select on table public.published_evidence_non_repo to anon, authenticated;

commit;
