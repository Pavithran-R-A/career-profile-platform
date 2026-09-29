-- Public evidence rows must validate against the production Zod
-- EvidenceSchema (src/lib/profiles/public.ts), which requires `id: uuid`.
-- The previous view omitted ev.id, so any published profile with public
-- evidence failed schema validation and rendered as "Profile not found".
--
-- Full view/schema parity audit (migration 20260928010000 vs Zod DTO):
--   profile basics, experiences, education, skills, projects, links,
--   achievements, preferences — all fields already match exactly.
--   evidence — every field matched except the missing `id`.
-- The view is dropped and recreated inside this transaction (CREATE OR
-- REPLACE VIEW cannot add a column at a specific position). Only published,
-- owner-opted-in public data is exposed, so the brief recreate is safe;
-- grants are reapplied below.

BEGIN;

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

COMMIT;
