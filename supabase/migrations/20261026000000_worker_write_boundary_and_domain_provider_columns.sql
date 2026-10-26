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
-- funnel_events FK (review finding P0-2, 2026-10-27):
-- The production table holds pre-existing rows whose user_id no longer
-- matches any auth.users row (historical deletions predate the cascade —
-- e.g. disposable QA accounts deleted via the auth admin API). A plain
-- validated FK would fail the initial scan and roll back this whole
-- transaction, so the constraint is added NOT VALID:
--   * immediately enforced for NEW inserts/updates (invalid references are
--     rejected from now on; legitimate inserts keep working);
--   * existing rows are NOT scanned or modified — nothing is deleted,
--     archived or rewritten;
--   * ON DELETE CASCADE covers all FUTURE account deletions.
-- Reconciliation of the pre-existing orphans is a SEPARATE, owner-approved
-- step, after which the constraint can be validated:
--   1. report scope (read-only):
--        select user_id, count(*) from public.funnel_events fe
--        where not exists (select 1 from auth.users u where u.id = fe.user_id)
--        group by user_id order by 2 desc;
--   2. owner decides disposition (delete / archive) for each orphan group;
--   3. only then: alter table public.funnel_events
--        validate constraint funnel_events_user_id_fkey;
-- Until VALIDATE succeeds the constraint still protects all new writes.

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
    -- Pre-flight visibility only: report the reconciliation scope without
    -- touching any row. This migration must succeed regardless of the count.
    DECLARE
      orphan_users int;
      orphan_rows  int;
    BEGIN
      SELECT count(DISTINCT fe.user_id), count(*)
        INTO orphan_users, orphan_rows
        FROM public.funnel_events fe
        WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = fe.user_id);
      IF orphan_rows > 0 THEN
        RAISE WARNING
          'funnel_events: % orphan rows across % user ids predate the cascade; reconcile (owner-approved) then VALIDATE CONSTRAINT',
          orphan_rows, orphan_users;
      END IF;
    END;

    ALTER TABLE public.funnel_events
      ADD CONSTRAINT funnel_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

COMMIT;
