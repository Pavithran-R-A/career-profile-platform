-- Resume import v2
-- Rebuilds the transactional apply_resume_import RPC so the review/apply
-- flow can:
--   * apply all six sections (experience, education, projects, skills,
--     links, basics) in one transaction
--   * dedupe against existing profile content (no silent duplicates)
--   * never fabricate dates: entries missing a valid start year are
--     skipped and counted, not back-filled
--   * return a machine-readable summary so the client can report exactly
--     what was added and what was skipped
--
-- Contract (jsonb payload):
--   {
--     "profile_id": "uuid",
--     "experience": [{ "role", "company", "location"?, "start_year",
--                      "start_month"?, "end_year"?, "end_month"?,
--                      "is_current"?, "description"? }],
--     "education":  [{ "institution", "degree"?, "field_of_study"?,
--                      "start_year"?, "start_month"?, "end_year"?,
--                      "end_month"?, "description"? }],
--     "projects":   [{ "name", "description"?, "project_url"?,
--                      "repository_url"? }],
--     "skills":     [{ "name", "category"? }],
--     "links":      [{ "label"?, "url" }],
--     "basics":     { "display_name"?, "headline"?, "about"?, "location"? }
--   }
--
-- Return value (jsonb):
--   { "inserted": { experience, education, projects, skills, links },
--     "skipped":  { experience, education, projects, skills, links },
--     "basics_updated": boolean }
--
-- Basics never overwrite existing non-empty values (COALESCE).

BEGIN;

CREATE OR REPLACE FUNCTION public.safe_int(value text, fallback int)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value ~ '^\d{1,4}$' THEN (value)::int
    ELSE fallback
  END;
$$;

DROP FUNCTION IF EXISTS public.apply_resume_import(jsonb);

