-- Growth analytics baseline (2026-02-15)
-- Stores web funnel events with acquisition context (UTM + referrer).

create table if not exists public.analytics_events (
  event_id text primary key,
  event_name text not null,
  event_time timestamptz not null default timezone('utc'::text, now()),
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  page_path text,
  page_query text,
  page_hash text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  click_id text,
  properties jsonb not null default '{}'::jsonb,
  first_touch jsonb,
  last_touch jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists analytics_events_event_time_idx
  on public.analytics_events (event_time desc);

create index if not exists analytics_events_event_name_time_idx
  on public.analytics_events (event_name, event_time desc);

create index if not exists analytics_events_user_time_idx
  on public.analytics_events (user_id, event_time desc)
  where user_id is not null;

create index if not exists analytics_events_campaign_time_idx
  on public.analytics_events (utm_campaign, event_time desc)
  where utm_campaign is not null;

alter table public.analytics_events enable row level security;

create or replace view public.analytics_funnel_daily as
select
  date_trunc('day', event_time)::date as day,
  count(*) filter (where event_name = 'session_start') as sessions,
  count(distinct user_id) filter (where event_name = 'signup_success') as signups,
  count(distinct user_id) filter (where event_name = 'ritual_submitted') as ritual_creators,
  count(distinct user_id) filter (where event_name = 'share_opened') as sharers
from public.analytics_events
group by 1
order by 1 desc;
