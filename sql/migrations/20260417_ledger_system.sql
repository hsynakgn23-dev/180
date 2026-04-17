-- ============================================================
-- Ledger System: Immutable audit logs for XP, Tickets, Arena
-- ============================================================
-- Adds three ledger tables to track every progression change.
-- This enables full auditability of why a user has X tickets/XP/arena score.
-- Tables are immutable: SELECT for users (own rows), INSERT for service_role only.
-- No UPDATE or DELETE allowed for anyone (immutable log).

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. wallet_ledger — Tracks every ticket (reel) balance change
-- ============================================================

create table if not exists public.wallet_ledger (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  source text not null,
  source_id text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.wallet_ledger is
  'Immutable audit log of every ticket (reel) balance change. '
  'Tracks earned, spent, and transferred tickets. '
  'Use to answer: why does this user have X tickets? '
  'Example sources: pool_quiz, rush_quiz, daily_quiz, referral, gift_code, rewarded_ad, topup, spend_item';

comment on column public.wallet_ledger.delta is
  'Change in balance: positive = earned, negative = spent/transferred';

comment on column public.wallet_ledger.balance_after is
  'Balance immediately after this mutation (for easy reconstruction)';

comment on column public.wallet_ledger.source is
  'Where the change came from (pool_quiz, rush_quiz, daily_quiz, referral, gift_code, rewarded_ad, topup, spend_item)';

comment on column public.wallet_ledger.source_id is
  'Optional reference ID (session_id, quiz_id, gift_code, etc.)';

comment on column public.wallet_ledger.note is
  'Optional human-readable note (e.g., movie title, reason)';

create index if not exists wallet_ledger_user_created_idx
  on public.wallet_ledger (user_id, created_at desc);

create index if not exists wallet_ledger_source_created_idx
  on public.wallet_ledger (source, created_at desc);

-- ============================================================
-- 2. xp_ledger — Tracks every XP change
-- ============================================================

create table if not exists public.xp_ledger (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  total_after integer not null,
  source text not null,
  source_id text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.xp_ledger is
  'Immutable audit log of every total XP change. '
  'Tracks XP earned from quizzes, comments, milestones, arena, etc. '
  'Use to answer: why does this user have X XP? '
  'Example sources: pool_quiz, rush_quiz, daily_comment, referral, streak_milestone, arena_season';

comment on column public.xp_ledger.delta is
  'Change in total XP: usually positive (earned)';

comment on column public.xp_ledger.total_after is
  'Total XP immediately after this mutation (for easy reconstruction)';

comment on column public.xp_ledger.source is
  'Where the change came from (pool_quiz, rush_quiz, daily_comment, referral, streak_milestone, arena_season)';

comment on column public.xp_ledger.source_id is
  'Optional reference ID (session_id, question_id, streak_count, etc.)';

comment on column public.xp_ledger.note is
  'Optional human-readable note (e.g., reason or details)';

create index if not exists xp_ledger_user_created_idx
  on public.xp_ledger (user_id, created_at desc);

create index if not exists xp_ledger_source_created_idx
  on public.xp_ledger (source, created_at desc);

-- ============================================================
-- 3. arena_ledger — Tracks every arena score change
-- ============================================================

create table if not exists public.arena_ledger (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  total_after integer not null,
  week_key text not null,
  source text not null,
  source_id text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.arena_ledger is
  'Immutable audit log of every arena score change (per week). '
  'Tracks weekly arena points from quiz rewards, comment rewards, etc. '
  'Use to answer: why does this user have X points in week W? '
  'Example sources: quiz_reward, comment_reward, activity_bonus';

comment on column public.arena_ledger.delta is
  'Change in weekly arena score: usually positive (earned)';

comment on column public.arena_ledger.total_after is
  'Arena score for the week immediately after this mutation (for easy reconstruction)';

comment on column public.arena_ledger.week_key is
  'ISO week key (e.g., 2026-W16) to track which week this change belongs to';

comment on column public.arena_ledger.source is
  'Where the change came from (quiz_reward, comment_reward, activity_bonus, season_reset, etc.)';

comment on column public.arena_ledger.source_id is
  'Optional reference ID (session_id, comment_id, etc.)';

comment on column public.arena_ledger.note is
  'Optional human-readable note (e.g., movie title, comment text snippet)';

create index if not exists arena_ledger_user_week_created_idx
  on public.arena_ledger (user_id, week_key, created_at desc);

create index if not exists arena_ledger_week_created_idx
  on public.arena_ledger (week_key, created_at desc);

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================

alter table public.wallet_ledger enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.arena_ledger enable row level security;

-- wallet_ledger: authenticated users SELECT own rows, service_role INSERT
drop policy if exists "Wallet Ledger Select Own" on public.wallet_ledger;
create policy "Wallet Ledger Select Own"
on public.wallet_ledger for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Wallet Ledger Insert Service" on public.wallet_ledger;
create policy "Wallet Ledger Insert Service"
on public.wallet_ledger for insert
to service_role
with check (true);

-- xp_ledger: authenticated users SELECT own rows, service_role INSERT
drop policy if exists "XP Ledger Select Own" on public.xp_ledger;
create policy "XP Ledger Select Own"
on public.xp_ledger for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "XP Ledger Insert Service" on public.xp_ledger;
create policy "XP Ledger Insert Service"
on public.xp_ledger for insert
to service_role
with check (true);

-- arena_ledger: authenticated users SELECT own rows, service_role INSERT
drop policy if exists "Arena Ledger Select Own" on public.arena_ledger;
create policy "Arena Ledger Select Own"
on public.arena_ledger for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Arena Ledger Insert Service" on public.arena_ledger;
create policy "Arena Ledger Insert Service"
on public.arena_ledger for insert
to service_role
with check (true);

-- ============================================================
-- 5. Grant permissions
-- ============================================================

-- wallet_ledger: authenticated can SELECT, service_role can INSERT
grant select on public.wallet_ledger to authenticated;
grant insert on public.wallet_ledger to service_role;
revoke update, delete on public.wallet_ledger from public, authenticated, service_role;

-- xp_ledger: authenticated can SELECT, service_role can INSERT
grant select on public.xp_ledger to authenticated;
grant insert on public.xp_ledger to service_role;
revoke update, delete on public.xp_ledger from public, authenticated, service_role;

-- arena_ledger: authenticated can SELECT, service_role can INSERT
grant select on public.arena_ledger to authenticated;
grant insert on public.arena_ledger to service_role;
revoke update, delete on public.arena_ledger from public, authenticated, service_role;
