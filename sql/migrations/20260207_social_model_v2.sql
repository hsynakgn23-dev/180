-- Social model migration (2026-02-07)
-- Goal:
-- 1) Move social interactions from embedded rituals columns to relational tables.
-- 2) Preserve legacy embedded data in an audit snapshot before column removal.
-- 3) Keep migration idempotent for re-runs.

create extension if not exists "uuid-ossp";

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rituals_user_id_fkey'
  ) then
    alter table public.rituals
      add constraint rituals_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists rituals_timestamp_idx
  on public.rituals (timestamp desc);

create index if not exists rituals_user_timestamp_idx
  on public.rituals (user_id, timestamp desc);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  xp_state jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.ritual_echoes (
  ritual_id uuid not null references public.rituals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (ritual_id, user_id)
);

create index if not exists ritual_echoes_ritual_id_idx
  on public.ritual_echoes (ritual_id);

create table if not exists public.ritual_replies (
  id uuid default uuid_generate_v4() primary key,
  ritual_id uuid not null references public.rituals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null,
  text text not null check (char_length(text) > 0 and char_length(text) <= 180),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists ritual_replies_ritual_created_idx
  on public.ritual_replies (ritual_id, created_at);

create table if not exists public.rituals_legacy_social_snapshot (
  ritual_id uuid primary key references public.rituals(id) on delete cascade,
  user_id uuid,
  legacy_echoes integer not null default 0,
  legacy_replies jsonb not null default '[]'::jsonb,
  captured_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ritual_echoes enable row level security;
alter table public.ritual_replies enable row level security;
alter table public.rituals enable row level security;
alter table public.daily_showcase enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Public Daily Read" on public.daily_showcase;
drop policy if exists "Public Rituals Read" on public.rituals;
drop policy if exists "Public Rituals Insert" on public.rituals;
drop policy if exists "Authenticated Rituals Insert" on public.rituals;
drop policy if exists "Authenticated Rituals Delete Own" on public.rituals;
drop policy if exists "Profiles Select Own" on public.profiles;
drop policy if exists "Profiles Insert Own" on public.profiles;
drop policy if exists "Profiles Update Own" on public.profiles;

drop policy if exists "Public Ritual Echoes Read" on public.ritual_echoes;
drop policy if exists "Authenticated Ritual Echoes Insert Own" on public.ritual_echoes;
drop policy if exists "Authenticated Ritual Echoes Delete Own" on public.ritual_echoes;
drop policy if exists "Public Ritual Replies Read" on public.ritual_replies;
drop policy if exists "Authenticated Ritual Replies Insert Own" on public.ritual_replies;
drop policy if exists "Authenticated Ritual Replies Delete Own" on public.ritual_replies;

create policy "Public Daily Read"
on public.daily_showcase for select
to anon, authenticated
using (true);

create policy "Public Rituals Read"
on public.rituals for select
to anon, authenticated
using (true);

create policy "Authenticated Rituals Insert"
on public.rituals for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Authenticated Rituals Delete Own"
on public.rituals for delete
to authenticated
using (auth.uid() = user_id);

create policy "Public Ritual Echoes Read"
on public.ritual_echoes for select
to anon, authenticated
using (true);

create policy "Authenticated Ritual Echoes Insert Own"
on public.ritual_echoes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Authenticated Ritual Echoes Delete Own"
on public.ritual_echoes for delete
to authenticated
using (auth.uid() = user_id);

create policy "Public Ritual Replies Read"
on public.ritual_replies for select
to anon, authenticated
using (true);

create policy "Authenticated Ritual Replies Insert Own"
on public.ritual_replies for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Authenticated Ritual Replies Delete Own"
on public.ritual_replies for delete
to authenticated
using (auth.uid() = user_id);

create policy "Profiles Select Own"
on public.profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "Profiles Insert Own"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Profiles Update Own"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
declare
  has_echoes boolean;
  has_replies boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rituals'
      and column_name = 'echoes'
  ) into has_echoes;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rituals'
      and column_name = 'replies'
  ) into has_replies;

  if has_echoes and has_replies then
    execute $snapshot$
      insert into public.rituals_legacy_social_snapshot (ritual_id, user_id, legacy_echoes, legacy_replies, captured_at)
      select
        r.id,
        r.user_id,
        coalesce(r.echoes, 0),
        coalesce(r.replies, '[]'::jsonb),
        timezone('utc'::text, now())
      from public.rituals r
      where coalesce(r.echoes, 0) > 0
         or (jsonb_typeof(r.replies) = 'array' and jsonb_array_length(r.replies) > 0)
      on conflict (ritual_id) do update
      set
        user_id = excluded.user_id,
        legacy_echoes = excluded.legacy_echoes,
        legacy_replies = excluded.legacy_replies,
        captured_at = excluded.captured_at;
    $snapshot$;
  elsif has_echoes then
    execute $snapshot$
      insert into public.rituals_legacy_social_snapshot (ritual_id, user_id, legacy_echoes, legacy_replies, captured_at)
      select
        r.id,
        r.user_id,
        coalesce(r.echoes, 0),
        '[]'::jsonb,
        timezone('utc'::text, now())
      from public.rituals r
      where coalesce(r.echoes, 0) > 0
      on conflict (ritual_id) do update
      set
        user_id = excluded.user_id,
        legacy_echoes = excluded.legacy_echoes,
        legacy_replies = excluded.legacy_replies,
        captured_at = excluded.captured_at;
    $snapshot$;
  elsif has_replies then
    execute $snapshot$
      insert into public.rituals_legacy_social_snapshot (ritual_id, user_id, legacy_echoes, legacy_replies, captured_at)
      select
        r.id,
        r.user_id,
        0,
        coalesce(r.replies, '[]'::jsonb),
        timezone('utc'::text, now())
      from public.rituals r
      where jsonb_typeof(r.replies) = 'array'
        and jsonb_array_length(r.replies) > 0
      on conflict (ritual_id) do update
      set
        user_id = excluded.user_id,
        legacy_echoes = excluded.legacy_echoes,
        legacy_replies = excluded.legacy_replies,
        captured_at = excluded.captured_at;
    $snapshot$;
  end if;

  if has_replies then
    execute $replies$
      insert into public.ritual_replies (ritual_id, user_id, author, text, created_at)
      select
        r.id,
        r.user_id,
        coalesce(nullif(trim(reply_item->>'author'), ''), r.author, 'Observer') as author,
        left(trim(reply_item->>'text'), 180) as text,
        case
          when coalesce(reply_item->>'timestamp', '') ~ '^\d{4}-\d{2}-\d{2}T'
            then (reply_item->>'timestamp')::timestamp with time zone
          else coalesce(r.timestamp, timezone('utc'::text, now()))
        end as created_at
      from public.rituals r
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(r.replies) = 'array' then r.replies
          else '[]'::jsonb
        end
      ) reply_item
      where r.user_id is not null
        and coalesce(trim(reply_item->>'text'), '') <> ''
        and not exists (
          select 1
          from public.ritual_replies rr
          where rr.ritual_id = r.id
            and rr.user_id = r.user_id
            and rr.author = coalesce(nullif(trim(reply_item->>'author'), ''), r.author, 'Observer')
            and rr.text = left(trim(reply_item->>'text'), 180)
        );
    $replies$;
  end if;
end $$;

alter table public.rituals drop column if exists echoes;
alter table public.rituals drop column if exists is_echoed_by_me;
alter table public.rituals drop column if exists replies;

insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

drop policy if exists "Public Posters Read" on storage.objects;
create policy "Public Posters Read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'posters');
