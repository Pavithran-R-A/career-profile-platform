-- Entitlement enforcement (P1-D):
-- 1. Atomic recruiter-AI daily quota: consume_recruiter_quota increments the
--    per-user usage_counters row only while under the plan limit, returning
--    the new count. Concurrent requests serialize on the row lock, so the
--    limit cannot be exceeded by racing calls.
-- 2. Server-owned resume-variant creation: create_profile_variant resolves
--    the owning profile, counts existing variants, and inserts — all in one
--    transaction — so the advertised Free/Pro limits are real. The direct
--    client INSERT policy on profile_variants is removed; owners keep
--    select/update/delete.
-- 3. 'tailoring' leaves usage_counters: deterministic tailoring is unlimited
--    and not metered.

BEGIN;

-- ── 1. Recruiter AI quota RPC ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.consume_recruiter_quota(
  p_user_id uuid,
  p_limit integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.usage_counters (user_id, metric, window_key, count)
  VALUES (p_user_id, 'recruiter_ai', to_char(now(), 'YYYY-MM-DD'), 1)
  ON CONFLICT (user_id, metric, window_key)
  DO UPDATE SET count = public.usage_counters.count + 1, updated_at = now()
  WHERE public.usage_counters.count < p_limit
  RETURNING count INTO v_count;

  -- No row returned → the limit was already reached; nothing was consumed.
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_recruiter_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_recruiter_quota(uuid, integer) TO service_role;

-- ── 2. Server-owned variant creation RPC ──────────────────────

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
  -- Resolve ownership from the profiles table; refuse unknown profiles.
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

-- ── 3. Close the client INSERT bypass ─────────────────────────

DROP POLICY IF EXISTS "Variants: owner can insert" ON public.profile_variants;

-- ── 4. Retire the unmetered 'tailoring' metric ────────────────

ALTER TABLE public.usage_counters DROP CONSTRAINT IF EXISTS usage_counters_metric_check;
ALTER TABLE public.usage_counters ADD CONSTRAINT usage_counters_metric_check
  CHECK (metric IN ('resume_variants', 'github_repos', 'recruiter_ai', 'custom_domains'));

COMMIT;
