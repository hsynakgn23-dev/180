-- Referral program schema baseline (2026-02-16)
-- This migration prepares cloud tables for invite/referral settlement.

create table if not exists public.referral_invites (
  code text primary key,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  inviter_email text not null,
  claim_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists referral_invites_inviter_user_idx
  on public.referral_invites (inviter_user_id);

create table if not exists public.referral_claims (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_invites(code) on delete cascade,
  invitee_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  inviter_reward_xp integer not null,
  invitee_reward_xp integer not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (invitee_user_id),
  unique (code, invitee_user_id)
);

create index if not exists referral_claims_code_idx
  on public.referral_claims (code, created_at desc);

create index if not exists referral_claims_invitee_idx
  on public.referral_claims (invitee_user_id, created_at desc);

alter table public.referral_invites enable row level security;
alter table public.referral_claims enable row level security;
