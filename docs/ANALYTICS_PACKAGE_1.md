# Analytics Package 1 (UTM + Funnel Baseline)

## Scope
- Added client-side event tracking with first-touch and last-touch attribution.
- Added ingestion endpoint: `api/analytics.ts`.
- Added Supabase migration: `sql/migrations/20260215_analytics_events.sql`.
- Wired core funnel events:
  - session and page: `session_start`, `page_view`
  - auth: `auth_view`, `auth_submit`, `auth_failure`, `signup_success`, `signup_pending_confirmation`, `login_success`, `oauth_*`, `password_reset_*`
  - activation: `ritual_submitted`, `ritual_submit_failed`
  - sharing: `share_click`, `share_opened`, `share_failed`, `share_reward_claimed`, `share_reward_denied`

## Event Schema
Client event payload includes:
- `eventId`
- `eventName`
- `eventTime`
- `sessionId`
- `userId` (nullable)
- `pagePath`, `pageQuery`, `pageHash`
- `referrer`
- `properties` (custom JSON)
- `firstTouch`, `lastTouch` (source/medium/campaign/term/content/clickId + landing data)

## Environment
Client (optional):
- `VITE_ANALYTICS_ENABLED` (default enabled, set `0` to disable)
- `VITE_ANALYTICS_ENDPOINT` (default `/api/analytics`)

Server:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If server env vars are missing, ingest endpoint accepts requests but skips DB insertion.

## Dashboard Queries
Daily funnel (from materialized view-like plain view):
```sql
select * from public.analytics_funnel_daily order by day desc limit 30;
```

Visit -> Signup -> First Ritual conversion:
```sql
with daily as (
  select
    date_trunc('day', event_time)::date as day,
    count(*) filter (where event_name = 'session_start') as sessions,
    count(distinct user_id) filter (where event_name = 'signup_success') as signups,
    count(distinct user_id) filter (where event_name = 'ritual_submitted') as ritual_creators
  from public.analytics_events
  group by 1
)
select
  day,
  sessions,
  signups,
  ritual_creators,
  case when sessions = 0 then 0 else round((signups::numeric / sessions) * 100, 2) end as signup_rate_pct,
  case when signups = 0 then 0 else round((ritual_creators::numeric / signups) * 100, 2) end as first_ritual_rate_pct
from daily
order by day desc
limit 30;
```

Top acquisition channels by signup:
```sql
select
  coalesce(utm_source, 'direct') as source,
  coalesce(utm_medium, 'none') as medium,
  count(distinct user_id) as signups
from public.analytics_events
where event_name = 'signup_success'
group by 1, 2
order by signups desc
limit 20;
```

Day-7 retention proxy (users returning on day +7 with any key action):
```sql
with signup_day as (
  select user_id, min(date_trunc('day', event_time)::date) as d0
  from public.analytics_events
  where event_name = 'signup_success' and user_id is not null
  group by user_id
),
return_day as (
  select distinct e.user_id
  from public.analytics_events e
  join signup_day s on s.user_id = e.user_id
  where date_trunc('day', e.event_time)::date = s.d0 + interval '7 day'
    and e.event_name in ('page_view', 'ritual_submitted', 'share_opened')
)
select
  count(*) as signup_users,
  (select count(*) from return_day) as returned_d7_users,
  case
    when count(*) = 0 then 0
    else round(((select count(*) from return_day)::numeric / count(*)) * 100, 2)
  end as d7_retention_pct
from signup_day;
```
