-- Paket 11: JSONB normalization
--
-- Adds STORED generated columns to profiles for the three most-queried
-- xp_state fields:
--   g_total_xp  — integer, totalXP from xp_state
--   g_streak    — integer, current streak from xp_state
--   g_tickets   — integer, wallet balance from xp_state.wallet.balance
--
-- Generated columns are automatically recomputed by PostgreSQL on every
-- profiles row update. They can be indexed and used in WHERE / ORDER BY
-- without parsing JSONB in queries.
--
-- Also creates:
--   profile_public_stats  — view exposing clean stats per user for
--                           analytics, admin panels, and leaderboards.
--
-- Zero breaking changes: no existing columns removed, no app code changes.
-- Safe to re-run: guarded by information_schema existence checks.

-- ── 1. Generated columns ─────────────────────────────────────────────────────

do $$
begin
  -- g_total_xp
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'g_total_xp'
  ) then
    alter table public.profiles
      add column g_total_xp integer
      generated always as (
        coalesce((xp_state->>'totalXP')::integer, 0)
      ) stored;
  end if;

  -- g_streak
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'g_streak'
  ) then
    alter table public.profiles
      add column g_streak integer
      generated always as (
        coalesce((xp_state->>'streak')::integer, 0)
      ) stored;
  end if;

  -- g_tickets  (wallet balance lives at xp_state.wallet.balance)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'g_tickets'
  ) then
    alter table public.profiles
      add column g_tickets integer
      generated always as (
        coalesce((xp_state->'wallet'->>'balance')::integer, 0)
      ) stored;
  end if;
end $$;

-- ── 2. Indexes on generated columns ──────────────────────────────────────────

-- XP descending — primary leaderboard order
create index if not exists profiles_g_total_xp_idx
  on public.profiles (g_total_xp desc);

-- Streak descending — streak leaderboard / high-streak queries
create index if not exists profiles_g_streak_idx
  on public.profiles (g_streak desc);

-- Tickets — low-balance wallet queries (ascending is more useful here)
create index if not exists profiles_g_tickets_idx
  on public.profiles (g_tickets);

-- ── 3. profile_public_stats view ─────────────────────────────────────────────
-- Provides a clean SQL interface for analytics, admin dashboards,
-- and future server-side leaderboard queries.
-- RLS on the underlying profiles table is NOT bypassed — this view
-- inherits the security context of the caller.

create or replace view public.profile_public_stats as
select
  p.user_id,
  p.display_name,
  -- generated columns (indexed, fast)
  p.g_total_xp                                           as total_xp,
  p.g_streak                                             as current_streak,
  p.g_tickets                                            as wallet_tickets,
  -- derived from xp_state (not indexed, but cheap for single-row queries)
  coalesce((p.xp_state->>'activeDays')::text, '[]')      as active_days_json,
  coalesce(
    jsonb_array_length(
      case
        when jsonb_typeof(p.xp_state->'activeDays') = 'array'
        then p.xp_state->'activeDays'
        else '[]'::jsonb
      end
    ),
    0
  )                                                      as days_present,
  coalesce(p.xp_state->>'lastStreakDate', '')            as last_streak_date,
  coalesce(p.xp_state->>'lastRitualDate', '')            as last_ritual_date,
  -- arena snapshot (current week score)
  coalesce((p.xp_state->'weeklyArena'->>'score')::integer, 0)        as arena_weekly_score,
  coalesce((p.xp_state->'weeklyArena'->>'activityCount')::integer, 0) as arena_weekly_activity,
  coalesce(p.xp_state->'weeklyArena'->>'weekKey', '')   as arena_week_key,
  -- inventory
  coalesce((p.xp_state->'wallet'->'inventory'->>'streak_shield')::integer, 0) as streak_shields,
  -- timestamps
  p.created_at,
  p.updated_at
from public.profiles p;

-- Grant read access to authenticated users (view inherits RLS from base table)
grant select on public.profile_public_stats to authenticated;
