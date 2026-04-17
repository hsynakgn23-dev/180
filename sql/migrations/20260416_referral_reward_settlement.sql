-- Track referral reward settlement state so retries can resume safely.

alter table public.referral_claims
  add column if not exists inviter_reward_applied_at timestamptz,
  add column if not exists invitee_reward_applied_at timestamptz;

create index if not exists referral_claims_unsettled_idx
  on public.referral_claims (created_at desc)
  where inviter_reward_applied_at is null
     or invitee_reward_applied_at is null;
