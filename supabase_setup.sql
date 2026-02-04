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
  user_id uuid, -- Link to auth.users if we use Auth later, or just a client-generated UUID for now
  author text not null, -- Display Name
  avg_bg_color text, -- For UI consistency (optional)
  movie_title text not null,
  poster_path text, -- Validated poster path
  text text not null, -- The user's thought
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  echoes integer default 0,
  is_echoed_by_me boolean default false, -- Can be user-specific in a real relation table
  replies jsonb default '[]'::jsonb, -- Store replies as JSON for simplicity in Phase 1
  league text default 'Bronze',
  year text,
  featured_marks jsonb -- Store array of mark names
);

-- 3. Row Level Security (RLS) Policies
-- Essential for securing the data.

alter table public.daily_showcase enable row level security;
alter table public.rituals enable row level security;

-- Policy: Everyone can READ the daily showcase
create policy "Public Daily Read"
on public.daily_showcase for select
to anon
using (true);

-- Policy: Anon/Service Role can INSERT daily showcase (if the logic runs server-side or secure client)
-- For this MVP, we'll allow anon insert IF the date doesn't exist (handled by Primary Key constraint mostly)
-- Ideally, use a Service Role for writing Daily 5, but for Client-side generation:
create policy "Anon Daily Insert"
on public.daily_showcase for insert
to anon
with check (true);

-- Policy: Everyone can READ rituals
create policy "Public Rituals Read"
on public.rituals for select
to anon
using (true);

-- Policy: Everyone can INSERT rituals (Posting)
create policy "Public Rituals Insert"
on public.rituals for insert
to anon
with check (true);

-- Policy: Everyone can UPDATE rituals (Echoing/Replying)
-- In a real app, restrict this to the owner or specific actions.
create policy "Public Rituals Update"
on public.rituals for update
to anon
using (true);
