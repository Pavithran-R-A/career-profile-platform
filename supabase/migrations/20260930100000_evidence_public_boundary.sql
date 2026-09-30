-- SECOND SOURCE-REVIEW CLOSURE — database boundary repairs (forward-only).
--
-- 1. published_evidence becomes a genuinely public-safe projection. A
--    GitHub-backed evidence row is publicly readable ONLY when ALL of:
--      profile.visibility = 'published'
--      AND evidence.is_public = true
--      AND repository.is_private = false
--      AND repository.show_publicly = true
--    The old view joined repositories with LEFT JOIN and only checked
--    is_public + visibility, so a private repo's evidence could be anon-
--    readable if its owner flipped is_public — and it exposed metadata
--    (author_email, commit messages), source_path, and internal ids.
--    The new view exposes no metadata, no author_email, no source_path,
--    no installation ids, no private-repo identifiers. An INNER JOIN means
--    non-repository evidence never leaks through it; the explicit rule for
--    non-repo evidence is the separate published_evidence_non_repo view
--    (safe subjects only, and only rows without a source_path).
-- 2. Anon direct privileges on profile_evidence / github_repositories /
--    github_connections are revoked. Anon consumes safe views only.
-- 3. The RLS "public read" policy on profile_evidence is replaced with a
--    never-matching policy: public consumers go through the views, period.
--    (Defense in depth: even if a future view forgot security_invoker or a
--    grant crept back, anon still reads zero base rows.)
-- 4. public_profiles' evidence aggregate gets the same four-condition
--    gating (previously only is_public + visibility).
-- 5. Quota/lifecycle RPCs (atomic, lock-serialized):
--      select_github_repository        — repo-selection quota + mutate
--      refund_github_repository_select — release on failure
--      create_custom_domain_atomic     — domain quota + pending insert
--      release_custom_domain_slot      — release after provider failure
--      refund_recruiter_quota          — provider-failure refund (>= 0)
--      create_profile_with_basics      — ONE-insert atomic onboarding
--    create_profile_variant gains an advisory lock so COUNT→INSERT is
--    serialized per profile (concurrency fix).

BEGIN;

-- ── 1. published_evidence: safe projection, four-condition gate ─────────

DROP VIEW IF EXISTS public.published_evidence;

CREATE VIEW public.published_evidence
WITH (security_invoker = true) AS
SELECT
  pe.id,
  pe.profile_id,
  pe.evidence_type,
  pe.subject,
  pe.summary,
  pe.source_url,
  pe.source_commit_sha,
  pe.observed_at,
  gr.full_name        AS repository_full_name,
  gr.html_url         AS repository_url,
  gr.primary_language AS repository_language,
  gr.topics           AS repository_topics
FROM public.profile_evidence pe
JOIN public.profiles p
  ON p.id = pe.profile_id AND p.visibility = 'published'
JOIN public.github_repositories gr
  ON gr.id = pe.github_repository_id
 AND gr.is_private = false
 AND gr.show_publicly = true
WHERE pe.is_public = true;

COMMENT ON VIEW public.published_evidence IS
  'Public-safe GitHub evidence: published profile + evidence.is_public + repo not private + repo.show_publicly. No metadata, author_email, source_path, or installation/private-repo identifiers.';

GRANT SELECT ON public.published_evidence TO anon;
GRANT SELECT ON public.published_evidence TO authenticated;

-- Non-repository evidence has its OWN explicit public rule: it may appear
-- only when the profile is published, the row is is_public, and it carries
-- no source_path (source_path is the classic internal-details leak). Same
-- safe projection; no metadata.
DROP VIEW IF EXISTS public.published_evidence_non_repo;

CREATE VIEW public.published_evidence_non_repo
WITH (security_invoker = true) AS
SELECT
  pe.id,
  pe.profile_id,
  pe.evidence_type,
  pe.subject,
  pe.summary,
  pe.source_url,
  pe.source_commit_sha,
  pe.observed_at
FROM public.profile_evidence pe
JOIN public.profiles p
  ON p.id = pe.profile_id AND p.visibility = 'published'
WHERE pe.is_public = true
  AND pe.github_repository_id IS NULL
  AND pe.source_path IS NULL;

GRANT SELECT ON public.published_evidence_non_repo TO anon;
GRANT SELECT ON public.published_evidence_non_repo TO authenticated;

-- ── 2. Anon base-table privilege revocation ─────────────────────────────

