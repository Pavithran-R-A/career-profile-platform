-- CVentory launch: preserve authorization semantics while allowing Postgres
-- to evaluate auth.uid() once per statement instead of once per row.

begin;

do $$
declare
  pol record;
  next_using text;
  next_check text;
  ddl text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual is not null and qual like '%auth.uid()%')
        or
        (with_check is not null and with_check like '%auth.uid()%')
      )
  loop
    next_using := case
      when pol.qual is null then ''
      else E' USING (' || replace(pol.qual, 'auth.uid()', '(select auth.uid())') || ')'
    end;
    next_check := case
      when pol.with_check is null then ''
      else E' WITH CHECK (' || replace(pol.with_check, 'auth.uid()', '(select auth.uid())') || ')'
    end;

    ddl := format(
      'ALTER POLICY %I ON %I.%I%s%s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      next_using,
      next_check
    );
    execute ddl;
  end loop;
end
$$;

-- This false SELECT policy was a documentation guard. Direct anon access is
-- already denied by table privileges/RLS, and the policy only creates a
-- duplicate-permissive-policy performance finding.
drop policy if exists "Public evidence reads only via safe views" on public.profile_evidence;

-- Worker-only tables: make the deny-by-default intent explicit to the linter
-- while preserving service-role access (service_role bypasses RLS).
create policy "No client access to deletion requests"
on public.account_deletion_requests
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "No client access to webhook ledger"
on public.billing_webhook_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

commit;
