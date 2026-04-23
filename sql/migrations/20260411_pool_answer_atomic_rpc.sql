-- Make pool answers duplicate-safe and atomic.
-- The answer insert, per-movie progress update, and quiz XP grant now happen
-- inside a single security-definer RPC so concurrent retries cannot double-pay.

create or replace function public.record_pool_answer(
  p_user_id uuid,
  p_question_id uuid,
  p_movie_id uuid,
  p_is_correct boolean,
  p_correct_xp integer default 10,
  p_perfect_bonus_xp integer default 25,
  p_email text default null,
  p_display_name text default null
)
returns table (
  duplicate boolean,
  recorded_is_correct boolean,
  questions_answered integer,
  correct_count integer,
  total_questions integer,
  completed boolean,
  is_perfect boolean,
  xp_earned integer,
  bonus_xp integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_total_questions integer := 0;
  v_progress public.movie_pool_user_progress%rowtype;
  v_questions_answered integer := 0;
  v_correct_count integer := 0;
  v_completed boolean := false;
  v_is_perfect boolean := false;
  v_recorded_is_correct boolean := coalesce(p_is_correct, false);
  v_answer_xp integer := case when coalesce(p_is_correct, false) then greatest(coalesce(p_correct_xp, 0), 0) else 0 end;
  v_bonus_xp integer := 0;
  v_awarded_xp integer := 0;
  v_profile public.profiles%rowtype;
  v_xp_state jsonb := '{}'::jsonb;
  v_wallet jsonb := '{}'::jsonb;
  v_current_total_xp integer := 0;
  v_next_total_xp integer := 0;
  v_week_key text := to_char(timezone('Europe/Istanbul', v_now), 'IYYY-"W"IW');
  v_weekly_arena jsonb := '{}'::jsonb;
  v_weekly_cohort text := null;
  v_weekly_score integer := 0;
  v_weekly_activity integer := 0;
  v_weekly_comment_rewards integer := 0;
  v_weekly_quiz_rewards integer := 0;
begin
  if p_user_id is null or p_question_id is null or p_movie_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  select greatest(count(*), 5)
    into v_total_questions
  from public.question_pool_questions
  where movie_id = p_movie_id;

  begin
    insert into public.movie_pool_answers (
      user_id,
      question_id,
      movie_id,
      is_correct
    )
    values (
      p_user_id,
      p_question_id,
      p_movie_id,
      coalesce(p_is_correct, false)
    );
  exception
    when unique_violation then
      select is_correct
        into v_recorded_is_correct
      from public.movie_pool_answers
      where user_id = p_user_id
        and question_id = p_question_id
      limit 1;

      select *
        into v_progress
      from public.movie_pool_user_progress
      where user_id = p_user_id
        and movie_id = p_movie_id;

      return query
      select
        true as duplicate,
        coalesce(v_recorded_is_correct, false) as recorded_is_correct,
        coalesce(v_progress.questions_answered, 0)::integer as questions_answered,
        coalesce(v_progress.correct_count, 0)::integer as correct_count,
        v_total_questions,
        coalesce(v_progress.completed, false) as completed,
        false as is_perfect,
        0::integer as xp_earned,
        0::integer as bonus_xp;
      return;
  end;

  select *
    into v_progress
  from public.movie_pool_user_progress
  where user_id = p_user_id
    and movie_id = p_movie_id
  for update;

  if not found then
    insert into public.movie_pool_user_progress (
      user_id,
      movie_id,
      questions_answered,
      correct_count,
      xp_earned,
      completed
    )
    values (
      p_user_id,
      p_movie_id,
      0,
      0,
      0,
      false
    )
    on conflict (user_id, movie_id) do nothing;

    select *
      into v_progress
    from public.movie_pool_user_progress
    where user_id = p_user_id
      and movie_id = p_movie_id
    for update;
  end if;

  v_questions_answered := coalesce(v_progress.questions_answered, 0) + 1;
  v_correct_count := coalesce(v_progress.correct_count, 0) + case when coalesce(p_is_correct, false) then 1 else 0 end;
  v_completed := v_questions_answered >= v_total_questions;
  v_is_perfect := v_completed and v_correct_count = v_total_questions;
  v_bonus_xp := case when v_is_perfect then greatest(coalesce(p_perfect_bonus_xp, 0), 0) else 0 end;
  v_awarded_xp := v_answer_xp + v_bonus_xp;

  update public.movie_pool_user_progress
    set questions_answered = v_questions_answered,
        correct_count = v_correct_count,
        xp_earned = coalesce(v_progress.xp_earned, 0) + v_awarded_xp,
        completed = v_completed,
        updated_at = v_now
  where id = v_progress.id;

  if v_awarded_xp > 0 then
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

    v_xp_state := coalesce(v_profile.xp_state, '{}'::jsonb);
    v_wallet := coalesce(v_xp_state -> 'wallet', '{}'::jsonb);

    v_current_total_xp := greatest(
      case when coalesce(v_xp_state ->> 'totalXP', '') ~ '^-?\d+$' then greatest((v_xp_state ->> 'totalXP')::integer, 0) else 0 end,
      case when coalesce(v_xp_state ->> 'xp', '') ~ '^-?\d+$' then greatest((v_xp_state ->> 'xp')::integer, 0) else 0 end
    );
    v_next_total_xp := v_current_total_xp + v_awarded_xp;

    if jsonb_typeof(v_xp_state -> 'weeklyArena') = 'object' then
      v_weekly_arena := v_xp_state -> 'weeklyArena';
    else
      v_weekly_arena := '{}'::jsonb;
    end if;

    if coalesce(v_weekly_arena ->> 'weekKey', '') <> v_week_key then
      v_weekly_arena := '{}'::jsonb;
    end if;

    v_weekly_cohort := nullif(trim(coalesce(v_weekly_arena ->> 'cohortLeagueKey', '')), '');
    v_weekly_score := case when coalesce(v_weekly_arena ->> 'score', '') ~ '^-?\d+$' then greatest((v_weekly_arena ->> 'score')::integer, 0) else 0 end;
    v_weekly_activity := case when coalesce(v_weekly_arena ->> 'activityCount', '') ~ '^-?\d+$' then greatest((v_weekly_arena ->> 'activityCount')::integer, 0) else 0 end;
    v_weekly_comment_rewards := case when coalesce(v_weekly_arena ->> 'commentRewards', '') ~ '^-?\d+$' then greatest((v_weekly_arena ->> 'commentRewards')::integer, 0) else 0 end;
    v_weekly_quiz_rewards := case when coalesce(v_weekly_arena ->> 'quizRewards', '') ~ '^-?\d+$' then greatest((v_weekly_arena ->> 'quizRewards')::integer, 0) else 0 end;

    v_xp_state := jsonb_set(v_xp_state, '{totalXP}', to_jsonb(v_next_total_xp), true);
    v_xp_state := jsonb_set(v_xp_state, '{xp}', to_jsonb(v_next_total_xp), true);
    v_xp_state := jsonb_set(
      v_xp_state,
      '{weeklyArena}',
      jsonb_build_object(
        'weekKey', v_week_key,
        'cohortLeagueKey', to_jsonb(v_weekly_cohort),
        'score', v_weekly_score,
        'activityCount', v_weekly_activity,
        'commentRewards', v_weekly_comment_rewards,
        'quizRewards', v_weekly_quiz_rewards + 1,
        'updatedAt', v_now
      ),
      true
    );

    if jsonb_typeof(v_wallet) = 'object' then
      v_xp_state := jsonb_set(v_xp_state, '{wallet}', v_wallet, true);
    end if;

    update public.profiles
      set email = coalesce(nullif(trim(coalesce(v_profile.email, '')), ''), nullif(trim(coalesce(p_email, '')), ''), email),
          display_name = coalesce(nullif(trim(coalesce(v_profile.display_name, '')), ''), nullif(trim(coalesce(p_display_name, '')), ''), display_name),
          xp_state = v_xp_state,
          updated_at = v_now
    where user_id = p_user_id;
  end if;

  return query
  select
    false as duplicate,
    coalesce(p_is_correct, false) as recorded_is_correct,
    v_questions_answered,
    v_correct_count,
    v_total_questions,
    v_completed,
    v_is_perfect,
    v_awarded_xp,
    v_bonus_xp;
end;
$$;

revoke all on function public.record_pool_answer(uuid, uuid, uuid, boolean, integer, integer, text, text) from public;
grant execute on function public.record_pool_answer(uuid, uuid, uuid, boolean, integer, integer, text, text) to authenticated;
grant execute on function public.record_pool_answer(uuid, uuid, uuid, boolean, integer, integer, text, text) to service_role;
