# Mobile Phase-0 Package 4.5 (Web-to-App Prompt KPIs)

## Summary
- Extended analytics KPI layer to include web-to-app prompt performance.
- Added reason-level prompt diagnostics for daily trend analysis.

## Changed Files
- `sql/migrations/20260219_web_to_app_prompt_kpis.sql`
- `docs/KPI_DASHBOARD_2026Q1.md`
- `docs/CHECKPOINT_2026-02-07.md`
- `README.md`

## KPI Additions
- `analytics_kpi_daily` now includes:
  - `prompt_views`
  - `prompt_clicks`
  - `prompt_dismissals`
  - `prompt_open_app_clicks`
  - `prompt_waitlist_clicks`
  - `prompt_ctr_pct`
  - `prompt_open_app_share_pct`
  - `prompt_dismiss_rate_pct`
- New view: `public.analytics_web_to_app_prompt_reason_daily`
  - splits prompt metrics by `properties.reason` (`streak_active`, `ritual_active`, `unknown`)

## Validation
- `npm run lint`
- `npm run build`
