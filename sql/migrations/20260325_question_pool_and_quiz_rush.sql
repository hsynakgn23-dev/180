-- Question Pool, Quiz Rush, Subscriptions & Ad Impressions.
-- Builds a persistent question pool fed by daily quiz sync + batch generation,
-- a tinder-style film discovery flow, timed quiz rush modes,
-- subscription gating, and ad impression tracking.

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. question_pool_movies — Films in the question pool
-- ============================================================

create table if not exists public.question_pool_movies (
  id uuid default uuid_generate_v4() primary key,
  tmdb_id integer not null unique,
  title text not null,
  poster_path text,
  release_year smallint,
  genre text,
  era text,
  overview text,
  vote_average numeric(4,2),
  original_language text,
  cast_names text[],
  director text,
  added_from text not null default 'daily_sync' check (added_from in ('daily_sync', 'batch_generate', 'manual')),
  question_count smallint not null default 0 check (question_count >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists question_pool_movies_tmdb_idx
  on public.question_pool_movies (tmdb_id);

create index if not exists question_pool_movies_genre_idx
  on public.question_pool_movies (genre);

create index if not exists question_pool_movies_era_idx
  on public.question_pool_movies (era);

-- ============================================================
-- 2. question_pool_questions — The question pool
-- ============================================================

create table if not exists public.question_pool_questions (
  id uuid default uuid_generate_v4() primary key,
  movie_id uuid not null references public.question_pool_movies(id) on delete cascade,
  tmdb_movie_id integer not null,
  question_order smallint not null check (question_order >= 0 and question_order <= 4),
  question_key text not null,
  question_translations jsonb not null,
  options_translations jsonb not null,
  correct_option text not null check (correct_option in ('a', 'b', 'c', 'd')),
  explanation_translations jsonb not null default '{}'::jsonb,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  source text not null default 'daily_sync' check (source in ('daily_sync', 'batch_generate', 'manual')),
  source_daily_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (movie_id, question_order)
);

create index if not exists question_pool_questions_movie_idx
  on public.question_pool_questions (movie_id, question_order);

create index if not exists question_pool_questions_tmdb_idx
  on public.question_pool_questions (tmdb_movie_id);

create index if not exists question_pool_questions_difficulty_idx
  on public.question_pool_questions (difficulty);

create index if not exists question_pool_questions_source_idx
  on public.question_pool_questions (source);

-- ============================================================
-- 3. movie_pool_swipes — Tinder-style swipe history
-- ============================================================

create table if not exists public.movie_pool_swipes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.question_pool_movies(id) on delete cascade,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, movie_id)
);

create index if not exists movie_pool_swipes_user_idx
  on public.movie_pool_swipes (user_id, created_at desc);

create index if not exists movie_pool_swipes_user_direction_idx
  on public.movie_pool_swipes (user_id, direction);

-- ============================================================
-- 4. movie_pool_user_progress — Per-film quiz progress
-- ============================================================

create table if not exists public.movie_pool_user_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.question_pool_movies(id) on delete cascade,
  questions_answered smallint not null default 0 check (questions_answered >= 0),
  correct_count smallint not null default 0 check (correct_count >= 0),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  completed boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, movie_id)
);

create index if not exists movie_pool_progress_user_idx
  on public.movie_pool_user_progress (user_id, updated_at desc);

create index if not exists movie_pool_progress_completed_idx
  on public.movie_pool_user_progress (user_id, completed);

-- ============================================================
-- 5. quiz_rush_sessions — Timed quiz rush sessions
-- ============================================================

create table if not exists public.quiz_rush_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('rush_15', 'rush_30', 'endless')),
  total_questions smallint not null default 0 check (total_questions >= 0),
  correct_count smallint not null default 0 check (correct_count >= 0),
  wrong_count smallint not null default 0 check (wrong_count >= 0),
  time_limit_seconds smallint,
  xp_earned integer not null default 0 check (xp_earned >= 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'expired')),
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone,
  completed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists quiz_rush_sessions_user_idx
  on public.quiz_rush_sessions (user_id, created_at desc);

