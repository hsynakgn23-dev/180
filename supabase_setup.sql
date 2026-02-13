-- Enable UUID extension for generating unique IDs
create extension if not exists "uuid-ossp";

-- 1. Daily Showcase Table
-- Stores the Daily 5 movies to ensure valid images and global sync.
create table public.daily_showcase (
  date date primary key, -- '2024-02-14'
  movies jsonb not null, -- Stores the array of 5 Movie objects
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Arena Rituals Table
-- Stores user posts/rituals globally.
create table public.rituals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid, -- Link to auth.users
  author text not null, -- Display Name
  avg_bg_color text, -- For UI consistency (optional)
  movie_title text not null,
  poster_path text, -- Validated poster path
  text text not null, -- The user's thought
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  league text default 'Bronze',
  year text,
  featured_marks jsonb -- Store array of mark names
);

-- Ensure rituals.user_id is linked to auth.users on fresh or existing setups.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rituals_user_id_fkey'
  ) then
    alter table public.rituals
      add constraint rituals_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Clean up possible orphan rows left from previous ON DELETE SET NULL behavior.
delete from public.rituals
where user_id is null;

-- If this script is applied over an older schema, remove embedded social columns.
alter table public.rituals drop column if exists echoes;
alter table public.rituals drop column if exists is_echoed_by_me;
alter table public.rituals drop column if exists replies;

-- 2b. Ritual Echoes Table
-- Tracks one echo per user per ritual.
create table if not exists public.ritual_echoes (
  ritual_id uuid not null references public.rituals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (ritual_id, user_id)
);

-- 2c. Ritual Replies Table
-- Stores replies as first-class rows instead of embedding JSON in rituals.
create table if not exists public.ritual_replies (
  id uuid default uuid_generate_v4() primary key,
  ritual_id uuid not null references public.rituals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null,
  text text not null check (char_length(text) > 0 and char_length(text) <= 180),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2d. User Follow Graph
-- Tracks follow relationships between users.
create table if not exists public.user_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_user_id, followed_user_id),
  constraint user_follows_no_self check (follower_user_id <> followed_user_id)
);

-- Comment moderation helpers (Turkish/English profanity and insult filtering).
create or replace function public.normalize_moderation_text(input_text text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(lower(coalesce(input_text, '')), 'ı', 'i'),
              'ğ', 'g'),
            'ş', 's'),
          'ç', 'c'),
        'ö', 'o'),
      'ü', 'u'),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.comment_contains_blocked_language(input_text text)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := public.normalize_moderation_text(input_text);
  if normalized = '' then
    return false;
  end if;

  if normalized ~ '(^|[^a-z0-9])(amk|aq|mk|oc|orospu|pic|siktir|sikik|sikerim|sikeyim|yarrak|gavat|ibne|got|gerizekali|salak|aptal|mal|fuck|fucking|shit|bitch|asshole|motherfucker|retard|slut|whore)([^a-z0-9]|$)' then
    return true;
  end if;

  if normalized like '%amina koyim%'
     or normalized like '%amina koyayim%'
     or normalized like '%anani sikeyim%'
     or normalized like '%ananin ami%'
     or normalized like '%orospu cocugu%'
     or normalized like '%siktir git%'
     or normalized like '%geri zekali%'
     or normalized like '%fuck you%'
     or normalized like '%go to hell%' then
    return true;
  end if;

  return false;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rituals_text_length_chk'
      and conrelid = 'public.rituals'::regclass
  ) then
    alter table public.rituals
      add constraint rituals_text_length_chk
      check (char_length(text) > 0 and char_length(text) <= 180) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rituals_text_moderation_chk'
      and conrelid = 'public.rituals'::regclass
  ) then
    alter table public.rituals
      add constraint rituals_text_moderation_chk
      check (not public.comment_contains_blocked_language(text)) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ritual_replies_text_moderation_chk'
      and conrelid = 'public.ritual_replies'::regclass
  ) then
    alter table public.ritual_replies
      add constraint ritual_replies_text_moderation_chk
      check (not public.comment_contains_blocked_language(text)) not valid;
  end if;
end $$;

-- Performance indexes for feed/reply/echo lookups.
create index if not exists rituals_timestamp_idx
  on public.rituals (timestamp desc);

create index if not exists rituals_user_timestamp_idx
  on public.rituals (user_id, timestamp desc);

