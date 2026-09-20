-- Stage 2: Resume ingestion model

-- Create resume_sources table
create table public.resume_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  byte_size integer not null,
  sha256 text,
  page_count integer,
  status text not null default 'uploaded' check (status in ('uploaded', 'extracting', 'extracted', 'structuring', 'structured', 'applying', 'applied', 'error')),
  structured_draft jsonb,
  warnings jsonb default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.resume_sources enable row level security;

-- RLS policies for resume_sources
create policy "Resume sources: owner can select"
  on public.resume_sources for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = resume_sources.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Resume sources: owner can insert"
  on public.resume_sources for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Resume sources: owner can update"
  on public.resume_sources for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = resume_sources.profile_id
        and profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Resume sources: owner can delete"
  on public.resume_sources for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = resume_sources.profile_id
        and profiles.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
create trigger set_updated_at
  before update on public.resume_sources
  for each row
  execute function public.handle_updated_at();

-- Add index for profile_id lookups
create index idx_resume_sources_profile_id on public.resume_sources(profile_id);
