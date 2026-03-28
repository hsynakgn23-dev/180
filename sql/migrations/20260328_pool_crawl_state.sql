-- Pool TMDB crawl state: tracks incremental movie fetching progress
-- One singleton row (id = 1) used as a cursor

create table if not exists public.pool_crawl_state (
  id          int primary key default 1,
  next_page   int  not null default 1,
  movies_fetched int not null default 0,
  movies_target  int not null default 400,
  last_run_at    timestamptz,
  status         text not null default 'idle'
    check (status in ('idle', 'running', 'done'))
);

-- Seed the singleton row
insert into public.pool_crawl_state (id) values (1) on conflict do nothing;

-- Service role only — no user-facing RLS needed
alter table public.pool_crawl_state enable row level security;
