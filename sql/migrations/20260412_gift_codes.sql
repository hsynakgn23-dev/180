-- Gift code system (2026-04-12)
-- Admin creates single-use or multi-use codes that grant tickets or premium.
-- Users redeem codes through the app; each redemption is logged.

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. gift_codes — codes created by admin
-- ============================================================

create table if not exists public.gift_codes (
  id            uuid default uuid_generate_v4() primary key,
  code          text not null unique,
  gift_type     text not null check (gift_type in ('tickets', 'premium')),
  -- tickets: amount of tickets granted
  -- premium:  duration_days of premium granted
  value         integer not null check (value > 0),
  max_uses      integer not null default 1 check (max_uses >= 1),
  use_count     integer not null default 0 check (use_count >= 0),
  expires_at    timestamp with time zone,
  note          text,
  created_by    uuid not null references auth.users(id) on delete set null,
  created_at    timestamp with time zone default timezone('utc'::text, now()) not null,
  is_revoked    boolean not null default false
);

create index if not exists gift_codes_code_idx
  on public.gift_codes (code);

create index if not exists gift_codes_created_by_idx
  on public.gift_codes (created_by, created_at desc);

-- ============================================================
-- 2. gift_code_redemptions — one row per use
-- ============================================================

create table if not exists public.gift_code_redemptions (
  id            uuid default uuid_generate_v4() primary key,
  code          text not null references public.gift_codes(code) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  gift_type     text not null,
  value         integer not null,
  redeemed_at   timestamp with time zone default timezone('utc'::text, now()) not null,
  -- each user can only redeem a given code once
  unique (code, user_id)
);

create index if not exists gift_code_redemptions_user_idx
  on public.gift_code_redemptions (user_id, redeemed_at desc);

-- ============================================================
-- 3. RLS — admin reads/writes via service role (no client RLS needed)
--    Users read their own redemptions only.
-- ============================================================

alter table public.gift_codes enable row level security;
alter table public.gift_code_redemptions enable row level security;

-- gift_codes: no direct client access; all writes via service-role API
drop policy if exists "Gift Codes Admin Read" on public.gift_codes;
create policy "Gift Codes Admin Read"
on public.gift_codes for select
to authenticated
using (public.auth_user_is_admin(auth.uid()));

-- redemptions: users see their own
drop policy if exists "Gift Redemptions Select Own" on public.gift_code_redemptions;
create policy "Gift Redemptions Select Own"
on public.gift_code_redemptions for select
to authenticated
using (auth.uid() = user_id);
