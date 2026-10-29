# Migration runbook — `20261026000000_worker_write_boundary_and_domain_provider_columns.sql`

Owner-executed, on the trusted machine with Supabase CLI access. Uses the
**tracked migration process** (`supabase db push`), never an untracked
SQL-editor shortcut. All pre/post checks are read-only except the two
explicitly-marked transactional probes (both fully rolled back).

Review context: the migration adds 4 `custom_domains` provider columns, drops
4 permissive RLS policies, and adds `funnel_events_user_id_fkey` **NOT VALID**.
Production data observed on 2026-10-27: 191 `funnel_events` rows, **190
orphans across 41 absent `auth.users` ids** — the `NOT VALID` design touches
none of them (verified on an isolated PostgreSQL 18 replica; see
`supabase/tests/20261026000000_*.sql`).

## 0. Preconditions (5 min)

- CLI authenticated with access to project `yxrbytzhiilnzlamqpqz`:
  `supabase projects list` shows the project; `supabase link --project-ref yxrbytzhiilnzlamqpqz` succeeds (DB password is the owner's, never committed).
- Working tree is the release branch at the reviewed SHA, `git status` clean.

## 1. Read-only pre-checks (no changes)

```bash
supabase migration list
```

Expected: all migrations ≤ `20261009145657` shown as applied on both Local and
Remote; **`20261026000000` listed only as "Local only" / unapplied remotely**.

```bash
supabase db dump --db-url "$REMOTE_DB_URL" -f /tmp/pre-backup.sql --data-only --use-copy
```

Expected: dump completes; size roughly matches row counts. Keep this file —
it is the data-level rollback artifact alongside PITR. (Alternative accepted
control: confirm PITR/backups are enabled for the project in the dashboard.)

Read-only orphan count (run via SQL editor in read-only mode or psql with a
read-only role — the queries only SELECT):

```sql
select count(*) as total,
       count(*) filter (
         where not exists (select 1 from auth.users u where u.id = fe.user_id)
       ) as orphan_rows,
       count(distinct user_id) filter (
         where not exists (select 1 from auth.users u where u.id = fe.user_id)
       ) as orphan_user_ids
from public.funnel_events fe;
```

Expected: `total=191, orphan_rows=190, orphan_user_ids=41` (small drift is
fine — the migration is count-agnostic). Record the numbers; step 4 must show
the SAME values.

Policy/column pre-state:

```sql
select policyname from pg_policies
 where schemaname='public' and policyname in (
  'Users can insert own GitHub connections','Users can update own GitHub connections',
  'Custom domains: owner can insert','DotCV domains: owner can insert');
```

Expected: exactly 4 rows. And:

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='custom_domains'
   and column_name in ('provider_validation','provider_validation_http','ssl_status','ssl_validation_records');
```

Expected: 0 rows (columns absent today).

## 2. Apply (tracked process)

```bash
supabase db push
```

Expected output: `Applying migration 20261026000000_worker_write_boundary_and_domain_provider_columns.sql...` then
`Finished supabase db push.` with ONE warning line:

```
WARNING:  funnel_events: 190 orphan rows across 41 user ids predate the cascade; reconcile (owner-approved) then VALIDATE CONSTRAINT
```

(Exact orphan counts may drift from the 2026-10-27 observation; the WARNING
is informational and the push must still finish successfully. Any FAILURE
here aborts the whole transaction — re-run the read-only checks and stop.)

## 3. Post-migration verification (read-only)

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema='public' and table_name='custom_domains'
   and column_name in ('provider_validation','provider_validation_http','ssl_status','ssl_validation_records')
 order by column_name;
```

Expected: 4 rows — `provider_validation jsonb YES`, `provider_validation_http
jsonb YES`, `ssl_status text YES`, `ssl_validation_records jsonb YES`.

```sql
select conname, convalidated from pg_constraint where conname='funnel_events_user_id_fkey';
```

Expected: `funnel_events_user_id_fkey | f` (NOT VALID — the pre-existing
orphans are untouched and still protected against new writes only).

```sql
select count(*) from pg_policies
 where schemaname='public' and policyname in (
  'Users can insert own GitHub connections','Users can update own GitHub connections',
  'Custom domains: owner can insert','DotCV domains: owner can insert');
```

Expected: `0`.

Repeat the step-1 orphan query. Expected: **identical numbers** (190/41) —
data preservation proof.

Behavioral probes (each is a fully rolled-back transaction; no row persists):

```sql
begin;
  -- invalid reference must FAIL (expected: foreign_key_violation, then rollback):
  insert into public.funnel_events (user_id, event_name)
  values ('99999999-9999-4999-8999-999999999999', 'ats_generated');
rollback;
```

Expected: `ERROR: insert or update on table "funnel_events" violates foreign
key constraint "funnel_events_user_id_fkey"` and the transaction aborts.

```sql
begin;
  -- legitimate insert with a REAL user id must SUCCEED, then be rolled back:
  insert into public.funnel_events (user_id, event_name)
  select user_id, 'ats_generated' from public.profiles limit 1;
rollback;
```

Expected: `INSERT 0 1` then `ROLLBACK`.

## 4. Regenerate TypeScript types

```bash
supabase gen types typescript --project-ref yxrbytzhiilnzlamqpqz > src/lib/supabase/database.types.ts
pnpm typecheck && pnpm test -- --maxWorkers=2
```

Expected: typecheck + unit suite green. Diff check: the `custom_domains`
`Row` block must contain `provider_validation: Json | null`,
`provider_validation_http: Json | null`, `ssl_status: string | null`,
`ssl_validation_records: Json | null` — exactly what the committed
hand-typed file already contains (verified equal to the migrated schema by
catalog introspection on 2026-10-27). Commit the regenerated file if it
differs beyond those columns.

## 5. Rollback plan

Schema rollback (only if a defect forces it — the migration is additive and
forward-compatible with the previous Worker, which silently failed domain
writes; prefer forwarding):

```sql
begin;
  alter table public.funnel_events drop constraint if exists funnel_events_user_id_fkey;
  drop policy if exists "Custom domains: owner can insert" on public.custom_domains;
  drop policy if exists "DotCV domains: owner can insert" on public.dotcv_domains;
  create policy "Custom domains: owner can insert" on public.custom_domains for insert
    with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));
  create policy "DotCV domains: owner can insert" on public.dotcv_domains for insert
    with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));
  create policy "Users can insert own GitHub connections" on public.github_connections for insert
    with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));
  create policy "Users can update own GitHub connections" on public.github_connections for update
    using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));
  alter table public.custom_domains
    drop column if exists provider_validation,
    drop column if exists provider_validation_http,
    drop column if exists ssl_status,
    drop column if exists ssl_validation_records;
commit;
```

Plus restore the step-1 data dump if any data changed (it should not — the
migration writes no rows). Worker rollback: redeploy the previous Worker
version (`wrangler deployments list` on the trusted machine identifies it).

## 6. Reconciliation + VALIDATE (separate, owner-approved)

After deciding each orphan group's disposition (the 41 ids are accounts
deleted before any cascade existed — plausibly historical disposable QA
accounts; confirm via `auth.users` admin before touching anything):

```sql
begin;
  delete from public.funnel_events fe
    where not exists (select 1 from auth.users u where u.id = fe.user_id);
  alter table public.funnel_events validate constraint funnel_events_user_id_fkey;
  -- verify: convalidated must now be true
  select convalidated from pg_constraint where conname='funnel_events_user_id_fkey';
commit;
```

Expected: delete count = the step-1 orphan number (190), then `t`. Until this
runs, the constraint still protects all new writes.
