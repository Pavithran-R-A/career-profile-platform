-- Profile achievements (lightweight, HiveResume-inspired)
--
-- Lets a candidate express a concrete win: what they did, how they did it,
-- what changed (free-text metric), with an optional public source URL.
-- Deliberately NOT a scoring system: no strength, no rank, no computed
-- "impact score" — just curated, citable statements.
--
-- Safety:
--   * RLS: owner-only select/insert/update/delete via profiles.user_id
--   * the anon-safe public_profiles view exposes rows only when
--     is_public = true on a published profile, and only public-safe columns
--   * source_url is validated http(s) at the application boundary

BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  metric_text text,
  timeframe text,
  source_url text,
  is_featured boolean not null default false,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_achievements_title_len check (char_length(title) <= 200),
  constraint profile_achievements_description_len check (char_length(description) <= 2000),
  constraint profile_achievements_metric_len check (char_length(metric_text) <= 300),
  constraint profile_achievements_timeframe_len check (char_length(timeframe) <= 60),
  constraint profile_achievements_source_len check (char_length(source_url) <= 500)
);

comment on table public.profile_achievements is
  'Owner-curated achievements: what was done, how, and what changed; opt-in public exposure';

CREATE INDEX IF NOT EXISTS idx_profile_achievements_profile
  ON public.profile_achievements (profile_id, sort_order);

ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements: owner can select"
  ON public.profile_achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_achievements.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Achievements: owner can insert"
  ON public.profile_achievements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_achievements.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Achievements: owner can update"
  ON public.profile_achievements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_achievements.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Achievements: owner can delete"
  ON public.profile_achievements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_achievements.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

REVOKE ALL ON public.profile_achievements FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_achievements TO authenticated;

COMMIT;
