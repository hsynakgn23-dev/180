-- Add movie_pool_answers table for pool-answer idempotency.
-- Prevents the same question from being recorded twice if a user retries
-- a request (network retry, double-tap, etc.).

create table if not exists public.movie_pool_answers (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    question_id uuid not null references public.question_pool_questions(id) on delete cascade,
    is_correct  boolean not null default false,
    answered_at timestamptz not null default now(),

    -- Ensures a user can only answer each question once
    constraint movie_pool_answers_user_question_unique unique (user_id, question_id)
);

create index if not exists movie_pool_answers_user_idx on public.movie_pool_answers(user_id);
create index if not exists movie_pool_answers_question_idx on public.movie_pool_answers(question_id);

alter table public.movie_pool_answers enable row level security;

-- Users can only read their own answers
create policy "Pool Answers Select Own"
on public.movie_pool_answers for select
to authenticated
using (auth.uid() = user_id);

-- Server-side inserts via service role (bypasses RLS) — no insert policy needed for authenticated role.
