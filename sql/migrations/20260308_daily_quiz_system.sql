-- Daily movie quiz system.
-- Prepares multilingual questions ahead of the daily publish window
-- and records per-user answer progress for XP/streak rewards.

create extension if not exists "uuid-ossp";

create table if not exists public.daily_quiz_batches (
  date date primary key,
  status text not null default 'prepared' check (status in ('preparing', 'prepared', 'published', 'failed')),
  source text not null default 'openai',
  source_model text,
  movies jsonb not null default '[]'::jsonb,
  question_count integer not null default 0 check (question_count >= 0),
  language_codes text[] not null default array['en', 'tr', 'es', 'fr']::text[],
  prepared_at timestamp with time zone,
  published_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.daily_movie_questions (
  id uuid default uuid_generate_v4() primary key,
  batch_date date not null references public.daily_quiz_batches(date) on delete cascade,
  movie_id integer not null,
  movie_title text not null,
  movie_order smallint not null check (movie_order >= 0 and movie_order <= 4),
  question_order smallint not null check (question_order >= 0 and question_order <= 4),
  question_key text not null,
  question_translations jsonb not null,
  options_translations jsonb not null,
  correct_option text not null check (correct_option in ('a', 'b', 'c', 'd')),
  explanation_translations jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (batch_date, movie_id, question_order),
  unique (batch_date, question_key)
);

create index if not exists daily_movie_questions_batch_idx
  on public.daily_movie_questions (batch_date, movie_order, question_order);

create index if not exists daily_movie_questions_movie_idx
  on public.daily_movie_questions (batch_date, movie_id);

create table if not exists public.daily_quiz_attempts (
  id uuid default uuid_generate_v4() primary key,
  batch_date date not null references public.daily_quiz_batches(date) on delete cascade,
  question_id uuid not null references public.daily_movie_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id integer not null,
  selected_option text not null check (selected_option in ('a', 'b', 'c', 'd')),
  is_correct boolean not null,
  answered_at timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (question_id, user_id)
);

create index if not exists daily_quiz_attempts_user_date_idx
  on public.daily_quiz_attempts (user_id, batch_date desc, answered_at desc);

create index if not exists daily_quiz_attempts_batch_user_idx
  on public.daily_quiz_attempts (batch_date, user_id);

create table if not exists public.daily_quiz_user_progress (
  batch_date date not null references public.daily_quiz_batches(date) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answered_count integer not null default 0 check (answered_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  completed_movie_ids integer[] not null default '{}'::integer[],
  streak_protected boolean not null default false,
  streak_protected_at timestamp with time zone,
  xp_awarded integer not null default 0,
  last_answered_at timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (batch_date, user_id)
);

create index if not exists daily_quiz_progress_user_idx
  on public.daily_quiz_user_progress (user_id, last_answered_at desc);

alter table public.daily_quiz_batches enable row level security;
alter table public.daily_movie_questions enable row level security;
alter table public.daily_quiz_attempts enable row level security;
alter table public.daily_quiz_user_progress enable row level security;

drop policy if exists "Daily Quiz Attempts Select Own" on public.daily_quiz_attempts;
create policy "Daily Quiz Attempts Select Own"
on public.daily_quiz_attempts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Daily Quiz Progress Select Own" on public.daily_quiz_user_progress;
create policy "Daily Quiz Progress Select Own"
on public.daily_quiz_user_progress for select
to authenticated
using (auth.uid() = user_id);
