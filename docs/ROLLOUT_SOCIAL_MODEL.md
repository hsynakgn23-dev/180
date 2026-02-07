# Social Model Rollout

Date: 2026-02-07

## Scope
- Move social state from `public.rituals` embedded columns to relational tables:
- `public.ritual_echoes`
- `public.ritual_replies`
- Keep a migration-safe snapshot of legacy social payload before dropping old columns.
- Enforce `public.rituals.user_id` foreign key to `auth.users(id)` (on delete set null).
- Add feed/query indexes for `rituals`, `ritual_echoes`, and `ritual_replies`.
- Ensure auth-era baseline policies (`daily_showcase`, `rituals`, `profiles`, storage read) are present.

## Artifacts
- Migration SQL: `sql/migrations/20260207_social_model_v2.sql`
- Base setup SQL (fresh environments): `supabase_setup.sql`

## Rollout Order
1. Preflight checks on target DB:
```sql
select count(*) as rituals_total from public.rituals;
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'rituals' and column_name = 'echoes'
  ) as has_echoes_column,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'rituals' and column_name = 'replies'
  ) as has_replies_column;

-- Run these only if legacy columns still exist:
-- select count(*) as rituals_with_echoes from public.rituals where coalesce(echoes, 0) > 0;
-- select count(*) as rituals_with_replies
-- from public.rituals
-- where jsonb_typeof(replies) = 'array' and jsonb_array_length(replies) > 0;
```
2. Apply migration script:
- Run `sql/migrations/20260207_social_model_v2.sql` in Supabase SQL Editor.
3. Verify post-migration integrity:
```sql
select count(*) as echoes_rows from public.ritual_echoes;
select count(*) as replies_rows from public.ritual_replies;
select count(*) as snapshot_rows from public.rituals_legacy_social_snapshot;

-- Optional policy sanity checks:
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where (schemaname = 'public' and tablename in ('daily_showcase', 'rituals', 'ritual_echoes', 'ritual_replies', 'profiles'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
```
4. Confirm old columns are removed:
```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'rituals'
  and column_name in ('echoes', 'is_echoed_by_me', 'replies');
```
5. Deploy frontend/backend with current branch changes.

## Notes
- Legacy `echoes` is aggregate-only data. Per-user actor history cannot be reconstructed reliably.
- Migration snapshots old payload into `public.rituals_legacy_social_snapshot`.
- Reply backfill uses ritual owner `user_id` when embedded reply payload does not include actor identity.

## Rollback
1. Keep application on old release.
2. Restore from `public.rituals_legacy_social_snapshot` if needed.
3. Re-add old columns only if rollback to legacy app code is required:
```sql
alter table public.rituals add column if not exists echoes integer default 0;
alter table public.rituals add column if not exists is_echoed_by_me boolean default false;
alter table public.rituals add column if not exists replies jsonb default '[]'::jsonb;
```
