create or replace function public.wallet_apply_mutation(
  p_action text,
  p_user_id uuid,
  p_email text default null,
  p_display_name text default null,
  p_is_premium boolean default false,
  p_item_key text default null,
  p_product_id text default null,
  p_provider text default null,
  p_transaction_ref text default null,
  p_purchase_date text default null,
  p_verification_kind text default null,
  p_purchase_token_hash text default null,
  p_transaction_id text default null
)
returns table (
  ok boolean,
  reason text,
  wallet jsonb,
  cost integer,
  granted integer,
  reels integer,
  bundle_granted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_today text := to_char(timezone('utc'::text, now()), 'YYYY-MM-DD');
  v_profile public.profiles%rowtype;
  v_xp_state jsonb := '{}'::jsonb;
  v_wallet jsonb := '{}'::jsonb;
  v_inventory jsonb := '{}'::jsonb;
  v_processed_topups jsonb := '[]'::jsonb;
  v_balance integer := 0;
  v_lifetime_earned integer := 0;
  v_lifetime_spent integer := 0;
  v_rewarded_claims_today integer := 0;
  v_rewarded_date text := null;
  v_last_rewarded_claim_at timestamptz := null;
  v_premium_starter_granted_at timestamptz := null;
  v_premium_starter_product_id text := null;
  v_inventory_joker_fifty_fifty integer := 0;
  v_inventory_joker_freeze integer := 0;
  v_inventory_joker_pass integer := 0;
  v_inventory_streak_shield integer := 0;
  v_cost integer := null;
  v_granted integer := null;
  v_reels integer := null;
  v_bundle_granted boolean := false;
  v_reason text := null;
  v_should_persist boolean := false;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_item_key text := trim(coalesce(p_item_key, ''));
  v_product_id text := trim(coalesce(p_product_id, ''));
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_transaction_ref text := trim(coalesce(p_transaction_ref, ''));
begin
  if p_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  insert into public.profiles (
    user_id,
    email,
    display_name,
    subscription_tier,
    xp_state,
    updated_at
  )
  values (
    p_user_id,
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_display_name, '')), ''),
    'free',
    jsonb_build_object(
      'wallet',
      jsonb_build_object(
        'balance', 0,
        'inventory', jsonb_build_object(
          'joker_fifty_fifty', 0,
          'joker_freeze', 0,
          'joker_pass', 0,
          'streak_shield', 0
        ),
        'lifetimeEarned', 0,
        'lifetimeSpent', 0,
        'rewardedClaimsToday', 0,
        'rewardedDate', null,
        'lastRewardedClaimAt', null,
        'premiumStarterGrantedAt', null,
        'premiumStarterProductId', null,
        'processedTopups', '[]'::jsonb
      )
    ),
    v_now
  )
  on conflict (user_id) do nothing;

  select *
    into v_profile
  from public.profiles
  where user_id = p_user_id
  for update;

  v_xp_state := coalesce(v_profile.xp_state::jsonb, '{}'::jsonb);
  v_wallet := coalesce(v_xp_state -> 'wallet', '{}'::jsonb);
  v_inventory := coalesce(v_wallet -> 'inventory', '{}'::jsonb);
  v_processed_topups := coalesce(v_wallet -> 'processedTopups', '[]'::jsonb);

  v_balance := greatest(coalesce((v_wallet ->> 'balance')::integer, 0), 0);
  v_lifetime_earned := greatest(coalesce((v_wallet ->> 'lifetimeEarned')::integer, 0), 0);
  v_lifetime_spent := greatest(coalesce((v_wallet ->> 'lifetimeSpent')::integer, 0), 0);
  v_rewarded_claims_today := greatest(coalesce((v_wallet ->> 'rewardedClaimsToday')::integer, 0), 0);
  v_rewarded_date := nullif(v_wallet ->> 'rewardedDate', '');
  v_premium_starter_product_id := nullif(v_wallet ->> 'premiumStarterProductId', '');
  v_inventory_joker_fifty_fifty := greatest(coalesce((v_inventory ->> 'joker_fifty_fifty')::integer, 0), 0);
  v_inventory_joker_freeze := greatest(coalesce((v_inventory ->> 'joker_freeze')::integer, 0), 0);
  v_inventory_joker_pass := greatest(coalesce((v_inventory ->> 'joker_pass')::integer, 0), 0);
  v_inventory_streak_shield := greatest(coalesce((v_inventory ->> 'streak_shield')::integer, 0), 0);

  begin
    v_last_rewarded_claim_at := nullif(v_wallet ->> 'lastRewardedClaimAt', '')::timestamptz;
  exception when others then
    v_last_rewarded_claim_at := null;
  end;

  begin
    v_premium_starter_granted_at := nullif(v_wallet ->> 'premiumStarterGrantedAt', '')::timestamptz;
  exception when others then
    v_premium_starter_granted_at := null;
  end;

  case v_action
    when 'grant_premium_starter' then
      if v_premium_starter_granted_at is not null then
        v_bundle_granted := false;
      else
        v_inventory_joker_fifty_fifty := v_inventory_joker_fifty_fifty + 2;
        v_inventory_joker_freeze := v_inventory_joker_freeze + 2;
        v_inventory_joker_pass := v_inventory_joker_pass + 1;
        v_premium_starter_granted_at := v_now;
        v_premium_starter_product_id := nullif(v_product_id, '');
        v_bundle_granted := true;
        v_should_persist := true;
      end if;

    when 'claim_rewarded' then
      if p_is_premium then
        v_reason := 'premium_blocked';
      else
        if v_rewarded_date is distinct from v_today then
          v_rewarded_claims_today := 0;
        end if;

        if v_rewarded_claims_today >= 3 then
          v_reason := 'daily_limit_reached';
        elsif v_last_rewarded_claim_at is not null
          and v_last_rewarded_claim_at + interval '10 minutes' > v_now then
          v_reason := 'cooldown_active';
        else
          v_balance := v_balance + 3;
          v_lifetime_earned := v_lifetime_earned + 3;
          v_rewarded_date := v_today;
          v_rewarded_claims_today := v_rewarded_claims_today + 1;
          v_last_rewarded_claim_at := v_now;
          v_granted := 3;
          v_should_persist := true;
        end if;
      end if;

    when 'spend_item' then
      case v_item_key
        when 'joker_fifty_fifty' then
          v_cost := 25;
          v_inventory_joker_fifty_fifty := v_inventory_joker_fifty_fifty + 1;
        when 'joker_freeze' then
          v_cost := 35;
          v_inventory_joker_freeze := v_inventory_joker_freeze + 1;
        when 'joker_pass' then
          v_cost := 35;
          v_inventory_joker_pass := v_inventory_joker_pass + 1;
        when 'streak_shield' then
          v_cost := 130;
          v_inventory_streak_shield := v_inventory_streak_shield + 1;
        else
          v_reason := 'invalid_item';
      end case;

      if v_reason is null then
        if v_balance < v_cost then
          v_reason := 'insufficient_balance';
        else
          v_balance := v_balance - v_cost;
          v_lifetime_spent := v_lifetime_spent + v_cost;
          v_should_persist := true;
        end if;
      end if;

    when 'consume_item' then
      case v_item_key
        when 'joker_fifty_fifty' then
          if v_inventory_joker_fifty_fifty <= 0 then
            v_reason := 'inventory_empty';
          else
            v_inventory_joker_fifty_fifty := v_inventory_joker_fifty_fifty - 1;
            v_should_persist := true;
          end if;
        when 'joker_freeze' then
          if v_inventory_joker_freeze <= 0 then
            v_reason := 'inventory_empty';
          else
            v_inventory_joker_freeze := v_inventory_joker_freeze - 1;
            v_should_persist := true;
          end if;
        when 'joker_pass' then
          if v_inventory_joker_pass <= 0 then
            v_reason := 'inventory_empty';
          else
            v_inventory_joker_pass := v_inventory_joker_pass - 1;
            v_should_persist := true;
          end if;
        when 'streak_shield' then
          if v_inventory_streak_shield <= 0 then
            v_reason := 'inventory_empty';
          else
            v_inventory_streak_shield := v_inventory_streak_shield - 1;
            v_should_persist := true;
          end if;
        else
          v_reason := 'invalid_item';
      end case;

    when 'grant_topup' then
      case v_product_id
        when 'com.absolutecinema.reel.80' then v_reels := 80;
        when 'com.absolutecinema.reel.200' then v_reels := 200;
        when 'com.absolutecinema.reel.550' then v_reels := 550;
        when 'com.absolutecinema.reel.1200' then v_reels := 1200;
        else v_reason := 'invalid_product';
      end case;

      if v_reason is null then
        if exists (
          select 1
          from jsonb_array_elements(v_processed_topups) as entry
          where coalesce(entry ->> 'ref', '') = v_transaction_ref
        ) then
          v_reason := 'duplicate_transaction';
        else
          v_balance := v_balance + coalesce(v_reels, 0);
          v_lifetime_earned := v_lifetime_earned + coalesce(v_reels, 0);
          v_processed_topups := v_processed_topups || jsonb_build_array(
            jsonb_build_object(
              'ref', v_transaction_ref,
              'provider', case when v_provider = 'google' then 'google' else 'apple' end,
              'productId', v_product_id,
              'grantedAt', v_now,
              'purchaseDate', nullif(trim(coalesce(p_purchase_date, '')), ''),
              'verificationKind', coalesce(nullif(trim(coalesce(p_verification_kind, '')), ''), 'store_payload'),
              'purchaseTokenHash', nullif(trim(coalesce(p_purchase_token_hash, '')), ''),
              'transactionId', nullif(trim(coalesce(p_transaction_id, '')), '')
            )
          );

          select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
            into v_processed_topups
          from (
            select value, ordinality
            from jsonb_array_elements(v_processed_topups) with ordinality
            where ordinality > greatest(jsonb_array_length(v_processed_topups) - 120, 0)
          ) as trimmed;

          v_should_persist := true;
        end if;
      end if;

    else
      v_reason := 'invalid_action';
  end case;

  v_wallet := jsonb_build_object(
    'balance', greatest(v_balance, 0),
    'inventory', jsonb_build_object(
      'joker_fifty_fifty', greatest(v_inventory_joker_fifty_fifty, 0),
      'joker_freeze', greatest(v_inventory_joker_freeze, 0),
      'joker_pass', greatest(v_inventory_joker_pass, 0),
      'streak_shield', greatest(v_inventory_streak_shield, 0)
    ),
    'lifetimeEarned', greatest(v_lifetime_earned, 0),
    'lifetimeSpent', greatest(v_lifetime_spent, 0),
    'rewardedClaimsToday', greatest(v_rewarded_claims_today, 0),
    'rewardedDate', to_jsonb(v_rewarded_date),
    'lastRewardedClaimAt', to_jsonb(v_last_rewarded_claim_at),
    'premiumStarterGrantedAt', to_jsonb(v_premium_starter_granted_at),
    'premiumStarterProductId', to_jsonb(v_premium_starter_product_id),
    'processedTopups', coalesce(v_processed_topups, '[]'::jsonb)
  );

  if v_should_persist then
    v_xp_state := v_xp_state || jsonb_build_object('wallet', v_wallet);

    update public.profiles
      set email = coalesce(nullif(trim(coalesce(v_profile.email, '')), ''), nullif(trim(coalesce(p_email, '')), ''), email),
          display_name = coalesce(nullif(trim(coalesce(v_profile.display_name, '')), ''), nullif(trim(coalesce(p_display_name, '')), ''), display_name),
          xp_state = v_xp_state,
          updated_at = v_now
      where user_id = p_user_id;
  end if;

  return query
    select
      coalesce(v_reason, '') = '' as ok,
      v_reason,
      v_wallet,
      v_cost,
      v_granted,
      v_reels,
      v_bundle_granted;
end;
$$;
