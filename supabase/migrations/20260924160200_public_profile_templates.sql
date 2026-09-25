-- Extend the anon-safe public view with the presentation data the portfolio
-- templates need (relations + saved preferences), so anonymous visitors see
-- the same template-rendered portfolio owners preview.
--
-- Security preserved:
--   * only published profiles are visible (WHERE below)
--   * no user_id or other internal columns are exposed
--   * aggregates contain only fields already intended for public portfolios
--   * grants on the view are unchanged (SELECT already granted to anon)

CREATE OR REPLACE VIEW public.public_profiles AS
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
