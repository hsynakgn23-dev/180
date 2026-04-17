begin;

create or replace function public.sync_profile_subscription_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_tier_rank integer := 0;
  v_next_tier text := 'free';
begin
  if v_user_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(
    max(
      case
        when status = 'active' and plan = 'supporter' then 2
        when status = 'active' and plan in ('premium', 'monthly', 'annual') then 1
        else 0
      end
    ),
    0
  )
    into v_tier_rank
  from public.subscriptions
  where user_id = v_user_id;

  v_next_tier := case
    when v_tier_rank >= 2 then 'supporter'
    when v_tier_rank = 1 then 'premium'
    else 'free'
  end;

  update public.profiles
    set subscription_tier = v_next_tier,
        updated_at = timezone('utc'::text, now())
    where user_id = v_user_id
      and subscription_tier is distinct from v_next_tier;

  return coalesce(new, old);
end;
$$;

drop trigger if exists subscriptions_sync_profile_tier on public.subscriptions;

create trigger subscriptions_sync_profile_tier
after insert or update or delete on public.subscriptions
for each row
execute function public.sync_profile_subscription_tier();

with resolved_tiers as (
  select
    p.user_id,
    case
      when exists (
        select 1
        from public.subscriptions s
        where s.user_id = p.user_id
          and s.status = 'active'
          and s.plan = 'supporter'
      ) then 'supporter'
      when exists (
        select 1
        from public.subscriptions s
        where s.user_id = p.user_id
          and s.status = 'active'
          and s.plan in ('premium', 'monthly', 'annual')
      ) then 'premium'
      else 'free'
    end as next_tier
  from public.profiles p
)
update public.profiles p
set subscription_tier = resolved_tiers.next_tier,
    updated_at = timezone('utc'::text, now())
from resolved_tiers
where p.user_id = resolved_tiers.user_id
  and p.subscription_tier is distinct from resolved_tiers.next_tier;

commit;
