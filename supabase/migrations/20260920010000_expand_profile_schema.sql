-- Stage 1: Expand profile schema

-- Drop existing RLS policies first
drop policy if exists "Profiles: owner can select" on public.profiles;
drop policy if exists "Profiles: owner can insert" on public.profiles;
drop policy if exists "Profiles: owner can update" on public.profiles;
drop policy if exists "Profiles: owner can delete" on public.profiles;

-- Expand profiles table
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists headline text;
alter table public.profiles add column if not exists about text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists avatar_url text;

-- Add unique constraint on user_id (one profile per user)
alter table public.profiles add constraint profiles_user_id_unique unique (user_id);

-- Create profile_experiences table
create table public.profile_experiences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  role text not null,
  location text,
  start_year integer not null,
  start_month integer,
  end_year integer,
  end_month integer,
  is_current boolean not null default false,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create profile_education table
create table public.profile_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  institution text not null,
  degree text,
  field_of_study text,
  start_year integer,
  start_month integer,
  end_year integer,
  end_month integer,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create profile_projects table
create table public.profile_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  project_url text,
  repository_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create profile_skills table
create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create profile_links table
create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on all tables
alter table public.profile_experiences enable row level security;
alter table public.profile_education enable row level security;
alter table public.profile_projects enable row level security;
alter table public.profile_skills enable row level security;
alter table public.profile_links enable row level security;

-- Re-create profiles RLS policies
create policy "Profiles: owner can select"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Profiles: owner can insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Profiles: owner can update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Profiles: owner can delete"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- RLS policies for profile_experiences
create policy "Experiences: owner can select"
  on public.profile_experiences for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_experiences.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Experiences: owner can insert"
  on public.profile_experiences for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Experiences: owner can update"
  on public.profile_experiences for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_experiences.profile_id
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

create policy "Experiences: owner can delete"
  on public.profile_experiences for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_experiences.profile_id
        and profiles.user_id = auth.uid()
    )
  );

-- RLS policies for profile_education
create policy "Education: owner can select"
  on public.profile_education for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_education.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Education: owner can insert"
  on public.profile_education for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Education: owner can update"
  on public.profile_education for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_education.profile_id
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

create policy "Education: owner can delete"
  on public.profile_education for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_education.profile_id
        and profiles.user_id = auth.uid()
    )
  );

-- RLS policies for profile_projects
create policy "Projects: owner can select"
  on public.profile_projects for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_projects.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Projects: owner can insert"
  on public.profile_projects for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Projects: owner can update"
  on public.profile_projects for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_projects.profile_id
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

create policy "Projects: owner can delete"
  on public.profile_projects for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_projects.profile_id
        and profiles.user_id = auth.uid()
    )
  );

-- RLS policies for profile_skills
create policy "Skills: owner can select"
  on public.profile_skills for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Skills: owner can insert"
  on public.profile_skills for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Skills: owner can update"
  on public.profile_skills for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_skills.profile_id
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

create policy "Skills: owner can delete"
  on public.profile_skills for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.user_id = auth.uid()
    )
  );

-- RLS policies for profile_links
create policy "Links: owner can select"
  on public.profile_links for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_links.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Links: owner can insert"
  on public.profile_links for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_id
        and profiles.user_id = auth.uid()
    )
  );

create policy "Links: owner can update"
  on public.profile_links for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_links.profile_id
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

create policy "Links: owner can delete"
  on public.profile_links for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_links.profile_id
        and profiles.user_id = auth.uid()
    )
  );

-- Add triggers for updated_at
create trigger set_updated_at
  before update on public.profile_experiences
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.profile_education
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.profile_projects
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.profile_skills
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.profile_links
  for each row
  execute function public.handle_updated_at();