-- Admin panel + user safety foundations (2026-03-04)
-- Scope:
-- 1) Web-only admin authorization and audit tables.
-- 2) User block graph for bilateral visibility filtering.
-- 3) Soft-remove support for rituals and replies.
-- 4) Report + moderation log tables for future abuse tooling.

create extension if not exists "uuid-ossp";

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

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'moderator')),
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_no_self check (blocker_user_id <> blocked_user_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_user_id);

create table if not exists public.user_moderation_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended_until timestamp with time zone,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists user_moderation_state_suspended_idx
  on public.user_moderation_state (suspended_until);

create table if not exists public.content_reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  ritual_id uuid references public.rituals(id) on delete set null,
  reply_id uuid references public.ritual_replies(id) on delete set null,
  reason_code text not null default 'other',
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  reviewed_at timestamp with time zone,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint content_reports_target_chk check (num_nonnulls(target_user_id, ritual_id, reply_id) >= 1)
);

create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);

create index if not exists content_reports_ritual_idx
  on public.content_reports (ritual_id);

create index if not exists content_reports_reply_idx
  on public.content_reports (reply_id);

create table if not exists public.moderation_actions (
  id uuid default uuid_generate_v4() primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  ritual_id uuid references public.rituals(id) on delete set null,
  reply_id uuid references public.ritual_replies(id) on delete set null,
  report_id uuid references public.content_reports(id) on delete set null,
  action text not null,
  reason_code text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists moderation_actions_created_idx
  on public.moderation_actions (created_at desc);

alter table public.rituals
  add column if not exists is_removed boolean not null default false;

alter table public.rituals
  add column if not exists removed_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rituals'
      and column_name = 'removed_by'
  ) then
    alter table public.rituals
      add column removed_by uuid references auth.users(id) on delete set null;
  end if;
end $$;

alter table public.rituals
  add column if not exists removal_reason text;

alter table public.ritual_replies
  add column if not exists is_removed boolean not null default false;

alter table public.ritual_replies
  add column if not exists removed_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ritual_replies'
      and column_name = 'removed_by'
  ) then
    alter table public.ritual_replies
      add column removed_by uuid references auth.users(id) on delete set null;
  end if;
end $$;

alter table public.ritual_replies
  add column if not exists removal_reason text;

create or replace function public.touch_user_moderation_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists user_moderation_state_set_updated_at on public.user_moderation_state;
create trigger user_moderation_state_set_updated_at
before update on public.user_moderation_state
for each row execute function public.touch_user_moderation_state_updated_at();

create or replace function public.auth_user_is_admin(target_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if target_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.admin_users au
    where au.user_id = target_user_id
  );
end;
$$;

revoke all on function public.auth_user_is_admin(uuid) from public;
grant execute on function public.auth_user_is_admin(uuid) to authenticated;