create index if not exists quiz_rush_sessions_user_status_idx
  on public.quiz_rush_sessions (user_id, status);

create index if not exists quiz_rush_sessions_user_mode_date_idx
  on public.quiz_rush_sessions (user_id, mode, created_at desc);

-- ============================================================
-- 6. quiz_rush_attempts — Individual answers within a rush
-- ============================================================

create table if not exists public.quiz_rush_attempts (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid not null references public.quiz_rush_sessions(id) on delete cascade,
  question_id uuid not null references public.question_pool_questions(id) on delete cascade,
  selected_option text not null check (selected_option in ('a', 'b', 'c', 'd')),
  is_correct boolean not null,
  answered_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (session_id, question_id)
);

create index if not exists quiz_rush_attempts_session_idx
  on public.quiz_rush_attempts (session_id, answered_at);

-- ============================================================
-- 7. subscriptions — User subscription state
-- ============================================================

create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  provider text check (provider in ('stripe', 'apple', 'google')),
  provider_subscription_id text,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'past_due')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists subscriptions_user_active_idx
  on public.subscriptions (user_id) where (status = 'active');

create index if not exists subscriptions_expires_idx
  on public.subscriptions (expires_at) where (status = 'active');

-- ============================================================
-- 8. ad_impressions — Ad display tracking
-- ============================================================

create table if not exists public.ad_impressions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('ritual', 'timer', 'quiz', 'rush')),
  shown_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists ad_impressions_user_idx
  on public.ad_impressions (user_id, shown_at desc);

-- ============================================================
-- 9. profiles — Add subscription_tier and last_ad_shown_at
-- ============================================================

alter table public.profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'premium'));

alter table public.profiles
  add column if not exists last_ad_shown_at timestamp with time zone;

-- ============================================================
-- 10. Row Level Security
-- ============================================================

alter table public.question_pool_movies enable row level security;
alter table public.question_pool_questions enable row level security;
alter table public.movie_pool_swipes enable row level security;
alter table public.movie_pool_user_progress enable row level security;
alter table public.quiz_rush_sessions enable row level security;
alter table public.quiz_rush_attempts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ad_impressions enable row level security;

-- question_pool_movies: public read (everyone can browse films)
drop policy if exists "Pool Movies Public Read" on public.question_pool_movies;
create policy "Pool Movies Public Read"
on public.question_pool_movies for select
using (true);

-- question_pool_questions: public read (questions visible to all)
drop policy if exists "Pool Questions Public Read" on public.question_pool_questions;
create policy "Pool Questions Public Read"
on public.question_pool_questions for select
using (true);

-- movie_pool_swipes: users read/write own
drop policy if exists "Pool Swipes Select Own" on public.movie_pool_swipes;
create policy "Pool Swipes Select Own"
on public.movie_pool_swipes for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Pool Swipes Insert Own" on public.movie_pool_swipes;
create policy "Pool Swipes Insert Own"
on public.movie_pool_swipes for insert
to authenticated
with check (auth.uid() = user_id);

-- movie_pool_user_progress: users read/write own
drop policy if exists "Pool Progress Select Own" on public.movie_pool_user_progress;
create policy "Pool Progress Select Own"
on public.movie_pool_user_progress for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Pool Progress Insert Own" on public.movie_pool_user_progress;
create policy "Pool Progress Insert Own"
on public.movie_pool_user_progress for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Pool Progress Update Own" on public.movie_pool_user_progress;
create policy "Pool Progress Update Own"
on public.movie_pool_user_progress for update
to authenticated
using (auth.uid() = user_id);

