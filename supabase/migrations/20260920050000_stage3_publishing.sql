-- Stage 3: Publishing support

-- Create profile_preferences table
create table public.profile_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade unique,
  is_public boolean not null default false,
  published_at timestamptz,
  custom_domain text,
  template_id text not null default 'minimal',
  theme jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profile_preferences enable row level security;

-- RLS policies for profile_preferences
-- Owner can manage their own preferences
create policy "Preferences: owner can select"
  on public.profile_preferences for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_preferences.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Preferences: owner can insert"
  on public.profile_preferences for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Preferences: owner can update"
  on public.profile_preferences for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_preferences.profile_id
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

create policy "Preferences: owner can delete"
  on public.profile_preferences for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_preferences.profile_id
        and profiles.user_id = auth.uid()
    )
  );

-- Anonymous can read preferences for published profiles only
create policy "Preferences: anon can read published"
  on public.profile_preferences for select
  to anon
  using (
    is_public = true
  );

-- Add trigger for updated_at
create trigger set_updated_at
  before update on public.profile_preferences
  for each row
  execute function public.handle_updated_at();
