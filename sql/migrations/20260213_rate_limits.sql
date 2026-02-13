-- Rate limiting migration (2026-02-13)
-- Protects rituals, replies, and echoes against abuse bursts.

create or replace function public.enforce_ritual_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc'::text, now());
  window_start timestamptz := now_utc - interval '10 minutes';
  day_start timestamptz := date_trunc('day', now_utc);
  recent_count integer;
  daily_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*) into recent_count
  from public.rituals
  where user_id = new.user_id
    and "timestamp" >= window_start;

  if recent_count >= 6 then
    raise exception 'Rate limit exceeded: max 6 rituals per 10 minutes.'
      using errcode = 'P0001';
  end if;

  select count(*) into daily_count
  from public.rituals
  where user_id = new.user_id
    and "timestamp" >= day_start;

  if daily_count >= 30 then
    raise exception 'Rate limit exceeded: max 30 rituals per day.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_ritual_reply_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc'::text, now());
  window_start timestamptz := now_utc - interval '10 minutes';
  recent_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*) into recent_count
  from public.ritual_replies
  where user_id = new.user_id
    and created_at >= window_start;

  if recent_count >= 20 then
    raise exception 'Rate limit exceeded: max 20 replies per 10 minutes.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_ritual_echo_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc'::text, now());
  window_start timestamptz := now_utc - interval '10 minutes';
  recent_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*) into recent_count
  from public.ritual_echoes
  where user_id = new.user_id
    and created_at >= window_start;

  if recent_count >= 60 then
    raise exception 'Rate limit exceeded: max 60 echoes per 10 minutes.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists rituals_rate_limit_insert on public.rituals;
create trigger rituals_rate_limit_insert
before insert on public.rituals
for each row execute function public.enforce_ritual_insert_rate_limit();

drop trigger if exists ritual_replies_rate_limit_insert on public.ritual_replies;
create trigger ritual_replies_rate_limit_insert
before insert on public.ritual_replies
for each row execute function public.enforce_ritual_reply_insert_rate_limit();

drop trigger if exists ritual_echoes_rate_limit_insert on public.ritual_echoes;
create trigger ritual_echoes_rate_limit_insert
before insert on public.ritual_echoes
for each row execute function public.enforce_ritual_echo_insert_rate_limit();
