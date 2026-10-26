-- Worker write boundary + domain provider columns.
--
-- Every legitimate write to these tables flows through the Worker with the
-- service-role key (github connect/sync, create_custom_domain_atomic,
-- refresh/remove). Owner INSERT/UPDATE policies let any authenticated token
-- bypass that boundary:
--   * github_connections: an installation_id is a small enumerable integer —
--     inserting a row that names ANOTHER customer's installation and then
--     calling /api/github/sync would ingest the victim's repositories.
--   * custom_domains / dotcv_domains: direct inserts skip the quota RPC and
--     can set status='active' without any provider provisioning.
-- Direct owner writes are not used by any client code, so the permissive
-- policies are dropped (SELECT keeps working; the Worker keeps its
-- service-role access). Delete policies are retained: GitHub disconnect and
-- domain removal paths are worker-handled, but keeping owner DELETE matches
-- the remaining RLS surface without granting anything new.
--
-- The custom_domains columns below are written by handleAddCustomDomain /
-- handleRefreshCustomDomain (provider's OWN verification + SSL state) but
-- were never created by any migration, so those updates silently failed
-- (PGRST204) and a provisioned domain could never reach 'active'. Creating
-- them is REQUIRED for custom-domain provisioning to function.
--
-- funnel_events gains the missing FK to auth.users so analytics rows
-- cascade on account deletion, matching docs/SECURITY.md's cascade promise.

BEGIN;

ALTER TABLE public.custom_domains
  ADD COLUMN IF NOT EXISTS provider_validation jsonb,
  ADD COLUMN IF NOT EXISTS provider_validation_http jsonb,
  ADD COLUMN IF NOT EXISTS ssl_status text,
  ADD COLUMN IF NOT EXISTS ssl_validation_records jsonb;

DROP POLICY IF EXISTS "Users can insert own GitHub connections"
  ON public.github_connections;
DROP POLICY IF EXISTS "Users can update own GitHub connections"
  ON public.github_connections;

DROP POLICY IF EXISTS "Custom domains: owner can insert"
  ON public.custom_domains;
DROP POLICY IF EXISTS "DotCV domains: owner can insert"
  ON public.dotcv_domains;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'funnel_events_user_id_fkey'
  ) THEN
    ALTER TABLE public.funnel_events
      ADD CONSTRAINT funnel_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
