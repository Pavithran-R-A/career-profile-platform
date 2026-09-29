-- github_connections upserts per profile require a unique constraint.
-- The dashboard/API treat one connection per profile as the data model
-- (.limit(1) reads, onConflict 'profile_id' writes); enforce it in the DB.
-- Safe: no production rows exist yet (integration was never live).

BEGIN;

-- Remove any pre-existing duplicates, keeping the newest per profile.
DELETE FROM public.github_connections a
USING public.github_connections b
WHERE a.profile_id = b.profile_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS github_connections_profile_id_key
  ON public.github_connections(profile_id);

COMMIT;
