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
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end $$;

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

-- Performance indexes for feed/reply/echo lookups.
create index if not exists rituals_timestamp_idx
  on public.rituals (timestamp desc);

create index if not exists rituals_user_timestamp_idx
  on public.rituals (user_id, timestamp desc);

create index if not exists ritual_echoes_ritual_id_idx
  on public.ritual_echoes (ritual_id);

create index if not exists ritual_replies_ritual_created_idx
  on public.ritual_replies (ritual_id, created_at);

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
drop policy if exists "Profiles Select Own" on public.profiles;
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

-- Policy: Authenticated users can INSERT only their own rituals.
create policy "Authenticated Rituals Insert"
on public.rituals for insert
to authenticated
with check (auth.uid() = user_id);

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
with check (auth.uid() = user_id);

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
with check (auth.uid() = user_id);

create policy "Authenticated Ritual Replies Delete Own"
on public.ritual_replies for delete
to authenticated
using (auth.uid() = user_id);

-- Policy: Authenticated users can manage only their own profile row.
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
