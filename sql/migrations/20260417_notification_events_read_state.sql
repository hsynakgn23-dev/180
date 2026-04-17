alter table public.notification_events
  add column if not exists read_at timestamp with time zone;

create index if not exists notification_events_recipient_read_created_idx
  on public.notification_events (recipient_user_id, read_at, created_at desc);

revoke update on public.notification_events from anon, authenticated;
grant update (read_at) on public.notification_events to authenticated;

drop policy if exists "Notification Events Update Own Read State" on public.notification_events;
create policy "Notification Events Update Own Read State"
on public.notification_events for update
to authenticated
using (auth.uid() = recipient_user_id)
with check (auth.uid() = recipient_user_id);
