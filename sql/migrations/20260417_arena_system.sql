-- ============================================================
-- Paket 7: Arena System (2026-04-17)
-- ============================================================
-- Problem: weekly arena scores were stored only in profiles.xp_state.weeklyArena
-- (a JSONB blob), making cross-user leaderboard queries impossible.
--
-- Solution:
-- 1. arena_weekly_scores — queryable per-user per-week score table.
--    Kept in sync with JSONB via UPSERT from applyProgressionReward.
-- 2. arena_season_rewards — immutable audit log of finalized weekly rewards.
-- 3. RLS policies let users read their own row + all rows for their cohort+week
--    (enables rendering the leaderboard without leaking cross-cohort data).
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. arena_weekly_scores — live per-user weekly arena state
-- ============================================================

create table if not exists public.arena_weekly_scores (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null,
  cohort_league_key text not null,
  score integer not null default 0 check (score >= 0),
  activity_count integer not null default 0 check (activity_count >= 0),
  comment_rewards integer not null default 0 check (comment_rewards >= 0),
  quiz_rewards integer not null default 0 check (quiz_rewards >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, week_key)
);

comment on table public.arena_weekly_scores is
  'Live per-user weekly arena scores. Written by applyProgressionReward. '
  'Queried by the arena-leaderboard API to render per-cohort rankings.';

comment on column public.arena_weekly_scores.cohort_league_key is
  'Frozen league at the moment the user first earned arena score this week. '
  'Does not change mid-week even if the user levels up.';

create index if not exists arena_weekly_scores_week_cohort_score_idx
  on public.arena_weekly_scores (week_key, cohort_league_key, score desc);

create index if not exists arena_weekly_scores_user_idx
  on public.arena_weekly_scores (user_id, week_key desc);

-- ============================================================
-- 2. arena_season_rewards — audit log of finalized weekly rewards
-- ============================================================

create table if not exists public.arena_season_rewards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null,
  cohort_league_key text not null,
  rank integer not null check (rank >= 1),
  final_score integer not null check (final_score >= 0),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  tickets_awarded integer not null default 0 check (tickets_awarded >= 0),
  mark_awarded text,
  finalized_at timestamptz not null default timezone('utc', now()),
  unique (user_id, week_key)
);

comment on table public.arena_season_rewards is
  'Immutable audit log of rewards distributed at the end of each weekly arena season. '
  'One row per user per week. Used for history, analytics, and reconciliation.';

create index if not exists arena_season_rewards_week_cohort_rank_idx
  on public.arena_season_rewards (week_key, cohort_league_key, rank);

create index if not exists arena_season_rewards_user_idx
  on public.arena_season_rewards (user_id, finalized_at desc);

-- ============================================================
-- 3. Row Level Security
-- ============================================================

alter table public.arena_weekly_scores enable row level security;
alter table public.arena_season_rewards enable row level security;

-- arena_weekly_scores: authenticated users can read
--   (a) their own row, OR
--   (b) all rows with the same (week_key, cohort_league_key) as theirs this week
-- This lets the client fetch the leaderboard for its own cohort without
-- exposing cross-cohort data or letting clients peek at arbitrary cohorts.
drop policy if exists "Arena Scores Select Own Cohort" on public.arena_weekly_scores;
create policy "Arena Scores Select Own Cohort"
on public.arena_weekly_scores for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.arena_weekly_scores mine
    where mine.user_id = auth.uid()
      and mine.week_key = arena_weekly_scores.week_key
      and mine.cohort_league_key = arena_weekly_scores.cohort_league_key
  )
);

drop policy if exists "Arena Scores Insert Service" on public.arena_weekly_scores;
create policy "Arena Scores Insert Service"
on public.arena_weekly_scores for insert
to service_role
with check (true);

drop policy if exists "Arena Scores Update Service" on public.arena_weekly_scores;
create policy "Arena Scores Update Service"
on public.arena_weekly_scores for update
to service_role
using (true)
with check (true);

-- arena_season_rewards: users can read their own history, service_role manages
drop policy if exists "Arena Rewards Select Own" on public.arena_season_rewards;
create policy "Arena Rewards Select Own"
on public.arena_season_rewards for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Arena Rewards Cohort Read" on public.arena_season_rewards;
create policy "Arena Rewards Cohort Read"
on public.arena_season_rewards for select
to authenticated
using (
  exists (
    select 1 from public.arena_season_rewards mine
    where mine.user_id = auth.uid()
      and mine.week_key = arena_season_rewards.week_key
      and mine.cohort_league_key = arena_season_rewards.cohort_league_key
  )
);

drop policy if exists "Arena Rewards Insert Service" on public.arena_season_rewards;
create policy "Arena Rewards Insert Service"
on public.arena_season_rewards for insert
to service_role
with check (true);

-- ============================================================
-- 4. Grant permissions
-- ============================================================

grant select on public.arena_weekly_scores to authenticated;
grant insert, update on public.arena_weekly_scores to service_role;
revoke delete on public.arena_weekly_scores from public, authenticated, service_role;

grant select on public.arena_season_rewards to authenticated;
grant insert on public.arena_season_rewards to service_role;
revoke update, delete on public.arena_season_rewards from public, authenticated, service_role;
