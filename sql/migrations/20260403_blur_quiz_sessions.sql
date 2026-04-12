create table if not exists public.blur_quiz_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.question_pool_movies(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  used_jokers text[] not null default '{}'::text[],
  jokers_used_count smallint not null default 0 check (jokers_used_count >= 0 and jokers_used_count <= 4),
  blur_step smallint check (blur_step >= 0 and blur_step <= 5),
  submitted_guess text,
  correct boolean,
  xp_earned integer not null default 0 check (xp_earned >= 0),
  tickets_earned integer not null default 0 check (tickets_earned >= 0),
  arena_score_earned integer not null default 0 check (arena_score_earned >= 0),
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists blur_quiz_sessions_user_created_idx
  on public.blur_quiz_sessions (user_id, created_at desc);

create index if not exists blur_quiz_sessions_user_status_idx
  on public.blur_quiz_sessions (user_id, status, created_at desc);

create index if not exists blur_quiz_sessions_movie_idx
  on public.blur_quiz_sessions (movie_id, created_at desc);

alter table public.blur_quiz_sessions enable row level security;

drop policy if exists "Blur Quiz Sessions Select Own" on public.blur_quiz_sessions;
create policy "Blur Quiz Sessions Select Own"
on public.blur_quiz_sessions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Blur Quiz Sessions Insert Own" on public.blur_quiz_sessions;
create policy "Blur Quiz Sessions Insert Own"
on public.blur_quiz_sessions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Blur Quiz Sessions Update Own" on public.blur_quiz_sessions;
create policy "Blur Quiz Sessions Update Own"
on public.blur_quiz_sessions for update
to authenticated
using (auth.uid() = user_id);
