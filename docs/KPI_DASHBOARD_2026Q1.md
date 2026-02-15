# KPI Dashboard (2026 Q1)

## Goal
Operationalize Growth Plan KPI framework with direct SQL views and repeatable dashboard queries.

## Source
- Events table: `public.analytics_events`
- KPI view migration: `sql/migrations/20260218_analytics_kpi_views.sql`

## North-Star
- Weekly active ritual creators:
```sql
select *
from public.analytics_northstar_weekly
order by week_start desc
limit 12;
```

## Funnel KPIs
- Daily KPI panel:
```sql
select *
from public.analytics_kpi_daily
order by day desc
limit 30;
```

Key columns:
- `visit_to_signup_pct`
- `signup_to_first_ritual_pct`
- `share_rate_per_active_pct`

## Retention
- D7 retention by signup cohort day:
```sql
select *
from public.analytics_d7_retention_daily
order by cohort_day desc
limit 30;
```

## Acquisition Split
- Signup by source/medium:
```sql
select
  coalesce(utm_source, 'direct') as source,
  coalesce(utm_medium, 'none') as medium,
  count(distinct user_id) as signups
from public.analytics_events
where event_name = 'signup_success'
group by 1, 2
order by signups desc
limit 25;
```

## Referral KPI Slice
- Invite accepted trend:
```sql
select
  date_trunc('day', event_time)::date as day,
  count(distinct user_id) filter (where event_name = 'invite_accepted') as invite_acceptors,
  count(*) filter (where event_name = 'invite_claim_failed') as invite_claim_failed_events
from public.analytics_events
group by 1
order by 1 desc
limit 30;
```

## Experiment Cadence Support
- Variant level conversion (requires variant data in `properties.variant` and test id in `properties.experiment_id`):
```sql
with base as (
  select
    date_trunc('day', event_time)::date as day,
    coalesce(properties->>'experiment_id', 'unknown') as experiment_id,
    coalesce(properties->>'variant', 'unknown') as variant,
    count(*) filter (where event_name = 'session_start') as sessions,
    count(distinct user_id) filter (where event_name = 'signup_success' and user_id is not null) as signups,
    count(distinct user_id) filter (where event_name = 'ritual_submitted' and user_id is not null) as ritual_creators
  from public.analytics_events
  where properties ? 'experiment_id'
  group by 1, 2, 3
)
select
  day,
  experiment_id,
  variant,
  sessions,
  signups,
  ritual_creators,
  case when sessions = 0 then 0 else round((signups::numeric / sessions) * 100, 2) end as signup_rate_pct,
  case when signups = 0 then 0 else round((ritual_creators::numeric / signups) * 100, 2) end as activation_rate_pct
from base
order by day desc, experiment_id, variant;
```

## Rollout Checklist
1. Run `sql/migrations/20260218_analytics_kpi_views.sql`.
2. Verify views:
```sql
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name in (
    'analytics_kpi_daily',
    'analytics_northstar_weekly',
    'analytics_d7_retention_daily'
  );
```
3. Pin 3 queries in Supabase SQL editor or BI tool of choice.