REVOKE ALL ON public.profile_evidence FROM anon;
REVOKE ALL ON public.github_repositories FROM anon;
REVOKE ALL ON public.github_connections FROM anon;

-- ── 3. RLS: anon can never read base evidence rows ──────────────────────

DROP POLICY IF EXISTS "Public read for public evidence" ON public.profile_evidence;

CREATE POLICY "Public evidence reads only via safe views"
  ON public.profile_evidence FOR select
  USING (false);

-- ── 4. public_profiles: four-condition evidence aggregate ───────────────
-- (full recreate; column set unchanged from 20260929130000)

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.headline,
  p.about,
  p.location,
  p.avatar_url,
  p.visibility,
  p.published_at,
  p.created_at,
  p.updated_at,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'profile_id', e.profile_id,
          'company', e.company,
          'role', e.role,
          'location', e.location,
          'start_year', e.start_year,
          'start_month', e.start_month,
          'end_year', e.end_year,
          'end_month', e.end_month,
          'is_current', e.is_current,
          'description', e.description,
          'sort_order', e.sort_order,
          'created_at', e.created_at,
          'updated_at', e.updated_at
        )
        ORDER BY e.sort_order, e.created_at
      )
      FROM public.profile_experiences e
      WHERE e.profile_id = p.id
    ),
    '[]'::jsonb
  ) AS experiences,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ed.id,
          'profile_id', ed.profile_id,
          'institution', ed.institution,
          'degree', ed.degree,
          'field_of_study', ed.field_of_study,
          'start_year', ed.start_year,
          'start_month', ed.start_month,
          'end_year', ed.end_year,
          'end_month', ed.end_month,
          'description', ed.description,
          'sort_order', ed.sort_order,
          'created_at', ed.created_at,
          'updated_at', ed.updated_at
        )
        ORDER BY ed.sort_order, ed.created_at
      )
      FROM public.profile_education ed
      WHERE ed.profile_id = p.id
    ),
    '[]'::jsonb
  ) AS education,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'profile_id', s.profile_id,
          'name', s.name,
          'category', s.category,
          'sort_order', s.sort_order,
          'created_at', s.created_at,
          'updated_at', s.updated_at
        )
        ORDER BY s.sort_order, s.created_at
      )
      FROM public.profile_skills s
      WHERE s.profile_id = p.id
    ),
    '[]'::jsonb
  ) AS skills,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'profile_id', pr.profile_id,
          'name', pr.name,
          'description', pr.description,
          'project_url', pr.project_url,
          'repository_url', pr.repository_url,
          'sort_order', pr.sort_order,
          'created_at', pr.created_at,
          'updated_at', pr.updated_at
        )
        ORDER BY pr.sort_order, pr.created_at
      )
      FROM public.profile_projects pr
      WHERE pr.profile_id = p.id
    ),
    '[]'::jsonb
  ) AS projects,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'profile_id', l.profile_id,
          'label', l.label,
          'url', l.url,
          'sort_order', l.sort_order,
          'created_at', l.created_at,
          'updated_at', l.updated_at
        )
        ORDER BY l.sort_order, l.created_at
      )
      FROM public.profile_links l
      WHERE l.profile_id = p.id
    ),
    '[]'::jsonb
  ) AS links,
  COALESCE(
    (
      SELECT jsonb_agg(ev_row)
      FROM (
        SELECT jsonb_build_object(
          'id', ev.id,
          'evidence_type', ev.evidence_type,
          'subject', ev.subject,
          'summary', ev.summary,
          'source_url', ev.source_url,
          'source_commit_sha', ev.source_commit_sha,
          'observed_at', ev.observed_at,
          'repository_full_name', gr.full_name,
          'repository_url', gr.html_url,
          'repository_language', gr.primary_language,
          'repository_topics', gr.topics
        ) AS ev_row
        FROM public.profile_evidence ev
        JOIN public.github_repositories gr
          ON gr.id = ev.github_repository_id
         AND gr.is_private = false
         AND gr.show_publicly = true
        WHERE ev.profile_id = p.id AND ev.is_public = true
        ORDER BY ev.observed_at DESC
        LIMIT 24
      ) evidence_rows
    ),
    '[]'::jsonb
  ) AS evidence,
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
          'id', a.id,
          'title', a.title,
          'description', a.description,
          'metric_text', a.metric_text,
          'timeframe', a.timeframe,
          'source_url', a.source_url,
          'is_featured', a.is_featured,
          'sort_order', a.sort_order
        ) ORDER BY a.is_featured DESC, a.sort_order, a.created_at)
      FROM public.profile_achievements a
      WHERE a.profile_id = p.id AND a.is_public = true
    ),
    '[]'::jsonb
  ) AS achievements,
  jsonb_build_object(
    'template_key', COALESCE(pref.template_key, 'minimal'),
    'accent_key', COALESCE(pref.accent_key, 'blue'),
    'section_order', COALESCE(
      pref.section_order,
      '["basics","experience","education","projects","skills","links"]'::jsonb
    ),
    'hidden_sections', COALESCE(pref.hidden_sections, '[]'::jsonb)
  ) AS preferences
