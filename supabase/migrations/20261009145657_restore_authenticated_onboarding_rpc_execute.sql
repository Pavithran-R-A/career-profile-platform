-- Restore the authenticated customer onboarding RPC.
--
-- Initial onboarding uses supabase.rpc('create_profile_with_basics') in the
-- browser with the authenticated user's access token. The older
-- evidence_public_boundary migration granted EXECUTE only to service_role.
-- Consequently even legitimate customers received a permission error.
--
-- SECURITY INVOKER is preserved: profile INSERT/UPDATE/SELECT execute under
-- the calling user's role, and profiles RLS checks user_id = auth.uid().
REVOKE EXECUTE ON FUNCTION public.create_profile_with_basics(
  uuid, text, text, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_profile_with_basics(
  uuid, text, text, text, text, text
) TO authenticated;
