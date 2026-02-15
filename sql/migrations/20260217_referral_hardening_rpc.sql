-- Referral hardening RPC (2026-02-17)
-- Adds device-level claim tracking and server-side settlement functions.

create table if not exists public.referral_device_claims (
  id bigserial primary key,
  device_key text not null,
  claim_date date not null default (timezone('utc'::text, now())::date),
  code text not null references public.referral_invites(code) on delete cascade,
  invitee_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (device_key, claim_date, code)
);

create index if not exists referral_device_claims_device_date_idx
  on public.referral_device_claims (device_key, claim_date);

create index if not exists referral_device_claims_invitee_idx
  on public.referral_device_claims (invitee_user_id, created_at desc);

alter table public.referral_device_claims enable row level security;

create or replace function public.get_or_create_referral_invite(
  p_inviter_user_id uuid,
  p_inviter_email text,
  p_seed text default null
)
returns table (
  code text,
  created boolean,
  claim_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_code text;
  v_existing_claim_count integer;
  v_seed text;
  v_suffix text;
  v_candidate text;
  i integer;
begin
  if p_inviter_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select ri.code, ri.claim_count
    into v_existing_code, v_existing_claim_count
  from public.referral_invites ri
  where ri.inviter_user_id = p_inviter_user_id
  limit 1;

  if found then
    update public.referral_invites
      set inviter_email = coalesce(nullif(trim(lower(p_inviter_email)), ''), inviter_email),
          updated_at = timezone('utc'::text, now())
      where inviter_user_id = p_inviter_user_id
        and inviter_email is distinct from coalesce(nullif(trim(lower(p_inviter_email)), ''), inviter_email);

    return query
      select v_existing_code, false, coalesce(v_existing_claim_count, 0);
    return;
  end if;

  v_seed := upper(regexp_replace(coalesce(p_seed, ''), '[^A-Z0-9]', '', 'g'));
  if length(v_seed) < 4 then
    v_seed := 'CINE';
  end if;

  for i in 1..10 loop
    v_suffix := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    v_candidate := left(v_seed || v_suffix, 8);
    if length(v_candidate) < 6 then
      v_candidate := rpad(v_candidate, 6, '7');
    end if;

    insert into public.referral_invites (code, inviter_user_id, inviter_email)
    values (
      v_candidate,
      p_inviter_user_id,
      coalesce(nullif(trim(lower(p_inviter_email)), ''), p_inviter_user_id::text || '@users.local')
    )
    on conflict do nothing
    returning referral_invites.code, referral_invites.claim_count
    into v_existing_code, v_existing_claim_count;

    if found then
      return query
        select v_existing_code, true, coalesce(v_existing_claim_count, 0);
      return;
    end if;

    select ri.code, ri.claim_count
      into v_existing_code, v_existing_claim_count
    from public.referral_invites ri
    where ri.inviter_user_id = p_inviter_user_id
    limit 1;

    if found then
      return query
        select v_existing_code, false, coalesce(v_existing_claim_count, 0);
      return;
    end if;
  end loop;

  raise exception 'SERVER_ERROR';
end;
$$;

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

  update public.referral_invites
    set claim_count = claim_count + 1,
        updated_at = timezone('utc'::text, now())
    where referral_invites.code = v_code
    returning referral_invites.claim_count
    into v_claim_count;

  return query
    select v_code, v_inviter_user_id, 40, 24, coalesce(v_claim_count, 1);
end;
$$;

revoke all on function public.get_or_create_referral_invite(uuid, text, text) from public;
revoke all on function public.claim_referral_invite(text, uuid, text, text) from public;

grant execute on function public.get_or_create_referral_invite(uuid, text, text) to service_role;
grant execute on function public.claim_referral_invite(text, uuid, text, text) to service_role;
