-- ============================================================
-- Paket 5: Constraint & FK Hardening (2026-04-17)
-- ============================================================
-- Fix 1: gift_codes.created_by — NOT NULL + ON DELETE SET NULL contradiction
-- Fix 2: quiz_rush_sessions — add missing updated_at column + trigger
-- Fix 3: Prevent duplicate active blur_quiz sessions per user+movie
-- Fix 4: Prevent duplicate in_progress rush sessions per user+mode
-- Fix 5: movie_pool_user_progress — correct_count <= questions_answered
-- Fix 6: notification_events — add is_read flag + expand kind check
-- Fix 7: xp_ledger.delta — assert non-negative
-- Fix 8: profiles/blur_quiz_sessions — ensure updated_at trigger exists
--
-- NOTE: All pg_constraint lookups use to_regclass() (returns NULL instead of
-- throwing 42P01 when the table does not exist). All table-existence guards
-- use information_schema.tables.
-- ============================================================

-- NOTE: This migration is NOT wrapped in a single BEGIN/COMMIT.
-- Each DO block / statement is its own transaction, so dedup UPDATEs
-- commit *before* the dependent unique-index creation runs. All
-- statements are idempotent and safe to re-run.

-- Shared updated_at trigger function (idempotent, used by multiple tables)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- ============================================================
-- FIX 1: gift_codes.created_by — ON DELETE SET NULL vs NOT NULL
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gift_codes'
  ) then
    raise notice 'gift_codes table not found — skipping Fix 1';
    return;
  end if;

  -- Use to_regclass() to safely look up the OID
  if exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.gift_codes')
      and conname = 'gift_codes_created_by_fkey'
  ) then
    alter table public.gift_codes
      drop constraint gift_codes_created_by_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.gift_codes')
      and conname = 'gift_codes_created_by_fkey'
  ) then
    alter table public.gift_codes
      add constraint gift_codes_created_by_fkey
      foreign key (created_by)
      references auth.users(id)
      on delete restrict;
  end if;
end $$;

-- ============================================================
-- FIX 2: quiz_rush_sessions — add updated_at column + trigger
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'quiz_rush_sessions'
  ) then
    raise notice 'quiz_rush_sessions table not found — skipping Fix 2';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quiz_rush_sessions'
      and column_name = 'updated_at'
  ) then
    alter table public.quiz_rush_sessions
      add column updated_at timestamp with time zone
        not null default timezone('utc'::text, now());

    -- Backfill historical rows
    update public.quiz_rush_sessions
    set updated_at = coalesce(completed_at, created_at)
    where updated_at >= now() - interval '5 seconds';
  end if;
end $$;

drop trigger if exists quiz_rush_sessions_updated_at on public.quiz_rush_sessions;
create trigger quiz_rush_sessions_updated_at
before update on public.quiz_rush_sessions
for each row
execute function public.set_updated_at();

-- ============================================================
-- FIX 3: Prevent duplicate in_progress blur_quiz sessions per user+movie
-- Deduplicate first (keep most recent), then add the unique index.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'blur_quiz_sessions'
  ) then
    raise notice 'blur_quiz_sessions table not found — skipping Fix 3';
    return;
  end if;

  -- Expire all but the newest in_progress session per user+movie
  update public.blur_quiz_sessions b
  set status = 'completed', updated_at = now()
  where status = 'in_progress'
    and id <> (
      select id from public.blur_quiz_sessions b2
      where b2.user_id = b.user_id
        and b2.movie_id = b.movie_id
        and b2.status = 'in_progress'
      order by b2.created_at desc
      limit 1
    );

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'blur_quiz_sessions'
      and indexname = 'blur_quiz_sessions_user_movie_active_uidx'
  ) then
    create unique index blur_quiz_sessions_user_movie_active_uidx
      on public.blur_quiz_sessions (user_id, movie_id)
      where (status = 'in_progress');
  end if;
end $$;

