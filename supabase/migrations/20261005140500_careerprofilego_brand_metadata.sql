-- CareerProfile Go brand metadata follow-up.
-- This migration changes descriptive metadata only; access-control semantics are unchanged.

begin;

comment on view public.public_profiles is
  'Server-only published profile projection. security_invoker=true; client roles have no grants. Public reads are served by the CareerProfile Go Worker.';

commit;
