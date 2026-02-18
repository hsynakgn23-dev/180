-- Mobile push token/device registry on profile state.
-- Stores per-user push device metadata in a dedicated profile column
-- so web xp_state writes do not override mobile push data.

alter table public.profiles
  add column if not exists mobile_push_state jsonb not null default '{}'::jsonb;

update public.profiles
set mobile_push_state = '{}'::jsonb
where mobile_push_state is null;
