-- Analytics KPI views (2026-02-18)
-- Aligns Growth Plan KPI framework with queryable Supabase views.

create or replace view public.analytics_kpi_daily as
with daily as (
  select
    date_trunc('day', event_time)::date as day,
    count(*) filter (where event_name = 'session_start') as sessions,
    count(distinct user_id) filter (where event_name = 'signup_success' and user_id is not null) as signups,
    count(distinct user_id) filter (where event_name = 'ritual_submitted' and user_id is not null) as ritual_creators,
    count(distinct user_id) filter (where event_name = 'share_opened' and user_id is not null) as sharers,
    count(distinct user_id) filter (where event_name = 'invite_accepted' and user_id is not null) as invite_acceptors
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
  end as share_rate_per_active_pct
from daily
order by day desc;

create or replace view public.analytics_northstar_weekly as
select
  date_trunc('week', event_time)::date as week_start,
  count(distinct user_id) filter (
    where event_name = 'ritual_submitted'
      and user_id is not null
  ) as weekly_active_ritual_creators
from public.analytics_events
group by 1
order by 1 desc;

create or replace view public.analytics_d7_retention_daily as
with signup_day as (
  select
    user_id,
    min(date_trunc('day', event_time)::date) as d0
  from public.analytics_events
  where event_name = 'signup_success'
    and user_id is not null
  group by user_id
),
return_day as (
  select distinct
    s.user_id,
    s.d0
  from signup_day s
  join public.analytics_events e on e.user_id = s.user_id
  where date_trunc('day', e.event_time)::date = s.d0 + interval '7 day'
    and e.event_name in ('page_view', 'ritual_submitted', 'share_opened', 'invite_accepted')
)
select
  s.d0 as cohort_day,
  count(*) as signup_users,
  count(r.user_id) as returned_d7_users,
  case
    when count(*) = 0 then 0
    else round((count(r.user_id)::numeric / count(*)) * 100, 2)
  end as d7_retention_pct
from signup_day s
left join return_day r
  on r.user_id = s.user_id
 and r.d0 = s.d0
group by s.d0
order by s.d0 desc;
