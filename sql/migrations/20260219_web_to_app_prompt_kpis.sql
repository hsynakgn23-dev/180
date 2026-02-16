-- Web-to-app prompt KPI extension (2026-02-19)
-- Requires `public.analytics_events` from 20260215_analytics_events.sql.

create or replace view public.analytics_kpi_daily as
with daily as (
  select
    date_trunc('day', event_time)::date as day,
    count(*) filter (where event_name = 'session_start') as sessions,
    count(distinct user_id) filter (where event_name = 'signup_success' and user_id is not null) as signups,
    count(distinct user_id) filter (where event_name = 'ritual_submitted' and user_id is not null) as ritual_creators,
    count(distinct user_id) filter (where event_name = 'share_opened' and user_id is not null) as sharers,
    count(distinct user_id) filter (where event_name = 'invite_accepted' and user_id is not null) as invite_acceptors,
    count(*) filter (where event_name = 'web_to_app_prompt_viewed') as prompt_views,
    count(*) filter (where event_name = 'web_to_app_prompt_clicked') as prompt_clicks,
    count(*) filter (where event_name = 'web_to_app_prompt_dismissed') as prompt_dismissals,
    count(*) filter (
      where event_name = 'web_to_app_prompt_clicked'
        and coalesce(properties->>'action', '') = 'open_app'
    ) as prompt_open_app_clicks,
    count(*) filter (
      where event_name = 'web_to_app_prompt_clicked'
        and coalesce(properties->>'action', '') = 'join_waitlist'
    ) as prompt_waitlist_clicks
  from public.analytics_events
  group by 1
)
select
  day,
  sessions,
  signups,
  ritual_creators,
  sharers,
  invite_acceptors,
  case
    when sessions = 0 then 0
    else round((signups::numeric / sessions) * 100, 2)
  end as visit_to_signup_pct,
  case
    when signups = 0 then 0
    else round((ritual_creators::numeric / signups) * 100, 2)
  end as signup_to_first_ritual_pct,
  case
    when ritual_creators = 0 then 0
    else round((sharers::numeric / ritual_creators) * 100, 2)
  end as share_rate_per_active_pct,
  prompt_views,
  prompt_clicks,
  prompt_dismissals,
  prompt_open_app_clicks,
  prompt_waitlist_clicks,
  case
    when prompt_views = 0 then 0
    else round((prompt_clicks::numeric / prompt_views) * 100, 2)
  end as prompt_ctr_pct,
  case
    when prompt_clicks = 0 then 0
    else round((prompt_open_app_clicks::numeric / prompt_clicks) * 100, 2)
  end as prompt_open_app_share_pct,
  case
    when prompt_views = 0 then 0
    else round((prompt_dismissals::numeric / prompt_views) * 100, 2)
  end as prompt_dismiss_rate_pct
from daily
order by day desc;

create or replace view public.analytics_web_to_app_prompt_reason_daily as
with daily as (
  select
    date_trunc('day', event_time)::date as day,
    coalesce(nullif(trim(properties->>'reason'), ''), 'unknown') as reason,
    count(*) filter (where event_name = 'web_to_app_prompt_viewed') as prompt_views,
    count(*) filter (where event_name = 'web_to_app_prompt_clicked') as prompt_clicks,
    count(*) filter (where event_name = 'web_to_app_prompt_dismissed') as prompt_dismissals,
    count(*) filter (
      where event_name = 'web_to_app_prompt_clicked'
        and coalesce(properties->>'action', '') = 'open_app'
    ) as prompt_open_app_clicks,
    count(*) filter (
      where event_name = 'web_to_app_prompt_clicked'
        and coalesce(properties->>'action', '') = 'join_waitlist'
    ) as prompt_waitlist_clicks
  from public.analytics_events
  where event_name in (
    'web_to_app_prompt_viewed',
    'web_to_app_prompt_clicked',
    'web_to_app_prompt_dismissed'
  )
  group by 1, 2
)
select
  day,
  reason,
  prompt_views,
  prompt_clicks,
  prompt_dismissals,
  prompt_open_app_clicks,
  prompt_waitlist_clicks,
  case
    when prompt_views = 0 then 0
    else round((prompt_clicks::numeric / prompt_views) * 100, 2)
  end as prompt_ctr_pct,
  case
    when prompt_views = 0 then 0
    else round((prompt_dismissals::numeric / prompt_views) * 100, 2)
  end as prompt_dismiss_rate_pct
from daily
order by day desc, reason;
