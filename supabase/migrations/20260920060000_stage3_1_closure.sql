-- Stage 3.1 Closure Migration
-- Adds template_key, accent_key, section_order, hidden_sections to profile_preferences
-- Creates apply_resume_import RPC function
-- Creates public-safe view for published profiles

BEGIN;

-- 1. Drop policies that depend on columns being removed
DROP POLICY IF EXISTS "Preferences: anon can read published" ON public.profile_preferences;

-- 2. Drop is_public, published_at from profile_preferences
-- (Use profiles.visibility as source of truth)
ALTER TABLE public.profile_preferences
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS published_at;

-- 3. Add new columns to profile_preferences
ALTER TABLE public.profile_preferences
  ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS accent_key text NOT NULL DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS section_order jsonb NOT NULL DEFAULT '["about","experience","education","projects","skills","links"]'::jsonb,
  ADD COLUMN IF NOT EXISTS hidden_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4. Drop old columns that are no longer needed
ALTER TABLE public.profile_preferences
  DROP COLUMN IF EXISTS custom_domain,
  DROP COLUMN IF EXISTS seo_title,
  DROP COLUMN IF EXISTS seo_description,
  DROP COLUMN IF EXISTS theme;

-- 5. Create apply_resume_import RPC function
CREATE OR REPLACE FUNCTION public.apply_resume_import(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_owner uuid;
  v_profile_id uuid;
BEGIN
  -- Get the profile_id from the payload
  v_profile_id := (payload->>'profile_id')::uuid;

  -- Verify the caller owns this profile
  SELECT user_id INTO v_owner
  FROM public.profiles
  WHERE id = v_profile_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_owner != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: you do not own this profile';
  END IF;

  -- Apply experience entries
  IF payload ? 'experience' THEN
    FOR i IN 0..jsonb_array_length(payload->'experience')-1 LOOP
      INSERT INTO public.profile_experiences (
        profile_id, role, company, location, start_year, start_month, end_year, end_month, is_current, description, sort_order
      ) VALUES (
        v_profile_id,
        (payload->'experience'->i->>'role'),
        (payload->'experience'->i->>'company'),
        (payload->'experience'->i->>'location'),
        (payload->'experience'->i->>'start_year')::int,
        (payload->'experience'->i->>'start_month')::int,
        (payload->'experience'->i->>'end_year')::int,
        (payload->'experience'->i->>'end_month')::int,
        COALESCE((payload->'experience'->i->>'is_current')::boolean, false),
        (payload->'experience'->i->>'description'),
        i
      );
    END LOOP;
  END IF;

  -- Apply education entries
  IF payload ? 'education' THEN
    FOR i IN 0..jsonb_array_length(payload->'education')-1 LOOP
      INSERT INTO public.profile_education (
        profile_id, institution, degree, field_of_study, start_year, start_month, end_year, end_month, description, sort_order
      ) VALUES (
        v_profile_id,
        (payload->'education'->i->>'institution'),
        (payload->'education'->i->>'degree'),
        (payload->'education'->i->>'field_of_study'),
        (payload->'education'->i->>'start_year')::int,
        (payload->'education'->i->>'start_month')::int,
        (payload->'education'->i->>'end_year')::int,
        (payload->'education'->i->>'end_month')::int,
        (payload->'education'->i->>'description'),
        i
      );
    END LOOP;
  END IF;

  -- Apply skills (case-insensitive dedup)
  IF payload ? 'skills' THEN
    FOR i IN 0..jsonb_array_length(payload->'skills')-1 LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.profile_skills
        WHERE profile_id = v_profile_id AND lower(name) = lower((payload->'skills'->i->>'name'))
      ) THEN
        INSERT INTO public.profile_skills (profile_id, name, category, sort_order)
        VALUES (
          v_profile_id,
          (payload->'skills'->i->>'name'),
          (payload->'skills'->i->>'category'),
          i
        );
      END IF;
    END LOOP;
  END IF;

  -- Apply projects
  IF payload ? 'projects' THEN
    FOR i IN 0..jsonb_array_length(payload->'projects')-1 LOOP
      INSERT INTO public.profile_projects (
        profile_id, name, description, project_url, repository_url, sort_order
      ) VALUES (
        v_profile_id,
        (payload->'projects'->i->>'name'),
        (payload->'projects'->i->>'description'),
        (payload->'projects'->i->>'project_url'),
        (payload->'projects'->i->>'repository_url'),
        i
      );
    END LOOP;
  END IF;

  -- Apply links (URL-based dedup)
  IF payload ? 'links' THEN
    FOR i IN 0..jsonb_array_length(payload->'links')-1 LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.profile_links
        WHERE profile_id = v_profile_id AND url = (payload->'links'->i->>'url')
      ) THEN
        INSERT INTO public.profile_links (profile_id, label, url, sort_order)
        VALUES (
          v_profile_id,
          (payload->'links'->i->>'label'),
          (payload->'links'->i->>'url'),
          i
        );
      END IF;
    END LOOP;
  END IF;

  -- Apply basics (update display_name, headline, about if provided)
  IF payload ? 'basics' THEN
    UPDATE public.profiles SET
      display_name = COALESCE((payload->'basics'->>'display_name'), display_name),
      headline = COALESCE((payload->'basics'->>'headline'), headline),
      about = COALESCE((payload->'basics'->>'about'), about),
      location = COALESCE((payload->'basics'->>'location'), location)
    WHERE id = v_profile_id;
  END IF;

END;
$$;

-- 6. Revoke and grant execute permissions
REVOKE EXECUTE ON FUNCTION public.apply_resume_import(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_resume_import(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_resume_import(jsonb) TO authenticated;

-- 7. Create public-safe view for published profiles
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  username,
  display_name,
  headline,
  about,
  location,
  avatar_url,
  visibility,
  published_at,
  created_at,
  updated_at
FROM public.profiles
WHERE visibility = 'published';

-- 8. Grant SELECT on public view to anon
GRANT SELECT ON public.public_profiles TO anon;

-- 9. Revoke anonymous access to child tables
REVOKE SELECT ON public.profile_experiences FROM anon;
REVOKE SELECT ON public.profile_education FROM anon;
REVOKE SELECT ON public.profile_projects FROM anon;
REVOKE SELECT ON public.profile_skills FROM anon;
REVOKE SELECT ON public.profile_links FROM anon;
REVOKE SELECT ON public.profile_preferences FROM anon;

COMMIT;
