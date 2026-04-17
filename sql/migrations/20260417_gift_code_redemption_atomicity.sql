begin;

alter table public.gift_code_redemptions
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'fulfilled'));

alter table public.gift_code_redemptions
  add column if not exists fulfilled_at timestamp with time zone;

alter table public.gift_code_redemptions
  add column if not exists fulfillment_attempt_count integer not null default 0
    check (fulfillment_attempt_count >= 0);

alter table public.gift_code_redemptions
  add column if not exists last_error text;

update public.gift_code_redemptions
set status = 'fulfilled',
    fulfilled_at = coalesce(fulfilled_at, redeemed_at)
where status is distinct from 'fulfilled'
   or fulfilled_at is null;

create index if not exists gift_code_redemptions_status_redeemed_idx
  on public.gift_code_redemptions (status, redeemed_at desc);

create or replace function public.claim_gift_code_redemption(
  p_code text,
  p_user_id uuid
)
returns table (
  redemption_id uuid,
  code text,
  gift_type text,
  value integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_gift public.gift_codes%rowtype;
  v_redemption public.gift_code_redemptions%rowtype;
begin
  if p_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9-]', '', 'g'));
  if length(v_code) < 6 then
    raise exception 'INVALID_CODE';
  end if;

  select *
    into v_gift
  from public.gift_codes
  where gift_codes.code = v_code
  for update;

  if not found then
    raise exception 'CODE_NOT_FOUND';
  end if;

  if coalesce(v_gift.is_revoked, false) then
    raise exception 'CODE_REVOKED';
  end if;

  if v_gift.expires_at is not null and v_gift.expires_at < timezone('utc'::text, now()) then
    raise exception 'CODE_EXPIRED';
  end if;

  select *
    into v_redemption
  from public.gift_code_redemptions
  where gift_code_redemptions.code = v_code
    and gift_code_redemptions.user_id = p_user_id
  limit 1
  for update;

  if found then
    return query
      select
        v_redemption.id,
        v_redemption.code,
        v_redemption.gift_type,
        v_redemption.value,
        v_redemption.status;
    return;
  end if;

  if coalesce(v_gift.use_count, 0) >= coalesce(v_gift.max_uses, 1) then
    raise exception 'CODE_EXHAUSTED';
  end if;

  insert into public.gift_code_redemptions (
    code,
    user_id,
    gift_type,
    value,
    status,
    redeemed_at
  )
  values (
    v_code,
    p_user_id,
    v_gift.gift_type,
    v_gift.value,
    'pending',
    timezone('utc'::text, now())
  )
  returning *
  into v_redemption;

  update public.gift_codes
    set use_count = use_count + 1
  where id = v_gift.id;

  return query
    select
      v_redemption.id,
      v_redemption.code,
      v_redemption.gift_type,
      v_redemption.value,
      v_redemption.status;
end;
$$;

create or replace function public.mark_gift_code_redemption_fulfilled(
  p_redemption_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_redemption_id is null or p_user_id is null then
    raise exception 'INVALID_REDEMPTION';
  end if;

  update public.gift_code_redemptions
    set status = 'fulfilled',
        fulfilled_at = coalesce(fulfilled_at, timezone('utc'::text, now())),
        fulfillment_attempt_count = fulfillment_attempt_count + 1,
        last_error = null
  where id = p_redemption_id
    and user_id = p_user_id;

  if not found then
    raise exception 'INVALID_REDEMPTION';
  end if;
end;
$$;

create or replace function public.mark_gift_code_redemption_failed(
  p_redemption_id uuid,
  p_user_id uuid,
  p_last_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_redemption_id is null or p_user_id is null then
    raise exception 'INVALID_REDEMPTION';
  end if;

  update public.gift_code_redemptions
    set fulfillment_attempt_count = fulfillment_attempt_count + 1,
        last_error = nullif(left(trim(coalesce(p_last_error, '')), 500), '')
  where id = p_redemption_id
    and user_id = p_user_id
    and status = 'pending';

  if not found then
    return;
  end if;
end;
$$;

revoke all on function public.claim_gift_code_redemption(text, uuid) from public;
revoke all on function public.mark_gift_code_redemption_fulfilled(uuid, uuid) from public;
revoke all on function public.mark_gift_code_redemption_failed(uuid, uuid, text) from public;

grant execute on function public.claim_gift_code_redemption(text, uuid) to service_role;
grant execute on function public.mark_gift_code_redemption_fulfilled(uuid, uuid) to service_role;
grant execute on function public.mark_gift_code_redemption_failed(uuid, uuid, text) to service_role;

commit;
