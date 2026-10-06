-- CVentory launch hardening.
-- Backward-compatible: no application contract or public-view projection changes.

begin;

-- Least privilege: this table had legacy anon non-SELECT grants. RLS blocked
-- access, but anon does not need any direct table privilege.
revoke all privileges on table public.profile_preferences from anon;

-- Fix mutable search_path findings without changing existing unqualified
-- function bodies. pg_temp is kept last so temporary objects cannot shadow
-- public application objects.
alter function public.handle_updated_at() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.safe_int(text, integer) set search_path = public, pg_temp;
alter function public.consume_recruiter_quota(uuid, integer) set search_path = public, pg_temp;
alter function public.create_custom_domain_atomic(uuid, text, integer) set search_path = public, pg_temp;
alter function public.create_profile_variant(uuid, text, text, text, jsonb, jsonb, integer) set search_path = public, pg_temp;
alter function public.create_profile_with_basics(uuid, text, text, text, text, text) set search_path = public, pg_temp;
alter function public.process_paid_order_webhook(text, text, text, text) set search_path = public, pg_temp;
alter function public.refund_github_repository_select(uuid) set search_path = public, pg_temp;
alter function public.refund_recruiter_quota(uuid) set search_path = public, pg_temp;
alter function public.release_custom_domain_slot(uuid, text) set search_path = public, pg_temp;
alter function public.select_github_repository(uuid, uuid, integer) set search_path = public, pg_temp;

-- Trigger/parser helpers are implementation details, not client RPCs.
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.safe_int(text, integer) from public, anon, authenticated;

-- Cover foreign keys reported by the live performance advisor.
create index if not exists custom_domains_profile_id_idx on public.custom_domains(profile_id);
create index if not exists dotcv_domains_profile_id_idx on public.dotcv_domains(profile_id);
create index if not exists profile_education_profile_id_idx on public.profile_education(profile_id);
create index if not exists profile_evidence_github_repository_id_idx on public.profile_evidence(github_repository_id);
create index if not exists profile_experiences_profile_id_idx on public.profile_experiences(profile_id);
create index if not exists profile_links_profile_id_idx on public.profile_links(profile_id);
create index if not exists profile_projects_profile_id_idx on public.profile_projects(profile_id);
create index if not exists profile_skills_profile_id_idx on public.profile_skills(profile_id);
create index if not exists profile_variants_profile_id_idx on public.profile_variants(profile_id);

-- Intentional public-safe projections. These remain owner-rights because a
-- prior security_invoker conversion correctly blocked anonymous reads of
-- the private source tables. Their projections and predicates are covered
-- by live-RLS and public-boundary regression tests.
comment on view public.public_profiles is
  'Intentional anon-safe published-profile projection. Owner-rights view; explicit published-row filtering and safe-column projection are regression-tested.';
comment on view public.published_evidence is
  'Intentional anon-safe evidence projection. Exposes only published profiles, public repositories explicitly selected for display, and is_public evidence.';
comment on view public.published_evidence_non_repo is
  'Intentional anon-safe non-repository evidence projection. Exposes only published profiles, is_public evidence, no repository id, and no source_path.';

commit;
