begin;

create table if not exists public.wallet_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text,
  source text not null,
  source_id text,
  reason text,
  delta integer not null default 0,
  balance_after integer not null check (balance_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists wallet_ledger_user_created_idx
  on public.wallet_ledger (user_id, created_at desc);

create index if not exists wallet_ledger_source_created_idx
  on public.wallet_ledger (source, created_at desc);

create unique index if not exists wallet_ledger_user_event_key_uidx
  on public.wallet_ledger (user_id, event_key)
  where event_key is not null;

create table if not exists public.xp_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text,
  source text not null,
  source_id text,
  reason text,
  delta integer not null,
  total_after integer not null check (total_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists xp_ledger_user_created_idx
  on public.xp_ledger (user_id, created_at desc);

create index if not exists xp_ledger_source_created_idx
  on public.xp_ledger (source, created_at desc);

create unique index if not exists xp_ledger_user_event_key_uidx
  on public.xp_ledger (user_id, event_key)
  where event_key is not null;

create table if not exists public.arena_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null,
  event_key text,
  source text not null,
  source_id text,
  reason text,
  delta integer not null default 0,
  activity_delta integer not null default 0,
  total_after integer not null check (total_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists arena_ledger_user_week_created_idx
  on public.arena_ledger (user_id, week_key, created_at desc);

create index if not exists arena_ledger_source_created_idx
  on public.arena_ledger (source, created_at desc);

create unique index if not exists arena_ledger_user_event_key_uidx
  on public.arena_ledger (user_id, event_key)
  where event_key is not null;

alter table public.wallet_ledger enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.arena_ledger enable row level security;

drop policy if exists "Wallet Ledger Select Own Or Admin" on public.wallet_ledger;
create policy "Wallet Ledger Select Own Or Admin"
on public.wallet_ledger for select
to authenticated
using (auth.uid() = user_id or public.auth_user_is_admin(auth.uid()));

drop policy if exists "XP Ledger Select Own Or Admin" on public.xp_ledger;
create policy "XP Ledger Select Own Or Admin"
on public.xp_ledger for select
to authenticated
using (auth.uid() = user_id or public.auth_user_is_admin(auth.uid()));

drop policy if exists "Arena Ledger Select Own Or Admin" on public.arena_ledger;
create policy "Arena Ledger Select Own Or Admin"
on public.arena_ledger for select
to authenticated
using (auth.uid() = user_id or public.auth_user_is_admin(auth.uid()));

commit;
