-- Mobile app-open analytics views (2026-02-20)
-- Depends on `public.analytics_events` (20260215_analytics_events.sql).

create or replace view public.analytics_mobile_open_daily as
with daily as (
  select
    date_trunc('day', event_time)::date as day,
    count(*) filter (where event_name = 'app_opened_from_invite') as app_opened_from_invite,
    count(*) filter (where event_name = 'app_opened_from_share') as app_opened_from_share
  from public.analytics_events
  group by 1
)
select
  day,
  app_opened_from_invite,
  app_opened_from_share,
  (app_opened_from_invite + app_opened_from_share) as app_opened_total,
  case
    when (app_opened_from_invite + app_opened_from_share) = 0 then 0
    else round((app_opened_from_invite::numeric / (app_opened_from_invite + app_opened_from_share)) * 100, 2)
  end as app_opened_invite_share_pct
from daily
order by day desc;
