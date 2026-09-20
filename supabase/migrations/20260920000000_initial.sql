create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  visibility text not null default 'draft' check (visibility in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_lower_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

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

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();