-- Follow-up to 20260930100000: the two public evidence views were created
-- WITH (security_invoker = true), which makes them execute with the CALLING
-- role's privileges. Since anon has zero base-table grants (by design), anon
-- could not read the safe views at all.
--
-- Recreate them WITHOUT security_invoker so they execute with the view
-- owner's rights — the standard Supabase pattern used by public_profiles.
-- This is safe BY CONSTRUCTION: the projection exposes only the safe
-- columns, and the four-condition public gate (published profile +
-- is_public + repo not private + repo.show_publicly) is part of the view
-- definition itself. Anon still has no direct base-table privileges and the
-- never-matching RLS policy still blocks any other direct path.

BEGIN;

DROP VIEW IF EXISTS public.published_evidence;

CREATE VIEW public.published_evidence AS
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

DROP VIEW IF EXISTS public.published_evidence_non_repo;

CREATE VIEW public.published_evidence_non_repo AS
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

COMMIT;
