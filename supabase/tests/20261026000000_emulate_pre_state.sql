-- Isolated-database emulation of the PRODUCTION pre-migration state for
-- migration 20261026000000, including the review-observed orphan data:
-- 190 funnel_events rows across 41 absent user ids plus 1 legitimate row.
-- All uuids are synthetic fixtures. Run against a THROWAWAY local
-- PostgreSQL — never production.
--
-- Intentionally does NOT create auth.users: running the migration in this
-- state must FAIL (the DO block reads auth.users), which is what proves the
-- single transaction rolls back with zero partial effects. See
-- 20261026000000_isolated_check.sql for the post-migration verification.
--
-- Full sequence:
--   initdb -D <pgdata> -U postgres --auth=trust -E UTF8
--   pg_ctl -D <pgdata> -o "-p 55432" -l <log> start
--   psql ... -v ON_ERROR_STOP=1 -f supabase/tests/20261026000000_emulate_pre_state.sql
--   psql ... -f supabase/migrations/20261026000000_worker_write_boundary_and_domain_provider_columns.sql
--       → must FAIL; then confirm: no new columns, no dropped policies,
--         no constraint (zero partial effects).
--   psql ... -c "create table auth.users(id uuid primary key, email text);
--                insert into auth.users values
--                  ('11111111-1111-4111-8111-111111111111','legit@example.test');"
--   psql ... -f supabase/migrations/20261026000000_worker_write_boundary_and_domain_provider_columns.sql
--       → must SUCCEED (with a WARNING reporting the orphan scope).
--   psql ... -v ON_ERROR_STOP=1 -f supabase/tests/20261026000000_isolated_check.sql
--       → must print three PASS notices and stop on any FAIL.

\set ON_ERROR_STOP on

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select null::uuid $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid
);

create table if not exists public.funnel_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  event_name text not null check (event_name in (
    'signup_started','signup_completed','profile_created','profile_updated',
    'resume_uploaded','resume_extraction_reviewed','profile_completed',
    'portfolio_previewed','portfolio_published','portfolio_unpublished',
    'ats_generated','ats_downloaded','tailoring_started','tailoring_completed'
  )),
  metadata   jsonb not null default '{}'::jsonb
             check (jsonb_typeof(metadata) = 'object' and length(metadata::text) <= 2048),
  created_at timestamptz not null default now()
);

create table if not exists public.custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_token TEXT,
  cloudflare_hostname_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

create table if not exists public.dotcv_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain_label TEXT NOT NULL,
  domain_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'quoted'
);

create table if not exists public.github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL
);

-- The four permissive policies the migration must drop (exact names).
create policy "Users can insert own GitHub connections"
  on public.github_connections for insert
  with check (exists (select 1 from public.profiles p where p.id = profile_id));
create policy "Users can update own GitHub connections"
  on public.github_connections for update
  using (exists (select 1 from public.profiles p where p.id = profile_id));
create policy "Custom domains: owner can insert"
  on public.custom_domains for insert
  with check (exists (select 1 from public.profiles p where p.id = profile_id));
create policy "DotCV domains: owner can insert"
  on public.dotcv_domains for insert
  with check (exists (select 1 from public.profiles p where p.id = profile_id));

-- Mirror production data: 190 orphan rows across exactly 41 distinct absent
-- user ids + 1 legitimate row for a REAL user (matches the 2026-10-27 review
-- observation: 191 total rows, 190 orphans, 41 distinct orphan user ids).
insert into public.funnel_events (user_id, event_name)
select
  ('00000000-0000-4000-8000-' || lpad(((x % 41) + 1)::text, 12, '0'))::uuid,
  'profile_created'
from generate_series(0, 189) as g(x);
insert into public.funnel_events (user_id, event_name) values
  ('11111111-1111-4111-8111-111111111111', 'profile_created');
