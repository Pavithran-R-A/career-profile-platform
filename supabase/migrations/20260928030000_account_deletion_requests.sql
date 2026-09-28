-- Account deletion observability: durable pending-deletion marker.
--
-- Deletion spans Storage + several tables + Supabase Auth and cannot be one
-- transaction. This row makes an interrupted attempt explicit so retries are
-- observable and support can see partial progress.
--
-- Written ONLY by the worker with the server-only key:
--   * upserted (stage='requested') when a verified deletion starts
--   * advanced as each idempotent step completes
--   * cascade-deleted together with the auth user, so no orphan marker
--     survives a successful deletion
--
-- No client policies: users cannot create, read, or delete their own marker
-- (deleting it client-side would defeat observability).

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  user_id uuid PRIMARY KEY,
  stage text NOT NULL DEFAULT 'requested'
    CHECK (stage IN ('requested', 'storage_cleaned', 'rows_cleaned', 'auth_deleted', 'completed')),
  attempts integer NOT NULL DEFAULT 1,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text
);

COMMENT ON TABLE public.account_deletion_requests IS
  'Durable per-user account-deletion progress marker; written only by the worker; cascade-deleted with the auth user';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- No policies at all: service role / secret key only.

-- Marker rows reference the auth user directly so the successful auth delete
-- removes the marker automatically.
ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_user_id_fkey;
ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

REVOKE ALL ON public.account_deletion_requests FROM anon, public, authenticated;

COMMIT;
