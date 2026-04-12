begin;

with ranked_attempts as (
  select
    ctid,
    row_number() over (
      partition by session_id, question_id
      order by answered_at asc nulls last, ctid asc
    ) as row_num
  from public.quiz_rush_attempts
),
duplicate_attempts as (
  delete from public.quiz_rush_attempts target
  using ranked_attempts ranked
  where target.ctid = ranked.ctid
    and ranked.row_num > 1
  returning target.session_id
),
session_totals as (
  select
    sessions.id as session_id,
    coalesce(sum(case when attempts.is_correct then 1 else 0 end), 0)::integer as correct_count,
    coalesce(sum(case when attempts.is_correct then 0 else 1 end), 0)::integer as wrong_count
  from public.quiz_rush_sessions sessions
  left join public.quiz_rush_attempts attempts
    on attempts.session_id = sessions.id
  group by sessions.id
)
update public.quiz_rush_sessions sessions
set
  correct_count = totals.correct_count,
  wrong_count = totals.wrong_count
from session_totals totals
where sessions.id = totals.session_id
  and (
    coalesce(sessions.correct_count, 0) is distinct from totals.correct_count
    or coalesce(sessions.wrong_count, 0) is distinct from totals.wrong_count
  );

create unique index if not exists quiz_rush_attempts_session_question_uidx
  on public.quiz_rush_attempts (session_id, question_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.quiz_rush_attempts'::regclass
      and conname = 'quiz_rush_attempts_session_question_key'
  ) then
    alter table public.quiz_rush_attempts
      add constraint quiz_rush_attempts_session_question_key
      unique using index quiz_rush_attempts_session_question_uidx;
  end if;
end
$$;

commit;