create index if not exists ritual_echoes_ritual_id_idx
  on public.ritual_echoes (ritual_id);

create index if not exists ritual_replies_ritual_created_idx
  on public.ritual_replies (ritual_id, created_at);

create index if not exists user_follows_followed_idx
  on public.user_follows (followed_user_id);

-- 3. Profile State Table
-- Stores per-user XP/profile state as JSON for cross-device sync.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  xp_state jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Row Level Security (RLS) Policies
-- Essential for securing the data.

alter table public.daily_showcase enable row level security;
alter table public.rituals enable row level security;
alter table public.ritual_echoes enable row level security;
alter table public.ritual_replies enable row level security;
alter table public.user_follows enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Public Daily Read" on public.daily_showcase;
drop policy if exists "Anon Daily Insert" on public.daily_showcase;
drop policy if exists "Public Rituals Read" on public.rituals;
drop policy if exists "Public Rituals Insert" on public.rituals;
drop policy if exists "Public Rituals Update" on public.rituals;
drop policy if exists "Authenticated Rituals Update" on public.rituals;
drop policy if exists "Authenticated Rituals Insert" on public.rituals;
drop policy if exists "Authenticated Rituals Delete Own" on public.rituals;
drop policy if exists "Public Ritual Echoes Read" on public.ritual_echoes;
drop policy if exists "Authenticated Ritual Echoes Insert Own" on public.ritual_echoes;
drop policy if exists "Authenticated Ritual Echoes Delete Own" on public.ritual_echoes;
drop policy if exists "Public Ritual Replies Read" on public.ritual_replies;
drop policy if exists "Authenticated Ritual Replies Insert Own" on public.ritual_replies;
drop policy if exists "Authenticated Ritual Replies Delete Own" on public.ritual_replies;
drop policy if exists "Public User Follows Read" on public.user_follows;
drop policy if exists "Authenticated User Follows Insert Own" on public.user_follows;
drop policy if exists "Authenticated User Follows Delete Own" on public.user_follows;
drop policy if exists "Profiles Select Own" on public.profiles;
drop policy if exists "Profiles Select Public" on public.profiles;
drop policy if exists "Profiles Insert Own" on public.profiles;
drop policy if exists "Profiles Update Own" on public.profiles;

-- Policy: Everyone can READ the daily showcase
create policy "Public Daily Read"
on public.daily_showcase for select
to anon, authenticated
using (true);

-- Daily showcase writes should be done by cron/service role, not anon clients.
-- No anon insert/update policy is defined for public.daily_showcase.

-- Policy: Everyone can READ rituals
create policy "Public Rituals Read"
on public.rituals for select
to anon, authenticated
using (true);

