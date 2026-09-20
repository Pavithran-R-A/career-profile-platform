-- Stage 1.2: Corrective migration to revoke broad anon grants
-- The security hardening migration's REVOKE statements were overridden
-- by Supabase's default public grants. This migration explicitly revokes
-- anon access for defense in depth.

-- Revoke ALL from anon on application tables (defense in depth)
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profile_experiences FROM anon;
REVOKE ALL ON public.profile_education FROM anon;
REVOKE ALL ON public.profile_projects FROM anon;
REVOKE ALL ON public.profile_skills FROM anon;
REVOKE ALL ON public.profile_links FROM anon;

-- Ensure authenticated has only the necessary permissions
-- (Supabase default grants already provide these, but being explicit)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_experiences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_education TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_links TO authenticated;
