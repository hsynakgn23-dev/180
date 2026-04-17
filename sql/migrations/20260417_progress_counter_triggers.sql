begin;

create or replace function public.sync_referral_invite_claim_count(
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_claim_count integer;
begin
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
  if v_code = '' then
    return;
  end if;

  select count(*)::integer
    into v_claim_count
  from public.referral_claims rc
  where rc.code = v_code;

  update public.referral_invites ri
    set claim_count = coalesce(v_claim_count, 0),
        updated_at = case
          when coalesce(ri.claim_count, 0) is distinct from coalesce(v_claim_count, 0)
            then timezone('utc'::text, now())
          else ri.updated_at
        end
  where ri.code = v_code;
end;
$$;

create or replace function public.referral_claims_sync_claim_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_referral_invite_claim_count(old.code);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op <> 'UPDATE' or new.code is distinct from old.code then
      perform public.sync_referral_invite_claim_count(new.code);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists referral_claims_sync_claim_count on public.referral_claims;

create trigger referral_claims_sync_claim_count
after insert or update or delete on public.referral_claims
for each row
execute function public.referral_claims_sync_claim_count();

update public.referral_invites ri
set claim_count = counts.claim_count,
    updated_at = case
      when coalesce(ri.claim_count, 0) is distinct from counts.claim_count
        then timezone('utc'::text, now())
      else ri.updated_at
    end
from (
  select
    invites.code,
    count(claims.id)::integer as claim_count
  from public.referral_invites invites
  left join public.referral_claims claims
    on claims.code = invites.code
  group by invites.code
) counts
where counts.code = ri.code;

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

  select count(*)::integer
    into v_claim_count
  from public.referral_claims rc
  where rc.code = v_code;

  return query
    select v_code, v_inviter_user_id, 40, 24, coalesce(v_claim_count, 1);
end;
$$;

create or replace function public.sync_daily_quiz_progress(
  p_batch_date date,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answered_count integer;
  v_correct_count integer;
  v_last_answered_at timestamptz;
  v_completed_movie_ids integer[];
begin
  if p_batch_date is null or p_user_id is null then
    return;
  end if;

  select
    count(*)::integer,
    coalesce(sum(case when dqa.is_correct then 1 else 0 end), 0)::integer,
    max(dqa.answered_at)
    into v_answered_count, v_correct_count, v_last_answered_at
  from public.daily_quiz_attempts dqa
  where dqa.batch_date = p_batch_date
    and dqa.user_id = p_user_id;

  if coalesce(v_answered_count, 0) <= 0 then
    delete from public.daily_quiz_user_progress dqup
    where dqup.batch_date = p_batch_date
      and dqup.user_id = p_user_id;
    return;
  end if;

  select coalesce(array_agg(movie_progress.movie_id order by movie_progress.movie_id), '{}'::integer[])
    into v_completed_movie_ids
  from (
    select question_counts.movie_id
    from (
      select
        dmq.movie_id,
        count(*)::integer as question_count
      from public.daily_movie_questions dmq
      where dmq.batch_date = p_batch_date
      group by dmq.movie_id
    ) question_counts
    join (
      select
        dqa.movie_id,
        coalesce(sum(case when dqa.is_correct then 1 else 0 end), 0)::integer as correct_count
      from public.daily_quiz_attempts dqa
      where dqa.batch_date = p_batch_date
        and dqa.user_id = p_user_id
      group by dqa.movie_id
    ) attempt_counts
      on attempt_counts.movie_id = question_counts.movie_id
    where question_counts.question_count > 0
      and attempt_counts.correct_count >= least(
        question_counts.question_count,
        greatest(1, ceil(question_counts.question_count::numeric * 0.6)::integer)
      )
  ) movie_progress;

  insert into public.daily_quiz_user_progress (
    batch_date,
    user_id,
    answered_count,
    correct_count,
    completed_movie_ids,
    last_answered_at,
    updated_at
  )
  values (
    p_batch_date,
    p_user_id,
    coalesce(v_answered_count, 0),
    coalesce(v_correct_count, 0),
    coalesce(v_completed_movie_ids, '{}'::integer[]),
    coalesce(v_last_answered_at, timezone('utc'::text, now())),
    timezone('utc'::text, now())
  )
  on conflict (batch_date, user_id) do update
  set answered_count = excluded.answered_count,
      correct_count = excluded.correct_count,
      completed_movie_ids = excluded.completed_movie_ids,
      last_answered_at = excluded.last_answered_at,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.daily_quiz_attempts_sync_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_daily_quiz_progress(old.batch_date, old.user_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op <> 'UPDATE'
      or new.batch_date is distinct from old.batch_date
      or new.user_id is distinct from old.user_id then
      perform public.sync_daily_quiz_progress(new.batch_date, new.user_id);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists daily_quiz_attempts_sync_progress on public.daily_quiz_attempts;

create trigger daily_quiz_attempts_sync_progress
after insert or update or delete on public.daily_quiz_attempts
for each row
execute function public.daily_quiz_attempts_sync_progress();

do $$
declare
  v_progress_row record;
begin
  for v_progress_row in
    select distinct pairs.batch_date, pairs.user_id
    from (
      select dqa.batch_date, dqa.user_id
      from public.daily_quiz_attempts dqa
      union
      select dqup.batch_date, dqup.user_id
      from public.daily_quiz_user_progress dqup
    ) pairs
  loop
    perform public.sync_daily_quiz_progress(v_progress_row.batch_date, v_progress_row.user_id);
  end loop;
end
$$;

revoke all on function public.sync_referral_invite_claim_count(text) from public;
revoke all on function public.referral_claims_sync_claim_count() from public;
revoke all on function public.claim_referral_invite(text, uuid, text, text) from public;
revoke all on function public.sync_daily_quiz_progress(date, uuid) from public;
revoke all on function public.daily_quiz_attempts_sync_progress() from public;
grant execute on function public.claim_referral_invite(text, uuid, text, text) to service_role;

commit;
