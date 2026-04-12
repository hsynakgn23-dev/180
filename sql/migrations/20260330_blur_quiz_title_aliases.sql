alter table public.question_pool_movies
    add column if not exists title_aliases text[] not null default '{}'::text[];

update public.question_pool_movies
set title_aliases = array[title]
where (title_aliases is null or coalesce(array_length(title_aliases, 1), 0) = 0)
  and coalesce(trim(title), '') <> '';

create index if not exists question_pool_movies_title_aliases_idx
    on public.question_pool_movies
    using gin (title_aliases);
