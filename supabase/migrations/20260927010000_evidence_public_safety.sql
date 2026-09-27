-- Evidence public safety + GitHub RLS ownership fix
--
-- 1. The GitHub-table RLS policies compared `profile_id = auth.uid()`,
--    i.e. a profile UUID against a user UUID. That predicate can never
--    match, so owners could not read their own connections/repos/evidence
--    through the API. Rebuild them on the profile-ownership subquery used
--    by every other table.
--
-- 2. "Public read for public evidence" and the published_evidence view
--    exposed is_public = true evidence without checking the owning
--    profile's visibility. A draft profile's public-flagged evidence was
--    therefore anon-readable. Both are now gated on visibility='published'.
--
-- 3. The anon-facing public_profiles view gains an `evidence` aggregate
--    (public-flagged evidence only, published profiles only) so public
--    portfolios can render subtle, fact-attached evidence affordances.

BEGIN;

-- ── 1. github_connections ownership policies ─────────────────
DROP POLICY IF EXISTS "Users can view own GitHub connections" ON public.github_connections;
DROP POLICY IF EXISTS "Users can insert own GitHub connections" ON public.github_connections;
DROP POLICY IF EXISTS "Users can update own GitHub connections" ON public.github_connections;
DROP POLICY IF EXISTS "Users can delete own GitHub connections" ON public.github_connections;

CREATE POLICY "Users can view own GitHub connections"
  ON public.github_connections FOR select
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = github_connections.profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own GitHub connections"
  ON public.github_connections FOR insert
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = github_connections.profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own GitHub connections"
  ON public.github_connections FOR update
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = github_connections.profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own GitHub connections"
  ON public.github_connections FOR delete
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = github_connections.profile_id AND p.user_id = auth.uid()
    )
  );

-- ── 2. github_repositories ownership policies ────────────────
DROP POLICY IF EXISTS "Users can view own repositories" ON public.github_repositories;
DROP POLICY IF EXISTS "Users can insert own repositories" ON public.github_repositories;
DROP POLICY IF EXISTS "Users can update own repositories" ON public.github_repositories;
DROP POLICY IF EXISTS "Users can delete own repositories" ON public.github_repositories;

CREATE POLICY "Users can view own repositories"
  ON public.github_repositories FOR select
  USING (
    connection_id IN (
      SELECT c.id FROM public.github_connections c
      WHERE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = c.profile_id AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own repositories"
  ON public.github_repositories FOR insert
  WITH CHECK (
    connection_id IN (
      SELECT c.id FROM public.github_connections c
      WHERE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = c.profile_id AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own repositories"
  ON public.github_repositories FOR update
  USING (
    connection_id IN (
      SELECT c.id FROM public.github_connections c
      WHERE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = c.profile_id AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own repositories"
  ON public.github_repositories FOR delete
  USING (
    connection_id IN (
      SELECT c.id FROM public.github_connections c
      WHERE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = c.profile_id AND p.user_id = auth.uid()
      )
    )
  );

-- ── 3. profile_evidence ownership policies ───────────────────
DROP POLICY IF EXISTS "Users can view own evidence" ON public.profile_evidence;
DROP POLICY IF EXISTS "Users can insert own evidence" ON public.profile_evidence;
DROP POLICY IF EXISTS "Users can update own evidence" ON public.profile_evidence;
DROP POLICY IF EXISTS "Users can delete own evidence" ON public.profile_evidence;

CREATE POLICY "Users can view own evidence"
  ON public.profile_evidence FOR select
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_evidence.profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own evidence"
  ON public.profile_evidence FOR insert
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_evidence.profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own evidence"
  ON public.profile_evidence FOR update
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_evidence.profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own evidence"
  ON public.profile_evidence FOR delete
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_evidence.profile_id AND p.user_id = auth.uid()
    )
  );

-- ── 4. Public evidence reads respect profile visibility ──────
DROP POLICY IF EXISTS "Public read for public evidence" ON public.profile_evidence;

CREATE POLICY "Public read for public evidence"
  ON public.profile_evidence FOR select
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_evidence.profile_id AND p.visibility = 'published'
    )
  );

CREATE OR REPLACE VIEW public.published_evidence AS
SELECT
  pe.id,
  pe.profile_id,
  pe.evidence_type,
  pe.subject,
  pe.summary,
  pe.source_path,
  pe.source_url,
  pe.source_commit_sha,
  pe.metadata,
  pe.observed_at,
  gr.full_name        AS repository_full_name,
  gr.html_url         AS repository_url,
  gr.primary_language AS repository_language,
  gr.topics           AS repository_topics
FROM public.profile_evidence pe
JOIN public.profiles p
  ON p.id = pe.profile_id AND p.visibility = 'published'
LEFT JOIN public.github_repositories gr
  ON gr.id = pe.github_repository_id
WHERE pe.is_public = true;

GRANT SELECT ON public.published_evidence TO anon;
GRANT SELECT ON public.published_evidence TO authenticated;

-- ── 5. public_profiles view: add public evidence aggregate ───
-- (added column shifts positions, so the view is replaced, not altered)
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
        LEFT JOIN public.github_repositories gr
          ON gr.id = ev.github_repository_id
        WHERE ev.profile_id = p.id AND ev.is_public = true
        ORDER BY ev.observed_at DESC
        LIMIT 24
      ) evidence_rows
    ),
    '[]'::jsonb
  ) AS evidence,
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

COMMIT;
