-- Stage 1.1: Security hardening - explicit grants and access control
-- This migration adds explicit GRANT statements and ensures
-- proper access control for all profile tables.

-- Revoke broad public access (defense in depth)
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profile_experiences FROM public;
REVOKE ALL ON public.profile_education FROM public;
REVOKE ALL ON public.profile_projects FROM public;
REVOKE ALL ON public.profile_skills FROM public;
REVOKE ALL ON public.profile_links FROM public;

-- Grant specific permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_experiences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_education TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_links TO authenticated;

-- Grant usage on sequences (for UUID generation)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure RLS is enabled (defense in depth)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_links ENABLE ROW LEVEL SECURITY;

-- Add month range constraints where applicable
ALTER TABLE public.profile_experiences
  ADD CONSTRAINT experiences_start_month_check
  CHECK (start_month IS NULL OR (start_month >= 1 AND start_month <= 12));

ALTER TABLE public.profile_experiences
  ADD CONSTRAINT experiences_end_month_check
  CHECK (end_month IS NULL OR (end_month >= 1 AND end_month <= 12));

ALTER TABLE public.profile_education
  ADD CONSTRAINT education_start_month_check
  CHECK (start_month IS NULL OR (start_month >= 1 AND start_month <= 12));

ALTER TABLE public.profile_education
  ADD CONSTRAINT education_end_month_check
  CHECK (end_month IS NULL OR (end_month >= 1 AND end_month <= 12));

-- Add year sanity constraints
ALTER TABLE public.profile_experiences
  ADD CONSTRAINT experiences_start_year_check
  CHECK (start_year >= 1900 AND start_year <= 2100);

ALTER TABLE public.profile_experiences
  ADD CONSTRAINT experiences_end_year_check
  CHECK (end_year IS NULL OR (end_year >= 1900 AND end_year <= 2100));

ALTER TABLE public.profile_education
  ADD CONSTRAINT education_start_year_check
  CHECK (start_year IS NULL OR (start_year >= 1900 AND start_year <= 2100));

ALTER TABLE public.profile_education
  ADD CONSTRAINT education_end_year_check
  CHECK (end_year IS NULL OR (end_year >= 1900 AND end_year <= 2100));

-- Add current experience consistency check
-- If is_current is true, end_year should be null
ALTER TABLE public.profile_experiences
  ADD CONSTRAINT experiences_current_no_end_check
  CHECK (NOT is_current OR (end_year IS NULL AND end_month IS NULL));
