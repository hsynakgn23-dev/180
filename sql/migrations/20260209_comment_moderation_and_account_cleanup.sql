-- Comment moderation + account cleanup hardening (2026-02-09)

create or replace function public.normalize_moderation_text(input_text text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(lower(coalesce(input_text, '')), 'ı', 'i'),
              'ğ', 'g'),
            'ş', 's'),
          'ç', 'c'),
        'ö', 'o'),
      'ü', 'u'),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.comment_contains_blocked_language(input_text text)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := public.normalize_moderation_text(input_text);
  if normalized = '' then
    return false;
  end if;

  if normalized ~ '(^|[^a-z0-9])(amk|aq|mk|oc|orospu|pic|siktir|sikik|sikerim|sikeyim|yarrak|gavat|ibne|got|gerizekali|salak|aptal|mal|fuck|fucking|shit|bitch|asshole|motherfucker|retard|slut|whore)([^a-z0-9]|$)' then
    return true;
  end if;

  if normalized like '%amina koyim%'
     or normalized like '%amina koyayim%'
     or normalized like '%anani sikeyim%'
     or normalized like '%ananin ami%'
     or normalized like '%orospu cocugu%'
     or normalized like '%siktir git%'
     or normalized like '%geri zekali%'
     or normalized like '%fuck you%'
     or normalized like '%go to hell%' then
    return true;
  end if;

  return false;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rituals_text_length_chk'
      and conrelid = 'public.rituals'::regclass
  ) then
    alter table public.rituals
      add constraint rituals_text_length_chk
      check (char_length(text) > 0 and char_length(text) <= 180) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rituals_text_moderation_chk'
      and conrelid = 'public.rituals'::regclass
  ) then
    alter table public.rituals
      add constraint rituals_text_moderation_chk
      check (not public.comment_contains_blocked_language(text)) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ritual_replies_text_moderation_chk'
      and conrelid = 'public.ritual_replies'::regclass
  ) then
    alter table public.ritual_replies
      add constraint ritual_replies_text_moderation_chk
      check (not public.comment_contains_blocked_language(text)) not valid;
  end if;
end $$;

do $$
declare
  delete_mode "char";
begin
  select c.confdeltype
  into delete_mode
  from pg_constraint c
  where c.conname = 'rituals_user_id_fkey'
    and c.conrelid = 'public.rituals'::regclass
  limit 1;

  if delete_mode is distinct from 'c' then
    if delete_mode is not null then
      alter table public.rituals drop constraint rituals_user_id_fkey;
    end if;

    alter table public.rituals
      add constraint rituals_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Clean up possible orphan rows left from previous ON DELETE SET NULL behavior.
delete from public.rituals
where user_id is null;

create or replace function public.auth_user_is_banned(target_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = auth, public
as $$
declare
  banned_until_at timestamp with time zone;
begin
  if target_user_id is null then
    return false;
  end if;

  select u.banned_until
  into banned_until_at
  from auth.users u
  where u.id = target_user_id;

  if banned_until_at is null then
    return false;
  end if;

  return banned_until_at > timezone('utc'::text, now());
end;
$$;

revoke all on function public.auth_user_is_banned(uuid) from public;
grant execute on function public.auth_user_is_banned(uuid) to authenticated;

drop policy if exists "Authenticated Rituals Insert" on public.rituals;
create policy "Authenticated Rituals Insert"
on public.rituals for insert
to authenticated
with check (auth.uid() = user_id and not public.auth_user_is_banned(auth.uid()));

drop policy if exists "Authenticated Ritual Echoes Insert Own" on public.ritual_echoes;
create policy "Authenticated Ritual Echoes Insert Own"
on public.ritual_echoes for insert
to authenticated
with check (auth.uid() = user_id and not public.auth_user_is_banned(auth.uid()));

drop policy if exists "Authenticated Ritual Replies Insert Own" on public.ritual_replies;
create policy "Authenticated Ritual Replies Insert Own"
on public.ritual_replies for insert
to authenticated
with check (auth.uid() = user_id and not public.auth_user_is_banned(auth.uid()));

create or replace function public.handle_banned_user_content_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.banned_until is not null
     and new.banned_until > timezone('utc'::text, now())
     and (old.banned_until is null or old.banned_until <= timezone('utc'::text, now())) then
    delete from public.ritual_echoes where user_id = new.id;
    delete from public.ritual_replies where user_id = new.id;
    delete from public.rituals where user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_banned_cleanup on auth.users;
create trigger on_auth_user_banned_cleanup
after update of banned_until on auth.users
for each row
execute function public.handle_banned_user_content_cleanup();

delete from public.ritual_echoes e
using auth.users u
where e.user_id = u.id
  and u.banned_until is not null
  and u.banned_until > timezone('utc'::text, now());

delete from public.ritual_replies r
using auth.users u
where r.user_id = u.id
  and u.banned_until is not null
  and u.banned_until > timezone('utc'::text, now());

delete from public.rituals rt
using auth.users u
where rt.user_id = u.id
  and u.banned_until is not null
  and u.banned_until > timezone('utc'::text, now());
