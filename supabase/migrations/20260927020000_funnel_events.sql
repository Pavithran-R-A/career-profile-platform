-- First-party funnel events (private-beta instrumentation)
--
-- Privacy rules enforced at the schema level:
--   * event_name is a fixed allowlist (no free-text event names)
--   * metadata must be a small jsonb object (<= 2 KiB) — callers apply a
--     key allowlist before insert; resume text, job text, emails, phone
--     numbers, IPs and user agents are never stored
--   * rows are owner-scoped: a user can insert and read only their own
--     events; no update or delete for anyone; anon has no access
--   * no profile content, no resume content, no PII columns

BEGIN;

CREATE TABLE public.funnel_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  event_name text not null check (event_name in (
    'signup_started',
    'signup_completed',
    'profile_created',
    'profile_updated',
    'resume_uploaded',
    'resume_extraction_reviewed',
    'profile_completed',
    'portfolio_previewed',
    'portfolio_published',
    'portfolio_unpublished',
    'ats_generated',
    'ats_downloaded',
    'tailoring_started',
    'tailoring_completed'
  )),
  metadata   jsonb not null default '{}'::jsonb
             check (jsonb_typeof(metadata) = 'object' and length(metadata::text) <= 2048),
  created_at timestamptz not null default now()
);

comment on table public.funnel_events is
  'Privacy-safe first-party funnel milestones for funnel debugging; no PII, no document content';
comment on column public.funnel_events.metadata is
  'Small allowlisted key/value bag only (source, section, template, reason, count)';

create index idx_funnel_events_user_created
  on public.funnel_events (user_id, created_at desc);

create index idx_funnel_events_event_name
  on public.funnel_events (event_name);

alter table public.funnel_events enable row level security;

create policy "Users can insert own funnel events"
  on public.funnel_events for insert
  with check (user_id = auth.uid());

create policy "Users can view own funnel events"
  on public.funnel_events for select
  using (user_id = auth.uid());

revoke all on public.funnel_events from anon, public;
grant insert, select on public.funnel_events to authenticated;

commit;
