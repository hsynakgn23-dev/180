-- Mobile/server-backed notification event log.
-- Keeps in-app notification inbox resilient even when remote push is delayed or unavailable.

create extension if not exists "uuid-ossp";

create table if not exists public.notification_events (
  id uuid default uuid_generate_v4() primary key,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  ritual_id uuid references public.rituals(id) on delete set null,
  kind text not null default 'generic' check (kind in ('comment', 'like', 'follow', 'daily_drop', 'streak', 'generic')),
  title text not null,
  body text not null default '',
  deep_link text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists notification_events_recipient_created_idx
  on public.notification_events (recipient_user_id, created_at desc);

create index if not exists notification_events_actor_created_idx
  on public.notification_events (actor_user_id, created_at desc);

alter table public.notification_events enable row level security;

drop policy if exists "Notification Events Select Own" on public.notification_events;
create policy "Notification Events Select Own"
on public.notification_events for select
to authenticated
using (auth.uid() = recipient_user_id);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_events'
  ) then
    alter publication supabase_realtime add table public.notification_events;
  end if;
end $$;