-- ============================================================
-- FIX 4: Prevent duplicate in_progress rush sessions per user+mode
-- All-in-one block: dedup duplicates, then create the unique index.
-- Uses row_number() with ctid for absolute reliability (no UUID/timestamp ties).
-- ============================================================
do $$
declare
  v_dedup_count integer;
  v_remaining_dups integer;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'quiz_rush_sessions'
  ) then
    raise notice 'quiz_rush_sessions table not found — skipping Fix 4';
    return;
  end if;

  -- Dedup with row_number() partitioned by (user_id, mode), keeping the newest.
  -- ctid is the physical row identifier — guaranteed unique even when
  -- created_at and id collide.
  with ranked as (
    select
      ctid,
      row_number() over (
        partition by user_id, mode
        order by created_at desc nulls last, id desc
      ) as rn
    from public.quiz_rush_sessions
    where status = 'in_progress'
  )
  update public.quiz_rush_sessions s
  set status = 'expired'
  from ranked r
  where s.ctid = r.ctid
    and r.rn > 1;

  get diagnostics v_dedup_count = row_count;
  raise notice 'Fix 4: marked % duplicate rush sessions as expired', v_dedup_count;

  -- Sanity check before index creation
  select count(*) into v_remaining_dups
  from (
    select user_id, mode
    from public.quiz_rush_sessions
    where status = 'in_progress'
    group by user_id, mode
    having count(*) > 1
  ) sub;

  if v_remaining_dups > 0 then
    raise exception 'Fix 4 dedup failed: still % duplicate (user_id,mode) groups in_progress', v_remaining_dups;
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'quiz_rush_sessions'
      and indexname = 'quiz_rush_sessions_user_mode_active_uidx'
  ) then
    create unique index quiz_rush_sessions_user_mode_active_uidx
      on public.quiz_rush_sessions (user_id, mode)
      where (status = 'in_progress');
  end if;
end $$;

-- ============================================================
-- FIX 5: movie_pool_user_progress — correct_count <= questions_answered
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'movie_pool_user_progress'
  ) then
    raise notice 'movie_pool_user_progress table not found — skipping Fix 5';
    return;
  end if;

  -- Fix bad data first
  update public.movie_pool_user_progress
  set correct_count = questions_answered
  where correct_count > questions_answered;

  if not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.movie_pool_user_progress')
      and conname = 'pool_progress_correct_lte_answered'
  ) then
    alter table public.movie_pool_user_progress
      add constraint pool_progress_correct_lte_answered
      check (correct_count <= questions_answered);
  end if;
end $$;

-- ============================================================
-- FIX 6a: notification_events — add is_read flag
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'notification_events'
  ) then
    raise notice 'notification_events table not found — skipping Fix 6';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_events'
      and column_name = 'is_read'
  ) then
    alter table public.notification_events
      add column is_read boolean not null default false;
  end if;
end $$;

create index if not exists notification_events_recipient_unread_idx
  on public.notification_events (recipient_user_id, created_at desc)
  where (is_read = false);

-- ============================================================
-- FIX 6b: notification_events — expand kind check
-- ============================================================
alter table public.notification_events
  drop constraint if exists notification_events_kind_check;

alter table public.notification_events
  add constraint notification_events_kind_check
  check (kind in (
    'comment', 'like', 'follow',
    'daily_drop', 'streak', 'generic',
    'milestone', 'arena', 'referral'
  ));

-- ============================================================
-- FIX 7: xp_ledger.delta — must be non-negative
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'xp_ledger'
  ) then
    raise notice 'xp_ledger table not found — skipping Fix 7';
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.xp_ledger')
      and conname = 'xp_ledger_delta_positive'
  ) then
    alter table public.xp_ledger
      add constraint xp_ledger_delta_positive
      check (delta >= 0);
  end if;
end $$;

-- ============================================================
-- FIX 8: profiles + blur_quiz_sessions — updated_at triggers
-- ============================================================
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'blur_quiz_sessions'
  ) then
    drop trigger if exists blur_quiz_sessions_updated_at on public.blur_quiz_sessions;
    create trigger blur_quiz_sessions_updated_at
    before update on public.blur_quiz_sessions
    for each row
    execute function public.set_updated_at();
  end if;
end $$;