FROM public.profiles p
LEFT JOIN public.profile_preferences pref ON pref.profile_id = p.id
WHERE p.visibility = 'published';

GRANT SELECT ON public.public_profiles TO anon;

-- ── 5. Atomic repo-selection quota (GitHub repos) ───────────────────────
-- Serialize per connection with an advisory lock, then count → validate →
-- mutate inside one transaction. Returns the github_repo_id, or NULL when
-- the plan limit is reached, or 'not_found' sentinel is expressed via a
-- NULL p_repo_id guard (caller must pass a real repo id).

CREATE OR REPLACE FUNCTION public.select_github_repository(
  p_connection_id uuid,
  p_repo_id uuid,
  p_limit integer
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_ok boolean;
  v_selected integer;
  v_is_selected boolean;
  v_repo_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('github_repos:' || p_connection_id::text, 0));

  -- The connection must exist; ownership is enforced by the caller (service
  -- role resolves it from the authenticated principal).
  SELECT id INTO v_repo_id
    FROM public.github_repositories
   WHERE id = p_repo_id AND connection_id = p_connection_id;
  IF v_repo_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT selected_for_evidence INTO v_is_selected
    FROM public.github_repositories WHERE id = p_repo_id;

  IF v_is_selected THEN
    -- Unselecting always succeeds.
    UPDATE public.github_repositories
       SET selected_for_evidence = false
     WHERE id = p_repo_id;
    RETURN p_repo_id;
  END IF;

  SELECT count(*) INTO v_selected
    FROM public.github_repositories
   WHERE connection_id = p_connection_id AND selected_for_evidence = true;

  IF p_limit IS NOT NULL AND v_selected >= p_limit THEN
    RETURN NULL;
  END IF;

  UPDATE public.github_repositories
     SET selected_for_evidence = true
   WHERE id = p_repo_id;

  RETURN p_repo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_github_repository(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_github_repository(uuid, uuid, integer) TO service_role;

-- Release one selection slot when a follow-on operation (e.g. evidence
-- generation) fails and the caller wants the selection rolled back.
CREATE OR REPLACE FUNCTION public.refund_github_repository_select(
  p_repo_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.github_repositories
     SET selected_for_evidence = false
   WHERE id = p_repo_id AND selected_for_evidence = true;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_github_repository_select(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_github_repository_select(uuid) TO service_role;

-- ── 6. Atomic custom-domain creation + slot release ─────────────────────
-- Quota counts only slot-reserving states (pending / pending_validation /
-- active). 'failed' and 'removed' do NOT reserve a slot, so a provider
-- failure never permanently consumes the user's only domain slot, and a
-- unique-hostname collision after a transient failure is retryable.

CREATE OR REPLACE FUNCTION public.create_custom_domain_atomic(
  p_profile_id uuid,
  p_hostname text,
  p_limit integer
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner uuid;
  v_used integer;
  v_new_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('custom_domains:' || p_profile_id::text, 0));

  SELECT user_id INTO v_owner FROM public.profiles WHERE id = p_profile_id;
  IF v_owner IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_used
    FROM public.custom_domains
   WHERE profile_id = p_profile_id
     AND status IN ('pending', 'pending_validation', 'active');

  IF p_limit IS NULL OR p_limit <= 0 OR v_used >= p_limit THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.custom_domains (profile_id, hostname, status)
  VALUES (p_profile_id, lower(p_hostname), 'pending')
  ON CONFLICT (hostname) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    UPDATE public.custom_domains
       SET status = 'pending', last_error = NULL
     WHERE hostname = lower(p_hostname)
       AND profile_id = p_profile_id
       AND status IN ('failed', 'removed')
     RETURNING id INTO v_new_id;
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_custom_domain_atomic(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_domain_atomic(uuid, text, integer) TO service_role;

-- Release a slot after a provider failure: the row is marked failed (safe
-- customer-facing error only), so it stops consuming quota and can be
-- retried or removed.
CREATE OR REPLACE FUNCTION public.release_custom_domain_slot(
  p_domain_id uuid,
  p_safe_error text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.custom_domains
     SET status = 'failed',
         last_error = left(coalesce(p_safe_error, 'provider_unavailable'), 200)
   WHERE id = p_domain_id
     AND status IN ('pending', 'pending_validation');
END;
$$;

REVOKE ALL ON FUNCTION public.release_custom_domain_slot(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_custom_domain_slot(uuid, text) TO service_role;

-- ── 7. Recruiter quota refund on provider failure ───────────────────────
--consume_recruiter_quota already consumes atomically; add the failure-path
--refund. Never refunds below zero. Only called when NO answer was produced.

CREATE OR REPLACE FUNCTION public.refund_recruiter_quota(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.usage_counters
     SET count = GREATEST(count - 1, 0),
         updated_at = now()
   WHERE user_id = p_user_id
     AND metric = 'recruiter_ai'
     AND window_key = to_char(now(), 'YYYY-MM-DD')
     AND count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_recruiter_quota(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_recruiter_quota(uuid) TO service_role;

-- ── 8. Atomic onboarding: ONE insert with basics ────────────────────────
-- Failure between "create profile" and "save basics" previously left a
-- partial profile and a retry tried a duplicate insert. Now the profile row
-- (user_id, username, display_name, headline, about, location) is created in
-- ONE statement. Retry/resume: if the caller already owns a profile, it is
-- UPDATED instead of duplicated. Returns the profile id, or NULL when the
-- username is taken by someone else.

CREATE OR REPLACE FUNCTION public.create_profile_with_basics(
  p_user_id uuid,
  p_username text,
  p_display_name text,
  p_headline text,
  p_about text,
  p_location text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile_id uuid;
  v_existing_user uuid;
  v_username_owner uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('profile_create:' || p_user_id::text, 0));

  -- Resume path: the caller already owns a profile → update, never duplicate.
  SELECT id INTO v_existing_user FROM public.profiles WHERE user_id = p_user_id;
  IF v_existing_user IS NOT NULL THEN
    UPDATE public.profiles
       SET display_name = COALESCE(NULLIF(p_display_name, ''), display_name),
           headline     = COALESCE(NULLIF(p_headline, ''), headline),
           about        = COALESCE(NULLIF(p_about, ''), about),
           location     = COALESCE(NULLIF(p_location, ''), location)
     WHERE id = v_existing_user;
    RETURN v_existing_user;
  END IF;

  -- Username collision with a DIFFERENT user's profile.
  SELECT user_id INTO v_username_owner FROM public.profiles
   WHERE lower(username) = lower(p_username);
  IF v_username_owner IS NOT NULL AND v_username_owner <> p_user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name, headline, about, location)
  VALUES (p_user_id, p_username, NULLIF(p_display_name, ''), NULLIF(p_headline, ''),
          NULLIF(p_about, ''), NULLIF(p_location, ''))
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_with_basics(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_with_basics(uuid, text, text, text, text, text)
  TO service_role;

-- ── 9. Variant quota: serialize COUNT→INSERT per profile ────────────────

CREATE OR REPLACE FUNCTION public.create_profile_variant(
  p_profile_id uuid,
  p_name text,
  p_target_role text,
  p_target_company text,
  p_job_requirements jsonb,
  p_variant_data jsonb,
  p_limit integer
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner uuid;
  v_existing integer;
  v_new_id uuid;
BEGIN
  -- Serialize concurrent creations for the same profile so two racing
  -- requests cannot both pass the count check.
  PERFORM pg_advisory_xact_lock(hashtextextended('profile_variants:' || p_profile_id::text, 0));

  SELECT user_id INTO v_owner FROM public.profiles WHERE id = p_profile_id;
  IF v_owner IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_existing
    FROM public.profile_variants
    WHERE profile_id = p_profile_id;

  IF p_limit IS NOT NULL AND v_existing >= p_limit THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.profile_variants (
    profile_id, name, target_role, target_company,
    job_requirements, variant_data, status
  ) VALUES (
    p_profile_id, p_name, p_target_role, p_target_company,
    p_job_requirements, p_variant_data, 'draft'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_variant(uuid, text, text, text, jsonb, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_variant(uuid, text, text, text, jsonb, jsonb, integer)
  TO service_role;

COMMIT;
