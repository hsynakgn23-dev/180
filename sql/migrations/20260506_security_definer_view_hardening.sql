-- Security Definer View Hardening (2026-05-06)
--
-- Fixes CRITICAL "Security Definer View" advisor warnings.
-- All views below referenced RLS-enabled tables but ran as the postgres
-- superuser, effectively bypassing row-level security.
--
-- Strategy per view:
--   Analytics views  → security_invoker = true + restrict to service_role only
--                      (client code never queries these; they are admin-only KPI views)
--   profiles_public  → security_invoker = true only (grants unchanged)
--                      The underlying profiles RLS policy already uses
--                      can_view_user_content(), same as the view's WHERE clause.
--                      Behavior is identical after this change.
--   profile_public_stats → security_invoker = true only
--                      Not used in client code; profiles RLS applies correctly.
--
-- NOT changed: question_pool_questions_public
--   This view is intentionally security-definer: direct SELECT on the base
--   table is revoked from authenticated/anon to hide correct_option and
--   explanation columns. security_invoker = true would break this proxy.

-- ─── 1. Analytics KPI Views ──────────────────────────────────────────────────
-- These are admin/dashboard views. Regular users should never query them.
-- Locking them to service_role + security_invoker removes the bypass entirely.

alter view public.analytics_kpi_daily             set (security_invoker = true);
alter view public.analytics_northstar_weekly       set (security_invoker = true);
alter view public.analytics_d7_retention_daily     set (security_invoker = true);
alter view public.analytics_funnel_daily           set (security_invoker = true);
alter view public.analytics_web_to_app_prompt_reason_daily set (security_invoker = true);

revoke select on public.analytics_kpi_daily                     from authenticated, anon;
revoke select on public.analytics_northstar_weekly               from authenticated, anon;
revoke select on public.analytics_d7_retention_daily             from authenticated, anon;
revoke select on public.analytics_funnel_daily                   from authenticated, anon;
revoke select on public.analytics_web_to_app_prompt_reason_daily from authenticated, anon;

grant select on public.analytics_kpi_daily                     to service_role;
grant select on public.analytics_northstar_weekly               to service_role;
grant select on public.analytics_d7_retention_daily             to service_role;
grant select on public.analytics_funnel_daily                   to service_role;
grant select on public.analytics_web_to_app_prompt_reason_daily to service_role;

-- ─── 2. profiles_public ──────────────────────────────────────────────────────
-- Used by mobile and web clients (authenticated role).
-- profiles table has RLS policy "Profiles Select Public":
--   using (public.can_view_user_content(user_id))  → for anon, authenticated
-- The view also WHERE-filters by can_view_user_content, so the net result
-- is identical — the same rows are returned before and after this change.

alter view public.profiles_public set (security_invoker = true);

-- ─── 3. profile_public_stats ─────────────────────────────────────────────────
-- Not referenced by client code. The profiles RLS policy applies correctly
-- once security_invoker is enabled. Only authenticated users have SELECT
-- (no change to grants).

alter view public.profile_public_stats set (security_invoker = true);
