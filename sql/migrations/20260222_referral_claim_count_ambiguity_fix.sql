-- Referral claim RPC hotfix (2026-02-22)
-- Fixes ambiguous output-parameter/column reference for claim_count in claim_referral_invite.

create or replace function public.claim_referral_invite(
  p_code text,
  p_invitee_user_id uuid,
  p_invitee_email text,
  p_device_key text
)
returns table (
  code text,
  inviter_user_id uuid,
  inviter_reward_xp integer,
  invitee_reward_xp integer,
  claim_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_device_key text;
  v_today date;
  v_inviter_user_id uuid;
  v_inviter_email text;
  v_claim_count integer;
  v_daily_claim_count integer;
begin
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
  v_device_key := left(regexp_replace(coalesce(p_device_key, ''), '[^a-zA-Z0-9:_-]', '', 'g'), 80);
  v_today := timezone('utc'::text, now())::date;

  if p_invitee_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if v_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'INVALID_CODE';
  end if;

  if length(v_device_key) < 8 then
    raise exception 'DEVICE_CODE_REUSE';
  end if;

  select ri.inviter_user_id, ri.inviter_email
    into v_inviter_user_id, v_inviter_email
  from public.referral_invites ri
  where ri.code = v_code
  for update;

  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if v_inviter_user_id = p_invitee_user_id then
    raise exception 'SELF_INVITE';
  end if;

  if trim(lower(coalesce(v_inviter_email, ''))) = trim(lower(coalesce(p_invitee_email, ''))) then
    raise exception 'SELF_INVITE';
  end if;

  if exists (
    select 1
    from public.referral_claims rc
    where rc.invitee_user_id = p_invitee_user_id
  ) then
    raise exception 'ALREADY_CLAIMED';
  end if;

  select count(*)
    into v_daily_claim_count
  from public.referral_device_claims rdc
  where rdc.device_key = v_device_key
    and rdc.claim_date = v_today;

  if coalesce(v_daily_claim_count, 0) >= 3 then
    raise exception 'DEVICE_DAILY_LIMIT';
  end if;

  if exists (
    select 1
    from public.referral_device_claims rdc
    where rdc.device_key = v_device_key
      and rdc.claim_date = v_today
      and rdc.code = v_code
  ) then
    raise exception 'DEVICE_CODE_REUSE';
  end if;

  insert into public.referral_claims (
    code,
    invitee_user_id,
    invitee_email,
    inviter_reward_xp,
    invitee_reward_xp
  )
  values (
    v_code,
    p_invitee_user_id,
    coalesce(nullif(trim(lower(p_invitee_email)), ''), p_invitee_user_id::text || '@users.local'),
    40,
    24
  );

  insert into public.referral_device_claims (
    device_key,
    claim_date,
    code,
    invitee_user_id
  )
  values (
    v_device_key,
    v_today,
    v_code,
    p_invitee_user_id
  );

  update public.referral_invites ri
    set claim_count = ri.claim_count + 1,
        updated_at = timezone('utc'::text, now())
    where ri.code = v_code
    returning ri.claim_count
    into v_claim_count;

  return query
    select v_code, v_inviter_user_id, 40, 24, coalesce(v_claim_count, 1);
end;
$$;

grant execute on function public.claim_referral_invite(text, uuid, text, text) to service_role;