create or replace function public.auth_user_is_banned(target_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = auth, public
as $$
declare
  banned_until_at timestamp with time zone;
begin
  if target_user_id is null then
    return false;
  end if;

  select u.banned_until
  into banned_until_at
  from auth.users u
  where u.id = target_user_id;

  if banned_until_at is null then
    return false;
  end if;

  return banned_until_at > timezone('utc'::text, now());
end;
$$;

revoke all on function public.auth_user_is_banned(uuid) from public;
grant execute on function public.auth_user_is_banned(uuid) to authenticated;

-- Policy: Authenticated users can INSERT only their own rituals.
create policy "Authenticated Rituals Insert"
on public.rituals for insert
to authenticated
with check (auth.uid() = user_id and not public.auth_user_is_banned(auth.uid()));

create policy "Authenticated Rituals Delete Own"
on public.rituals for delete
to authenticated
using (auth.uid() = user_id);

-- Ritual echoes policies
create policy "Public Ritual Echoes Read"
on public.ritual_echoes for select
to anon, authenticated
using (true);

create policy "Authenticated Ritual Echoes Insert Own"
on public.ritual_echoes for insert
to authenticated
with check (auth.uid() = user_id and not public.auth_user_is_banned(auth.uid()));

create policy "Authenticated Ritual Echoes Delete Own"
on public.ritual_echoes for delete
to authenticated
using (auth.uid() = user_id);

-- Ritual replies policies
create policy "Public Ritual Replies Read"
on public.ritual_replies for select
to anon, authenticated
using (true);

create policy "Authenticated Ritual Replies Insert Own"
on public.ritual_replies for insert
to authenticated
with check (auth.uid() = user_id and not public.auth_user_is_banned(auth.uid()));

create policy "Authenticated Ritual Replies Delete Own"
on public.ritual_replies for delete
to authenticated
using (auth.uid() = user_id);

-- User follows policies
create policy "Public User Follows Read"
on public.user_follows for select
to anon, authenticated
using (true);

create policy "Authenticated User Follows Insert Own"
on public.user_follows for insert
to authenticated
with check (
  auth.uid() = follower_user_id
  and follower_user_id <> followed_user_id
);

create policy "Authenticated User Follows Delete Own"
on public.user_follows for delete
to authenticated
using (auth.uid() = follower_user_id);

-- Policy: Public read for profile rows (required for public profile pages).
create policy "Profiles Select Public"
on public.profiles for select
to anon, authenticated
using (true);

create policy "Profiles Insert Own"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Profiles Update Own"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_banned_user_content_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.banned_until is not null
     and new.banned_until > timezone('utc'::text, now())
     and (old.banned_until is null or old.banned_until <= timezone('utc'::text, now())) then
    delete from public.ritual_echoes where user_id = new.id;
    delete from public.ritual_replies where user_id = new.id;
    delete from public.rituals where user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_banned_cleanup on auth.users;
create trigger on_auth_user_banned_cleanup
after update of banned_until on auth.users
for each row
execute function public.handle_banned_user_content_cleanup();

delete from public.ritual_echoes e
using auth.users u
where e.user_id = u.id
  and u.banned_until is not null
  and u.banned_until > timezone('utc'::text, now());

delete from public.ritual_replies r
using auth.users u
where r.user_id = u.id
  and u.banned_until is not null
  and u.banned_until > timezone('utc'::text, now());

delete from public.rituals rt
using auth.users u
where rt.user_id = u.id
  and u.banned_until is not null
  and u.banned_until > timezone('utc'::text, now());

-- 3b. Abuse protection: DB-level rate limiting for write-heavy social actions.
create or replace function public.enforce_ritual_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc'::text, now());
  window_start timestamptz := now_utc - interval '10 minutes';
  day_start timestamptz := date_trunc('day', now_utc);
  recent_count integer;
  daily_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*) into recent_count
  from public.rituals
  where user_id = new.user_id
    and "timestamp" >= window_start;

  if recent_count >= 6 then
    raise exception 'Rate limit exceeded: max 6 rituals per 10 minutes.'
      using errcode = 'P0001';
  end if;

  select count(*) into daily_count
  from public.rituals
  where user_id = new.user_id
    and "timestamp" >= day_start;

  if daily_count >= 30 then
    raise exception 'Rate limit exceeded: max 30 rituals per day.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_ritual_reply_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc'::text, now());
  window_start timestamptz := now_utc - interval '10 minutes';
  recent_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*) into recent_count
  from public.ritual_replies
  where user_id = new.user_id
    and created_at >= window_start;

  if recent_count >= 20 then
    raise exception 'Rate limit exceeded: max 20 replies per 10 minutes.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_ritual_echo_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc'::text, now());
  window_start timestamptz := now_utc - interval '10 minutes';
  recent_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*) into recent_count
  from public.ritual_echoes
  where user_id = new.user_id
    and created_at >= window_start;

  if recent_count >= 60 then
    raise exception 'Rate limit exceeded: max 60 echoes per 10 minutes.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists rituals_rate_limit_insert on public.rituals;
create trigger rituals_rate_limit_insert
before insert on public.rituals
for each row execute function public.enforce_ritual_insert_rate_limit();

drop trigger if exists ritual_replies_rate_limit_insert on public.ritual_replies;
create trigger ritual_replies_rate_limit_insert
before insert on public.ritual_replies
for each row execute function public.enforce_ritual_reply_insert_rate_limit();

drop trigger if exists ritual_echoes_rate_limit_insert on public.ritual_echoes;
create trigger ritual_echoes_rate_limit_insert
before insert on public.ritual_echoes
for each row execute function public.enforce_ritual_echo_insert_rate_limit();

-- 4. Storage Bucket (Posters)
-- Create a public bucket for movie posters
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

-- Allow public read access to posters
drop policy if exists "Public Posters Read" on storage.objects;
create policy "Public Posters Read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'posters');