-- quiz_rush_sessions: users read/write own
drop policy if exists "Rush Sessions Select Own" on public.quiz_rush_sessions;
create policy "Rush Sessions Select Own"
on public.quiz_rush_sessions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Rush Sessions Insert Own" on public.quiz_rush_sessions;
create policy "Rush Sessions Insert Own"
on public.quiz_rush_sessions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Rush Sessions Update Own" on public.quiz_rush_sessions;
create policy "Rush Sessions Update Own"
on public.quiz_rush_sessions for update
to authenticated
using (auth.uid() = user_id);

-- quiz_rush_attempts: users read/write own (via session ownership)
drop policy if exists "Rush Attempts Select Own" on public.quiz_rush_attempts;
create policy "Rush Attempts Select Own"
on public.quiz_rush_attempts for select
to authenticated
using (
  exists (
    select 1 from public.quiz_rush_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  )
);

drop policy if exists "Rush Attempts Insert Own" on public.quiz_rush_attempts;
create policy "Rush Attempts Insert Own"
on public.quiz_rush_attempts for insert
to authenticated
with check (
  exists (
    select 1 from public.quiz_rush_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  )
);

-- subscriptions: users read own
drop policy if exists "Subscriptions Select Own" on public.subscriptions;
create policy "Subscriptions Select Own"
on public.subscriptions for select
to authenticated
using (auth.uid() = user_id);

-- ad_impressions: users read/write own
drop policy if exists "Ad Impressions Select Own" on public.ad_impressions;
create policy "Ad Impressions Select Own"
on public.ad_impressions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Ad Impressions Insert Own" on public.ad_impressions;
create policy "Ad Impressions Insert Own"
on public.ad_impressions for insert
to authenticated
with check (auth.uid() = user_id);

-- ============================================================
-- 11. Helper: count daily rush sessions for free-tier limit
-- ============================================================

create or replace function public.get_daily_rush_count(p_user_id uuid, p_date date default current_date)
returns integer
language sql
stable
security definer
as $$
  select count(*)::integer
  from public.quiz_rush_sessions
  where user_id = p_user_id
    and created_at >= (p_date::timestamp at time zone 'Europe/Istanbul')
    and created_at < ((p_date + interval '1 day')::timestamp at time zone 'Europe/Istanbul');
$$;

-- ============================================================
-- 12. Migrate existing daily_movie_questions into the pool
-- ============================================================

-- 12a. Insert distinct movies from daily quiz history into pool_movies
insert into public.question_pool_movies (tmdb_id, title, added_from, question_count)
select distinct on (dmq.movie_id)
  dmq.movie_id,
  dmq.movie_title,
  'daily_sync',
  0
from public.daily_movie_questions dmq
where not exists (
  select 1 from public.question_pool_movies pm where pm.tmdb_id = dmq.movie_id
)
order by dmq.movie_id, dmq.created_at
on conflict (tmdb_id) do nothing;

-- 12b. Update question_count for migrated movies
update public.question_pool_movies pm
set question_count = sub.cnt
from (
  select movie_id as tmdb_id, count(*) as cnt
  from public.daily_movie_questions
  group by movie_id
) sub
where pm.tmdb_id = sub.tmdb_id
  and pm.added_from = 'daily_sync';

-- 12c. Copy questions into the pool
insert into public.question_pool_questions (
  tmdb_movie_id,
  movie_id,
  question_order,
  question_key,
  question_translations,
  options_translations,
  correct_option,
  explanation_translations,
  difficulty,
  source,
  source_daily_date,
  metadata
)
select
  dmq.movie_id,
  pm.id,
  dmq.question_order,
  dmq.batch_date || ':' || dmq.question_key,
  dmq.question_translations,
  dmq.options_translations,
  dmq.correct_option,
  dmq.explanation_translations,
  'medium',
  'daily_sync',
  dmq.batch_date,
  dmq.metadata
from public.daily_movie_questions dmq
join public.question_pool_movies pm on pm.tmdb_id = dmq.movie_id
on conflict (movie_id, question_order) do nothing;
