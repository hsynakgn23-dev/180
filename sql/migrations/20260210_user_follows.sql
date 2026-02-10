-- Follow graph migration (2026-02-10)
-- Adds persistent follower/following relations.

create table if not exists public.user_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_user_id, followed_user_id),
  constraint user_follows_no_self check (follower_user_id <> followed_user_id)
);

create index if not exists user_follows_followed_idx
  on public.user_follows (followed_user_id);

alter table public.user_follows enable row level security;

drop policy if exists "Public User Follows Read" on public.user_follows;
drop policy if exists "Authenticated User Follows Insert Own" on public.user_follows;
drop policy if exists "Authenticated User Follows Delete Own" on public.user_follows;

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

drop policy if exists "Profiles Select Own" on public.profiles;
drop policy if exists "Profiles Select Public" on public.profiles;

create policy "Profiles Select Public"
on public.profiles for select
to anon, authenticated
using (true);
