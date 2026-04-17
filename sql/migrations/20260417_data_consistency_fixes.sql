-- ============================================================
-- Paket 3: Data Consistency Fixes (2026-04-17)
-- ============================================================
-- Fix 1: One-time repair — sync totalXP for profiles that only have `xp`
-- Fix 2: subscription_tier auto-sync trigger (subscriptions → profiles)
-- Fix 3: One-time repair — sync referral_invites.claim_count
-- Fix 4: referral_invites.claim_count auto-sync trigger
-- ============================================================

begin;

-- ============================================================
-- FIX 1: totalXP / xp field one-time sync
-- Problem: some profiles may have xp_state.xp but not xp_state.totalXP
--          (or totalXP < xp from older code paths)
-- Solution: set totalXP = max(totalXP, xp) for all affected profiles
-- Going forward: applyProgressionReward always writes totalXP,
--               record_pool_answer RPC writes both (intentional)
-- ============================================================
update public.profiles
set
    xp_state = jsonb_set(
        xp_state,
        '{totalXP}',
        to_jsonb(
            greatest(
                coalesce(
                    case when xp_state->>'totalXP' ~ '^\d+$'
                    then (xp_state->>'totalXP')::integer
                    else 0 end,
                    0
                ),
                coalesce(
                    case when xp_state->>'xp' ~ '^\d+$'
                    then (xp_state->>'xp')::integer
                    else 0 end,
                    0
                )
            )
        ),
        true
    ),
    updated_at = timezone('utc', now())
where
    xp_state is not null
    and (
        xp_state->>'totalXP' is null
        or (
            xp_state->>'xp' is not null
            and xp_state->>'xp' ~ '^\d+$'
            and xp_state->>'totalXP' ~ '^\d+$'
            and (xp_state->>'xp')::integer > (xp_state->>'totalXP')::integer
        )
    );

-- ============================================================
-- FIX 2: subscription_tier auto-sync trigger
-- Problem: profiles.subscription_tier is denormalized from
--          subscriptions.status/plan. If a webhook fails,
--          they drift. This trigger keeps them in sync.
-- Logic: active subscription → premium (or supporter if plan='supporter')
--        no active subscription → free
-- ============================================================
create or replace function public.sync_subscription_tier_from_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_tier text;
begin
    -- Determine which user_id to update
    v_user_id := coalesce(NEW.user_id, OLD.user_id);

    -- Check if user has any active subscription now
    select
        case
            when s.plan = 'supporter' then 'supporter'
            else 'premium'
        end
    into v_tier
    from public.subscriptions s
    where s.user_id = v_user_id
      and s.status = 'active'
    limit 1;

    -- If no active subscription found, tier is free
    if v_tier is null then
        v_tier := 'free';
    end if;

    -- Update profile tier
    update public.profiles
    set
        subscription_tier = v_tier,
        updated_at = timezone('utc', now())
    where user_id = v_user_id
      and subscription_tier is distinct from v_tier;

    return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists sync_subscription_tier on public.subscriptions;
create trigger sync_subscription_tier
after insert or update or delete on public.subscriptions
for each row
execute function public.sync_subscription_tier_from_subscriptions();

-- One-time repair: apply subscription sync to all existing profiles
-- Step A: set premium/supporter for users with an active subscription
update public.profiles p
set
    subscription_tier = case
        when s.plan = 'supporter' then 'supporter'
        else 'premium'
    end,
    updated_at = timezone('utc', now())
from public.subscriptions s
where s.user_id = p.user_id
  and s.status = 'active'
  and p.subscription_tier is distinct from (
      case when s.plan = 'supporter' then 'supporter' else 'premium' end
  );

-- Step B: set free for users with no active subscription
update public.profiles p
set
    subscription_tier = 'free',
    updated_at = timezone('utc', now())
where
    subscription_tier != 'free'
    and not exists (
        select 1 from public.subscriptions s
        where s.user_id = p.user_id
          and s.status = 'active'
    );

-- ============================================================
-- FIX 3: referral_invites.claim_count one-time repair
-- Problem: claim_count may have drifted from actual referral_claims count
-- Solution: recount from source of truth
-- ============================================================
update public.referral_invites ri
set
    claim_count = (
        select count(*)::integer
        from public.referral_claims rc
        where rc.code = ri.code
    ),
    updated_at = timezone('utc', now())
where
    claim_count is distinct from (
        select count(*)::integer
        from public.referral_claims rc
        where rc.code = ri.code
    );

-- ============================================================
-- FIX 4: referral_invites.claim_count auto-sync trigger
-- Problem: claim_count is a manual counter, can drift
-- Solution: trigger recounts from referral_claims on every change
-- ============================================================
create or replace function public.sync_referral_invite_claim_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text;
begin
    v_code := coalesce(NEW.code, OLD.code);

    update public.referral_invites
    set
        claim_count = (
            select count(*)::integer
            from public.referral_claims
            where code = v_code
        ),
        updated_at = timezone('utc', now())
    where code = v_code;

    return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists sync_referral_claim_count on public.referral_claims;
create trigger sync_referral_claim_count
after insert or delete on public.referral_claims
for each row
execute function public.sync_referral_invite_claim_count();

commit;
