-- Stage 4: GitHub Integration Migration
-- Creates tables for GitHub connections, repositories, and profile evidence

begin;

-- ============================================================
-- 1. github_connections
-- ============================================================
create table if not exists public.github_connections (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  installation_id   bigint not null,
  github_account_id bigint not null,
  github_account_login text not null,
  github_account_type  text not null default 'User',
  status            text not null default 'active'
                    check (status in ('active','inactive','pending','error')),
  connected_at      timestamptz not null default now(),
  last_synced_at    timestamptz,
  last_sync_status  text,
  last_error_code   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.github_connections is 'Stores GitHub App installation links per profile';

create index if not exists idx_github_connections_profile_id
  on public.github_connections(profile_id);

create index if not exists idx_github_connections_installation_id
  on public.github_connections(installation_id);

-- ============================================================
-- 2. github_repositories
-- ============================================================
create table if not exists public.github_repositories (
  id                  uuid primary key default gen_random_uuid(),
  connection_id       uuid not null references public.github_connections(id) on delete cascade,
  github_repo_id      bigint not null,
  owner_login         text not null,
  name                text not null,
  full_name           text not null,
  description         text,
  html_url            text not null,
  is_private          boolean not null default false,
  is_fork             boolean not null default false,
  is_archived         boolean not null default false,
  default_branch      text not null default 'main',
  primary_language    text,
  languages           jsonb not null default '[]'::jsonb,
  topics              jsonb not null default '[]'::jsonb,
  stars_count         integer not null default 0,
  forks_count         integer not null default 0,
  github_created_at   timestamptz,
  github_updated_at   timestamptz,
  github_pushed_at    timestamptz,
  default_branch_sha  text,
  selected_for_evidence boolean not null default false,
  show_publicly       boolean not null default false,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique(connection_id, github_repo_id)
);

comment on table public.github_repositories is 'Mirrors of GitHub repos linked to a connection';

create index if not exists idx_github_repos_connection_id
  on public.github_repositories(connection_id);

create index if not exists idx_github_repos_full_name
  on public.github_repositories(full_name);

create index if not exists idx_github_repos_selected
  on public.github_repositories(selected_for_evidence)
  where selected_for_evidence = true;

-- ============================================================
-- 3. profile_evidence
-- ============================================================
create table if not exists public.profile_evidence (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  github_repository_id  uuid references public.github_repositories(id) on delete set null,
  evidence_type         text not null
                        check (evidence_type in (
                          'commit','pull_request','issue','release',
                          'code_review','contribution','project'
                        )),
  subject               text not null,
  summary               text not null,
  source_path           text,
  source_url            text,
  source_commit_sha     text,
  metadata              jsonb not null default '{}'::jsonb,
  is_public             boolean not null default false,
  observed_at           timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profile_evidence is 'Evidence items derived from GitHub activity';

create index if not exists idx_profile_evidence_profile_id
  on public.profile_evidence(profile_id);

create index if not exists idx_profile_evidence_type
  on public.profile_evidence(evidence_type);

create index if not exists idx_profile_evidence_public
  on public.profile_evidence(is_public)
  where is_public = true;

-- ============================================================
-- 4. updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger github_connections_updated_at
  before update on public.github_connections
  for each row execute function public.set_updated_at();

create trigger github_repositories_updated_at
  before update on public.github_repositories
  for each row execute function public.set_updated_at();

create trigger profile_evidence_updated_at
  before update on public.profile_evidence
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. Row-Level Security policies
-- ============================================================

-- github_connections
alter table public.github_connections enable row level security;

create policy "Users can view own GitHub connections"
  on public.github_connections for select
  using (profile_id = auth.uid());

create policy "Users can insert own GitHub connections"
  on public.github_connections for insert
  with check (profile_id = auth.uid());

create policy "Users can update own GitHub connections"
  on public.github_connections for update
  using (profile_id = auth.uid());

create policy "Users can delete own GitHub connections"
  on public.github_connections for delete
  using (profile_id = auth.uid());

-- github_repositories
alter table public.github_repositories enable row level security;

create policy "Users can view own repositories"
  on public.github_repositories for select
  using (
    connection_id in (
      select id from public.github_connections
      where profile_id = auth.uid()
    )
  );

create policy "Users can insert own repositories"
  on public.github_repositories for insert
  with check (
    connection_id in (
      select id from public.github_connections
      where profile_id = auth.uid()
    )
  );

create policy "Users can update own repositories"
  on public.github_repositories for update
  using (
    connection_id in (
      select id from public.github_connections
      where profile_id = auth.uid()
    )
  );

create policy "Users can delete own repositories"
  on public.github_repositories for delete
  using (
    connection_id in (
      select id from public.github_connections
      where profile_id = auth.uid()
    )
  );

-- profile_evidence
alter table public.profile_evidence enable row level security;

create policy "Users can view own evidence"
  on public.profile_evidence for select
  using (profile_id = auth.uid());

create policy "Users can insert own evidence"
  on public.profile_evidence for insert
  with check (profile_id = auth.uid());

create policy "Users can update own evidence"
  on public.profile_evidence for update
  using (profile_id = auth.uid());

create policy "Users can delete own evidence"
  on public.profile_evidence for delete
  using (profile_id = auth.uid());

-- Public: anyone can read public evidence for published profiles
create policy "Public read for public evidence"
  on public.profile_evidence for select
  using (is_public = true);

-- ============================================================
-- 6. Public-safe view for published evidence
-- ============================================================
create or replace view public.published_evidence as
select
  pe.id,
  pe.profile_id,
  pe.evidence_type,
  pe.subject,
  pe.summary,
  pe.source_path,
  pe.source_url,
  pe.source_commit_sha,
  pe.metadata,
  pe.observed_at,
  gr.full_name        as repository_full_name,
  gr.html_url         as repository_url,
  gr.primary_language as repository_language,
  gr.topics           as repository_topics
from public.profile_evidence pe
left join public.github_repositories gr
  on gr.id = pe.github_repository_id
where pe.is_public = true;

comment on view public.published_evidence is 'Public-safe evidence view (no private repos or internal IDs)';

-- ============================================================
-- 7. Grants (service-role only for admin writes)
-- ============================================================
grant select on public.published_evidence to anon;
grant select on public.published_evidence to authenticated;

commit;