create or replace function public.can_view_user_content(target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  viewer_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    return true;
  end if;

  if viewer_user_id is null then
    return true;
  end if;

  if viewer_user_id = target_user_id then
    return true;
  end if;

  return not exists (
    select 1
    from public.user_blocks ub
    where
      (ub.blocker_user_id = viewer_user_id and ub.blocked_user_id = target_user_id)
      or
      (ub.blocker_user_id = target_user_id and ub.blocked_user_id = viewer_user_id)
  );
end;
$$;

revoke all on function public.can_view_user_content(uuid) from public;
grant execute on function public.can_view_user_content(uuid) to anon, authenticated;

create or replace function public.auth_user_is_banned(target_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = auth, public
as $$
declare
  auth_banned_until timestamp with time zone;
  moderated_until timestamp with time zone;
begin
  if target_user_id is null then
    return false;
  end if;

  select u.banned_until
  into auth_banned_until
  from auth.users u
  where u.id = target_user_id;

  select ms.suspended_until
  into moderated_until
  from public.user_moderation_state ms
  where ms.user_id = target_user_id;

  return coalesce(auth_banned_until, '-infinity'::timestamp with time zone) > timezone('utc'::text, now())
    or coalesce(moderated_until, '-infinity'::timestamp with time zone) > timezone('utc'::text, now());
end;
$$;

revoke all on function public.auth_user_is_banned(uuid) from public;
grant execute on function public.auth_user_is_banned(uuid) to authenticated;

create or replace function public.handle_user_block_graph_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_follows
  where
    (follower_user_id = new.blocker_user_id and followed_user_id = new.blocked_user_id)
    or
    (follower_user_id = new.blocked_user_id and followed_user_id = new.blocker_user_id);

  return new;
end;
$$;

drop trigger if exists on_user_block_graph_cleanup on public.user_blocks;
create trigger on_user_block_graph_cleanup
after insert on public.user_blocks
for each row execute function public.handle_user_block_graph_cleanup();

alter table public.admin_users enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_moderation_state enable row level security;
alter table public.content_reports enable row level security;
alter table public.moderation_actions enable row level security;

drop policy if exists "Admin Users Select Own" on public.admin_users;
create policy "Admin Users Select Own"
on public.admin_users for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "User Blocks Select Related" on public.user_blocks;
drop policy if exists "User Blocks Insert Own" on public.user_blocks;
drop policy if exists "User Blocks Delete Own" on public.user_blocks;

create policy "User Blocks Select Related"
on public.user_blocks for select
to authenticated
using (auth.uid() = blocker_user_id or auth.uid() = blocked_user_id);

create policy "User Blocks Insert Own"
on public.user_blocks for insert
to authenticated
with check (
  auth.uid() = blocker_user_id
  and blocker_user_id <> blocked_user_id
);

create policy "User Blocks Delete Own"
on public.user_blocks for delete
to authenticated
using (auth.uid() = blocker_user_id);

drop policy if exists "Content Reports Select Own Or Admin" on public.content_reports;
drop policy if exists "Content Reports Insert Own" on public.content_reports;
drop policy if exists "Content Reports Update Admin" on public.content_reports;

create policy "Content Reports Select Own Or Admin"
on public.content_reports for select
to authenticated
using (auth.uid() = reporter_user_id or public.auth_user_is_admin(auth.uid()));

create policy "Content Reports Insert Own"
on public.content_reports for insert
to authenticated
with check (auth.uid() = reporter_user_id);

create policy "Content Reports Update Admin"
on public.content_reports for update
to authenticated
using (public.auth_user_is_admin(auth.uid()))
with check (public.auth_user_is_admin(auth.uid()));

drop policy if exists "Moderation Actions Select Admin" on public.moderation_actions;
create policy "Moderation Actions Select Admin"
on public.moderation_actions for select
to authenticated
using (public.auth_user_is_admin(auth.uid()));

drop policy if exists "User Moderation State Select Admin" on public.user_moderation_state;
create policy "User Moderation State Select Admin"
on public.user_moderation_state for select
to authenticated
using (public.auth_user_is_admin(auth.uid()));

drop policy if exists "Public Rituals Read" on public.rituals;
create policy "Public Rituals Read"
on public.rituals for select
to anon, authenticated
using (
  coalesce(is_removed, false) = false
  and public.can_view_user_content(user_id)
);

drop policy if exists "Public Ritual Echoes Read" on public.ritual_echoes;
create policy "Public Ritual Echoes Read"
on public.ritual_echoes for select
to anon, authenticated
using (
  public.can_view_user_content(user_id)
  and exists (
    select 1
    from public.rituals rt
    where rt.id = ritual_id
      and coalesce(rt.is_removed, false) = false
      and public.can_view_user_content(rt.user_id)
  )
);

drop policy if exists "Public Ritual Replies Read" on public.ritual_replies;
create policy "Public Ritual Replies Read"
on public.ritual_replies for select
to anon, authenticated
using (
  coalesce(is_removed, false) = false
  and public.can_view_user_content(user_id)
  and exists (
    select 1
    from public.rituals rt
    where rt.id = ritual_id
      and coalesce(rt.is_removed, false) = false
      and public.can_view_user_content(rt.user_id)
  )
);

drop policy if exists "Profiles Select Public" on public.profiles;
create policy "Profiles Select Public"
on public.profiles for select
to anon, authenticated
using (public.can_view_user_content(user_id));

drop policy if exists "Public User Follows Read" on public.user_follows;
drop policy if exists "Authenticated User Follows Insert Own" on public.user_follows;
drop policy if exists "Authenticated User Follows Delete Own" on public.user_follows;

create policy "Public User Follows Read"
on public.user_follows for select
to anon, authenticated
using (
  public.can_view_user_content(follower_user_id)
  and public.can_view_user_content(followed_user_id)
);

create policy "Authenticated User Follows Insert Own"
on public.user_follows for insert
to authenticated
with check (
  auth.uid() = follower_user_id
  and follower_user_id <> followed_user_id
  and public.can_view_user_content(followed_user_id)
);

create policy "Authenticated User Follows Delete Own"
on public.user_follows for delete
to authenticated
using (auth.uid() = follower_user_id);

drop policy if exists "Authenticated Ritual Echoes Insert Own" on public.ritual_echoes;
create policy "Authenticated Ritual Echoes Insert Own"
on public.ritual_echoes for insert
to authenticated
with check (
  auth.uid() = user_id
  and not public.auth_user_is_banned(auth.uid())
  and exists (
    select 1
    from public.rituals rt
    where rt.id = ritual_id
      and coalesce(rt.is_removed, false) = false
      and public.can_view_user_content(rt.user_id)
  )
);

drop policy if exists "Authenticated Ritual Replies Insert Own" on public.ritual_replies;
create policy "Authenticated Ritual Replies Insert Own"
on public.ritual_replies for insert
to authenticated
with check (
  auth.uid() = user_id
  and not public.auth_user_is_banned(auth.uid())
  and coalesce(is_removed, false) = false
  and exists (
    select 1
    from public.rituals rt
    where rt.id = ritual_id
      and coalesce(rt.is_removed, false) = false
      and public.can_view_user_content(rt.user_id)
  )
);
