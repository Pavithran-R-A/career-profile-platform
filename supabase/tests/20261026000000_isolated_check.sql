-- Post-migration verification for migration 20261026000000 on the isolated
-- database emulated by 20261026000000_emulate_pre_state.sql. See that file's
-- header for the full sequence. Any FAIL aborts (ON_ERROR_STOP); three PASS
-- notices mean: schema+policy+constraint state correct, orphan inserts now
-- rejected while legitimate ones pass, deletion cascades, and the documented
-- reconciliation + VALIDATE path succeeds (rolled back to preserve fixtures).

\set ON_ERROR_STOP on

do $$
declare
  cols int; policies_remaining int; constraint_state bool;
  orphans int; total_rows int;
begin
  select count(*) into cols
    from information_schema.columns
    where table_schema='public' and table_name='custom_domains'
      and column_name in ('provider_validation','provider_validation_http','ssl_status','ssl_validation_records');
  if cols <> 4 then
    raise exception 'FAIL: expected 4 new custom_domains columns, found %', cols;
  end if;

  select count(*) into policies_remaining
    from pg_policies
    where schemaname='public'
      and policyname in (
        'Users can insert own GitHub connections',
        'Users can update own GitHub connections',
        'Custom domains: owner can insert',
        'DotCV domains: owner can insert');
  if policies_remaining <> 0 then
    raise exception 'FAIL: % permissive policies still present', policies_remaining;
  end if;

  select convalidated into constraint_state
    from pg_constraint where conname='funnel_events_user_id_fkey';
  if constraint_state is null then
    raise exception 'FAIL: funnel_events_user_id_fkey missing';
  end if;
  if constraint_state then
    raise exception 'FAIL: constraint is already validated — the NOT VALID pre-condition failed (pre-existing orphans would have aborted the migration)';
  end if;

  select count(*) into orphans from public.funnel_events fe
    where not exists (select 1 from auth.users u where u.id = fe.user_id);
  select count(*) into total_rows from public.funnel_events;
  if orphans <> 190 or total_rows <> 191 then
    raise exception 'FAIL: pre-existing rows were modified (orphans=%, total=%) — data preservation violated', orphans, total_rows;
  end if;

  raise notice 'PASS: schema columns, policy drops, NOT VALID constraint, and data preservation all verified';
end $$;

-- New inserts with a REAL user are accepted…
insert into public.funnel_events (user_id, event_name) values
  ('11111111-1111-4111-8111-111111111111', 'ats_generated');

-- …and inserts referencing an ABSENT user are rejected by the NOT VALID fk.
do $$
begin
  begin
    insert into public.funnel_events (user_id, event_name) values
      ('99999999-9999-4999-8999-999999999999', 'ats_generated');
    raise exception 'FAIL: orphan insert was accepted';
  exception when foreign_key_violation then
    raise notice 'PASS: invalid reference rejected for new inserts';
  end;
end $$;

-- Future account deletions cascade to that account's events.
do $$
declare remaining int;
begin
  delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
  select count(*) into remaining
    from public.funnel_events
    where user_id = '11111111-1111-4111-8111-111111111111';
  if remaining <> 0 then
    raise exception 'FAIL: deletion did not cascade to funnel_events';
  end if;
  raise notice 'PASS: account deletion cascades to funnel_events';
end $$;

-- Reconciliation + VALIDATE path (rolled back so the fixture state survives).
begin;
  delete from public.funnel_events fe
    where not exists (select 1 from auth.users u where u.id = fe.user_id);
  alter table public.funnel_events validate constraint funnel_events_user_id_fkey;
  do $$
  declare validated bool;
  begin
    select convalidated into validated
      from pg_constraint where conname = 'funnel_events_user_id_fkey';
    if validated is not true then
      raise exception 'FAIL: validate constraint did not mark convalidated';
    end if;
    raise notice 'PASS: orphan reconciliation + VALIDATE CONSTRAINT succeeds';
  end $$;
rollback;
