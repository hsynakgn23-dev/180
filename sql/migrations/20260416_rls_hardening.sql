begin;

-- Harden tables that were already created with RLS enabled but without
-- user-facing read policies, plus wallet topup history which lacked RLS.
-- These rules keep service-role automation working while allowing only the
-- owning authenticated user to read their own records.

alter table if exists public.analytics_events enable row level security;

drop policy if exists "Analytics Events Select Own" on public.analytics_events;
create policy "Analytics Events Select Own"
on public.analytics_events for select
to authenticated
using (auth.uid() = user_id);

alter table if exists public.referral_invites enable row level security;

drop policy if exists "Referral Invites Select Own" on public.referral_invites;
create policy "Referral Invites Select Own"
on public.referral_invites for select
to authenticated
using (auth.uid() = inviter_user_id);

alter table if exists public.referral_claims enable row level security;

drop policy if exists "Referral Claims Select Own As Invitee" on public.referral_claims;
create policy "Referral Claims Select Own As Invitee"
on public.referral_claims for select
to authenticated
using (auth.uid() = invitee_user_id);

drop policy if exists "Referral Claims Select Own As Inviter" on public.referral_claims;
create policy "Referral Claims Select Own As Inviter"
on public.referral_claims for select
to authenticated
using (
  exists (
    select 1
    from public.referral_invites ri
    where ri.code = referral_claims.code
      and ri.inviter_user_id = auth.uid()
  )
);

alter table if exists public.referral_device_claims enable row level security;

drop policy if exists "Referral Device Claims Select Own" on public.referral_device_claims;
create policy "Referral Device Claims Select Own"
on public.referral_device_claims for select
to authenticated
using (auth.uid() = invitee_user_id);

alter table if exists public.wallet_topup_grants enable row level security;

drop policy if exists "Wallet Topup Grants Select Own" on public.wallet_topup_grants;
create policy "Wallet Topup Grants Select Own"
on public.wallet_topup_grants for select
to authenticated
using (auth.uid() = user_id);

commit;
