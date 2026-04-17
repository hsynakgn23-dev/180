begin;

create or replace function public.sanitize_public_profile_xp_state(
  p_user_id uuid,
  p_xp_state jsonb
)
returns jsonb
language sql
stable
as $$
  with source as (
    select coalesce(p_xp_state, '{}'::jsonb) as xp
  ),
  privacy as (
    select
      xp,
      case lower(coalesce(xp #>> '{privacy,showStats}', xp #>> '{privacy,show_stats}', 'true'))
        when '0' then false
        when 'false' then false
        when 'no' then false
        when 'off' then false
        else true
      end as show_stats,
      case lower(coalesce(xp #>> '{privacy,showFollowCounts}', xp #>> '{privacy,show_follow_counts}', 'true'))
        when '0' then false
        when 'false' then false
        when 'no' then false
        when 'off' then false
        else true
      end as show_follow_counts,
      case lower(coalesce(xp #>> '{privacy,showMarks}', xp #>> '{privacy,show_marks}', 'true'))
        when '0' then false
        when 'false' then false
        when 'no' then false
        when 'off' then false
        else true
      end as show_marks,
      case lower(coalesce(xp #>> '{privacy,showActivity}', xp #>> '{privacy,show_activity}', 'true'))
        when '0' then false
        when 'false' then false
        when 'no' then false
        when 'off' then false
        else true
      end as show_activity
    from source
  ),
  fallback_metrics as (
    select
      xp,
      show_stats,
      show_follow_counts,
      show_marks,
      show_activity,
      public.profile_total_xp(xp) as total_xp,
      case when coalesce(xp ->> 'streak', '') ~ '^-?\d+$' then greatest((xp ->> 'streak')::integer, 0) else 0 end as streak_count,
      greatest(
        case when coalesce(xp ->> 'followers', '') ~ '^-?\d+$' then greatest((xp ->> 'followers')::integer, 0) else 0 end,
        case when coalesce(xp ->> 'followersCount', '') ~ '^-?\d+$' then greatest((xp ->> 'followersCount')::integer, 0) else 0 end,
        case when coalesce(xp ->> 'followerCount', '') ~ '^-?\d+$' then greatest((xp ->> 'followerCount')::integer, 0) else 0 end
      ) as fallback_followers_count,
      greatest(
        case when jsonb_typeof(xp -> 'following') = 'array' then jsonb_array_length(xp -> 'following') else 0 end,
        case when coalesce(xp ->> 'followingCount', '') ~ '^-?\d+$' then greatest((xp ->> 'followingCount')::integer, 0) else 0 end,
        case when coalesce(xp ->> 'following_count', '') ~ '^-?\d+$' then greatest((xp ->> 'following_count')::integer, 0) else 0 end
      ) as fallback_following_count,
      greatest(
        case when jsonb_typeof(xp -> 'activeDays') = 'array' then jsonb_array_length(xp -> 'activeDays') else 0 end,
        case when coalesce(xp ->> 'daysPresentCount', '') ~ '^-?\d+$' then greatest((xp ->> 'daysPresentCount')::integer, 0) else 0 end,
        case when coalesce(xp ->> 'activeDaysCount', '') ~ '^-?\d+$' then greatest((xp ->> 'activeDaysCount')::integer, 0) else 0 end
      ) as fallback_active_days_count,
      greatest(
        case when jsonb_typeof(xp -> 'dailyRituals') = 'array' then jsonb_array_length(xp -> 'dailyRituals') else 0 end,
        case when coalesce(xp ->> 'ritualCount', '') ~ '^-?\d+$' then greatest((xp ->> 'ritualCount')::integer, 0) else 0 end,
        case when coalesce(xp ->> 'ritualsCount', '') ~ '^-?\d+$' then greatest((xp ->> 'ritualsCount')::integer, 0) else 0 end
      ) as fallback_ritual_count,
      case
        when jsonb_typeof(xp -> 'weeklyArena') = 'object' then xp -> 'weeklyArena'
        else null
      end as weekly_arena,
      (
        select max(date_key)
        from (
          select nullif(trim(coalesce(value ->> 'date', '')), '') as date_key
          from jsonb_array_elements(
            case
              when jsonb_typeof(xp -> 'dailyRituals') = 'array' then xp -> 'dailyRituals'
              else '[]'::jsonb
            end
          )
          union all
          select nullif(trim(value), '') as date_key
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(xp -> 'activeDays') = 'array' then xp -> 'activeDays'
              else '[]'::jsonb
            end
          ) as value
        ) as public_dates
      ) as fallback_last_ritual_date,
      case
        when jsonb_typeof(xp -> 'marks') = 'array' then xp -> 'marks'
        when jsonb_typeof(xp -> 'markIds') = 'array' then xp -> 'markIds'
        when jsonb_typeof(xp -> 'mark_ids') = 'array' then xp -> 'mark_ids'
        when jsonb_typeof(xp -> 'unlockedMarks') = 'array' then xp -> 'unlockedMarks'
        when jsonb_typeof(xp -> 'unlocked_mark_ids') = 'array' then xp -> 'unlocked_mark_ids'
        when jsonb_typeof(xp -> 'badgeIds') = 'array' then xp -> 'badgeIds'
        when jsonb_typeof(xp -> 'badge_ids') = 'array' then xp -> 'badge_ids'
        when jsonb_typeof(xp -> 'badges') = 'array' then xp -> 'badges'
        else '[]'::jsonb
      end as public_marks,
      case
        when jsonb_typeof(xp -> 'featuredMarks') = 'array' then xp -> 'featuredMarks'
        when jsonb_typeof(xp -> 'featuredMarkIds') = 'array' then xp -> 'featuredMarkIds'
        when jsonb_typeof(xp -> 'featured_mark_ids') = 'array' then xp -> 'featured_mark_ids'
        when jsonb_typeof(xp -> 'featured_marks') = 'array' then xp -> 'featured_marks'
        else '[]'::jsonb
      end as featured_marks
    from privacy
  ),
  live_metrics as (
    select
      fallback_metrics.*,
      case
        when p_user_id is null then fallback_followers_count
        else coalesce((
          select count(*)::integer
          from public.user_follows uf
          where uf.followed_user_id = p_user_id
        ), 0)
      end as followers_count,
      case
        when p_user_id is null then fallback_following_count
        else coalesce((
          select count(*)::integer
          from public.user_follows uf
          where uf.follower_user_id = p_user_id
        ), 0)
      end as following_count,
      case
        when p_user_id is null then fallback_active_days_count
        else coalesce((
          select count(distinct to_char(timezone('Europe/Istanbul', coalesce(r.timestamp, r.created_at)), 'YYYY-MM-DD'))::integer
          from public.rituals r
          where r.user_id = p_user_id
            and coalesce(r.is_removed, false) = false
        ), 0)
      end as active_days_count,
      case
        when p_user_id is null then fallback_ritual_count
        else coalesce((
          select count(*)::integer
          from public.rituals r
          where r.user_id = p_user_id
            and coalesce(r.is_removed, false) = false
        ), 0)
      end as ritual_count,
      case
        when p_user_id is null then fallback_last_ritual_date
        else coalesce((
          select max(to_char(timezone('Europe/Istanbul', coalesce(r.timestamp, r.created_at)), 'YYYY-MM-DD'))
          from public.rituals r
          where r.user_id = p_user_id
            and coalesce(r.is_removed, false) = false
        ), fallback_last_ritual_date)
      end as last_ritual_date
    from fallback_metrics
  )
  select jsonb_strip_nulls(
    jsonb_build_object(
      'username', nullif(trim(coalesce(xp ->> 'username', '')), ''),
      'avatarId', nullif(trim(coalesce(xp ->> 'avatarId', '')), ''),
      'avatarUrl', nullif(trim(coalesce(xp ->> 'avatarUrl', xp ->> 'avatar_url', '')), ''),
      'avatar_url', nullif(trim(coalesce(xp ->> 'avatarUrl', xp ->> 'avatar_url', '')), ''),
      'privacy', jsonb_build_object(
        'showStats', show_stats,
        'show_stats', show_stats,
        'showFollowCounts', show_follow_counts,
        'show_follow_counts', show_follow_counts,
        'showMarks', show_marks,
        'show_marks', show_marks,
        'showActivity', show_activity,
        'show_activity', show_activity
      ),
      'totalXP', case when show_stats then total_xp else 0 end,
      'xp', case when show_stats then total_xp else 0 end,
      'streak', case when show_stats then streak_count else 0 end,
      'daysPresentCount', case when show_stats then active_days_count else 0 end,
      'activeDaysCount', case when show_stats then active_days_count else 0 end,
      'ritualCount', case when show_stats then ritual_count else 0 end,
      'ritualsCount', case when show_stats then ritual_count else 0 end,
      'weeklyArena', case when show_stats then weekly_arena else null end,
      'followersCount', case when show_follow_counts then followers_count else 0 end,
      'followerCount', case when show_follow_counts then followers_count else 0 end,
      'followingCount', case when show_follow_counts then following_count else 0 end,
      'following_count', case when show_follow_counts then following_count else 0 end,
      'marks', case when show_marks then public_marks else '[]'::jsonb end,
      'featuredMarks', case when show_marks then featured_marks else '[]'::jsonb end,
      'lastRitualDate', case when show_activity then last_ritual_date else null end,
      'last_ritual_date', case when show_activity then last_ritual_date else null end
    )
  )
  from live_metrics;
$$;

revoke all on function public.sanitize_public_profile_xp_state(uuid, jsonb) from public;
grant execute on function public.sanitize_public_profile_xp_state(uuid, jsonb) to anon, authenticated;

create or replace view public.profiles_public as
select
  p.user_id,
  p.display_name,
  public.profile_total_xp(p.xp_state) as total_xp,
  public.sanitize_public_profile_xp_state(p.user_id, p.xp_state) as xp_state
from public.profiles p
where public.can_view_user_content(p.user_id);

revoke all on public.profiles_public from public;
grant select on public.profiles_public to anon, authenticated;

commit;