CREATE FUNCTION public.apply_resume_import(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_profile_id uuid;
  v_item jsonb;
  v_year int;
  v_ins_ex int := 0;
  v_skip_ex int := 0;
  v_ins_ed int := 0;
  v_skip_ed int := 0;
  v_ins_pr int := 0;
  v_skip_pr int := 0;
  v_ins_sk int := 0;
  v_skip_sk int := 0;
  v_ins_lk int := 0;
  v_skip_lk int := 0;
  v_basics_touched boolean := false;
BEGIN
  IF payload ? NOT 'profile_id' THEN
    RAISE EXCEPTION 'profile_id is required';
  END IF;

  IF payload->>'profile_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'profile_id must be a valid UUID';
  END IF;
  v_profile_id := (payload->>'profile_id')::uuid;

  SELECT user_id INTO v_owner
  FROM public.profiles
  WHERE id = v_profile_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: you do not own this profile';
  END IF;

  -- ── Experience (dedupe on company+role+start year) ──────────
  IF jsonb_typeof(payload->'experience') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(payload->'experience')
    LOOP
      IF v_item->>'role' IS NULL OR v_item->>'company' IS NULL THEN
        v_skip_ex := v_skip_ex + 1;
        CONTINUE;
      END IF;
      v_year := public.safe_int(v_item->>'start_year', NULL);
      IF v_year IS NULL OR v_year < 1900 OR v_year > 2100 THEN
        v_skip_ex := v_skip_ex + 1;
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.profile_experiences existing
        WHERE existing.profile_id = v_profile_id
          AND lower(existing.company) = lower(v_item->>'company')
          AND lower(existing.role) = lower(v_item->>'role')
          AND existing.start_year = v_year
      ) THEN
        v_skip_ex := v_skip_ex + 1;
        CONTINUE;
      END IF;
      INSERT INTO public.profile_experiences
        (profile_id, role, company, location, start_year, start_month,
         end_year, end_month, is_current, description, sort_order)
      VALUES
        (
          v_profile_id,
          trim(v_item->>'role'),
          trim(v_item->>'company'),
          NULLIF(trim(v_item->>'location'), ''),
          v_year,
          CASE WHEN public.safe_int(v_item->>'start_month', 0) BETWEEN 1 AND 12
               THEN public.safe_int(v_item->>'start_month', 0) END,
          CASE WHEN COALESCE((v_item->>'is_current')::boolean, false) THEN NULL
               WHEN public.safe_int(v_item->>'end_year', 0) BETWEEN 1900 AND 2100
               THEN public.safe_int(v_item->>'end_year', 0) END,
          CASE WHEN COALESCE((v_item->>'is_current')::boolean, false) THEN NULL
               WHEN public.safe_int(v_item->>'end_month', 0) BETWEEN 1 AND 12
               THEN public.safe_int(v_item->>'end_month', 0) END,
          COALESCE((v_item->>'is_current')::boolean, false),
          NULLIF(trim(v_item->>'description'), ''),
          (SELECT COALESCE(MAX(sort_order), -1) + 1
           FROM public.profile_experiences
           WHERE profile_id = v_profile_id)
        );
      v_ins_ex := v_ins_ex + 1;
    END LOOP;
  END IF;

  -- ── Education (dedupe on institution+degree) ────────────────
  IF jsonb_typeof(payload->'education') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(payload->'education')
    LOOP
      IF v_item->>'institution' IS NULL THEN
        v_skip_ed := v_skip_ed + 1;
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.profile_education existing
        WHERE existing.profile_id = v_profile_id
          AND lower(existing.institution) = lower(v_item->>'institution')
          AND lower(coalesce(existing.degree, '')) = lower(coalesce(v_item->>'degree', ''))
      ) THEN
        v_skip_ed := v_skip_ed + 1;
        CONTINUE;
      END IF;
      INSERT INTO public.profile_education
        (profile_id, institution, degree, field_of_study,
         start_year, start_month, end_year, end_month, description, sort_order)
      VALUES
        (
          v_profile_id,
          trim(v_item->>'institution'),
          NULLIF(trim(v_item->>'degree'), ''),
          NULLIF(trim(v_item->>'field_of_study'), ''),
          CASE WHEN public.safe_int(v_item->>'start_year', 0) BETWEEN 1900 AND 2100
               THEN public.safe_int(v_item->>'start_year', 0) END,
          CASE WHEN public.safe_int(v_item->>'start_month', 0) BETWEEN 1 AND 12
               THEN public.safe_int(v_item->>'start_month', 0) END,
          CASE WHEN public.safe_int(v_item->>'end_year', 0) BETWEEN 1900 AND 2100
               THEN public.safe_int(v_item->>'end_year', 0) END,
          CASE WHEN public.safe_int(v_item->>'end_month', 0) BETWEEN 1 AND 12
               THEN public.safe_int(v_item->>'end_month', 0) END,
          NULLIF(trim(v_item->>'description'), ''),
          (SELECT COALESCE(MAX(sort_order), -1) + 1
           FROM public.profile_education
           WHERE profile_id = v_profile_id)
        );
      v_ins_ed := v_ins_ed + 1;
    END LOOP;
  END IF;

  -- ── Projects (dedupe on name+url) ───────────────────────────
  IF jsonb_typeof(payload->'projects') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(payload->'projects')
    LOOP
      IF v_item->>'name' IS NULL THEN
        v_skip_pr := v_skip_pr + 1;
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.profile_projects existing
        WHERE existing.profile_id = v_profile_id
          AND lower(existing.name) = lower(v_item->>'name')
          AND coalesce(lower(existing.project_url), '') = coalesce(lower(v_item->>'project_url'), '')
      ) THEN
        v_skip_pr := v_skip_pr + 1;
        CONTINUE;
      END IF;
      INSERT INTO public.profile_projects
        (profile_id, name, description, project_url, repository_url, sort_order)
      VALUES
        (
          v_profile_id,
          trim(v_item->>'name'),
          NULLIF(trim(v_item->>'description'), ''),
          NULLIF(trim(v_item->>'project_url'), ''),
          NULLIF(trim(v_item->>'repository_url'), ''),
          (SELECT COALESCE(MAX(sort_order), -1) + 1
           FROM public.profile_projects
           WHERE profile_id = v_profile_id)
        );
      v_ins_pr := v_ins_pr + 1;
    END LOOP;
  END IF;

  -- ── Skills (case-insensitive dedupe) ────────────────────────
  IF jsonb_typeof(payload->'skills') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(payload->'skills')
    LOOP
      IF v_item->>'name' IS NULL THEN
        v_skip_sk := v_skip_sk + 1;
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.profile_skills existing
        WHERE existing.profile_id = v_profile_id
          AND lower(existing.name) = lower(v_item->>'name')
      ) THEN
        v_skip_sk := v_skip_sk + 1;
        CONTINUE;
      END IF;
      INSERT INTO public.profile_skills (profile_id, name, category, sort_order)
      VALUES
        (
          v_profile_id,
          trim(v_item->>'name'),
          NULLIF(trim(v_item->>'category'), ''),
          (SELECT COALESCE(MAX(sort_order), -1) + 1
           FROM public.profile_skills
           WHERE profile_id = v_profile_id)
        );
      v_ins_sk := v_ins_sk + 1;
    END LOOP;
  END IF;

  -- ── Links (url required, URL-based dedupe) ──────────────────
  IF jsonb_typeof(payload->'links') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(payload->'links')
    LOOP
      IF v_item->>'url' IS NULL OR v_item->>'url' !~* '^https?://' THEN
        v_skip_lk := v_skip_lk + 1;
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.profile_links existing
        WHERE existing.profile_id = v_profile_id
          AND lower(existing.url) = lower(v_item->>'url')
      ) THEN
        v_skip_lk := v_skip_lk + 1;
        CONTINUE;
      END IF;
      INSERT INTO public.profile_links (profile_id, label, url, sort_order)
      VALUES
        (
          v_profile_id,
          COALESCE(
            NULLIF(trim(v_item->>'label'), ''),
            CASE WHEN v_item->>'url' ~* '^https?://'
                 THEN split_part(v_item->>'url', '/', 3)
                 ELSE 'Link' END
          ),
          trim(v_item->>'url'),
          (SELECT COALESCE(MAX(sort_order), -1) + 1
           FROM public.profile_links
           WHERE profile_id = v_profile_id)
        );
      v_ins_lk := v_ins_lk + 1;
    END LOOP;
  END IF;

  -- ── Basics (fill empty fields only, never overwrite) ───────
  IF jsonb_typeof(payload->'basics') = 'object' THEN
    UPDATE public.profiles SET
      display_name = COALESCE(NULLIF(trim(payload->'basics'->>'display_name'), ''), display_name),
      headline = COALESCE(NULLIF(trim(payload->'basics'->>'headline'), ''), headline),
      about = COALESCE(NULLIF(trim(payload->'basics'->>'about'), ''), about),
      location = COALESCE(NULLIF(trim(payload->'basics'->>'location'), ''), location)
    WHERE id = v_profile_id;

    IF NULLIF(trim(payload->'basics'->>'display_name'), '') IS NOT NULL
       OR NULLIF(trim(payload->'basics'->>'headline'), '') IS NOT NULL
       OR NULLIF(trim(payload->'basics'->>'about'), '') IS NOT NULL
       OR NULLIF(trim(payload->'basics'->>'location'), '') IS NOT NULL THEN
      v_basics_touched := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'inserted', jsonb_build_object(
      'experience', v_ins_ex,
      'education', v_ins_ed,
      'projects', v_ins_pr,
      'skills', v_ins_sk,
      'links', v_ins_lk
    ),
    'skipped', jsonb_build_object(
      'experience', v_skip_ex,
      'education', v_skip_ed,
      'projects', v_skip_pr,
      'skills', v_skip_sk,
      'links', v_skip_lk
    ),
    'basics_updated', v_basics_touched
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_resume_import(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_resume_import(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_resume_import(jsonb) TO authenticated;

COMMENT ON FUNCTION public.apply_resume_import(jsonb) IS
  'Transactionally apply reviewed resume-import sections to the owning profile with dedupe; returns inserted/skipped summary';

COMMIT;
