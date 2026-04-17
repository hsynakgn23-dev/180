-- RLS Hardening Audit Fixes (2026-04-17)
-- This migration addresses 5 critical security/access gaps found in RLS audit:
-- 1. analytics_events — missing policies (table inaccessible)
-- 2. question_pool_questions — answer key exposed to clients via blanket SELECT
-- 3. wallet_topup_grants — users can't read their own topup history
-- 4. pool_crawl_state — RLS enabled but no policies (admin-only table)
-- 5. referral tables — missing RLS policies

begin;

-- ============================================================
-- FIX 1: analytics_events — Add RLS policies
-- ============================================================
-- Problem: Table has RLS enabled but zero policies, making it inaccessible
-- Solution: Allow service role to INSERT (server-side logging), authenticated users to SELECT their own

drop policy if exists "Analytics Events Service Insert" on public.analytics_events;
create policy "Analytics Events Service Insert"
on public.analytics_events for insert
to service_role
with check (true);

drop policy if exists "Analytics Events Authenticated Select Own" on public.analytics_events;
create policy "Analytics Events Authenticated Select Own"
on public.analytics_events for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- FIX 2: question_pool_questions — Restrict answer key from clients
-- ============================================================
-- Problem: Blanket SELECT policy exposes correct_option and explanation to authenticated/anon users
-- Solution: Create a view excluding sensitive columns, grant SELECT on view, revoke direct table access

drop view if exists public.question_pool_questions_public cascade;
create view public.question_pool_questions_public as
select
  id,
  movie_id,
  tmdb_movie_id,
  question_order,
  question_key,
  question_translations,
  options_translations,
  difficulty,
  source,
  source_daily_date,
  metadata,
  created_at
from public.question_pool_questions;

-- Grant SELECT on the safe view to authenticated and anonymous users
grant select on public.question_pool_questions_public to authenticated, anon;

-- Revoke direct table SELECT from authenticated and anon (service role bypasses RLS)
revoke select on public.question_pool_questions from authenticated, anon;

-- Drop the old blanket public read policy (if it exists from previous migration)
drop policy if exists "Pool Questions Public Read" on public.question_pool_questions;

-- Also drop the authenticated read policy that exposed the full table
drop policy if exists "Pool Questions Authenticated Read" on public.question_pool_questions;

-- ============================================================
-- FIX 3: wallet_topup_grants — Add RLS policies for user access
-- ============================================================
-- Problem: No RLS policies; users can't read their own topup history
-- Solution: Allow authenticated users to SELECT their own rows; service role only for INSERT/UPDATE/DELETE

drop policy if exists "Wallet Topup Grants Select Own" on public.wallet_topup_grants;
create policy "Wallet Topup Grants Select Own"
on public.wallet_topup_grants for select
to authenticated
using (auth.uid() = user_id);

-- Service role handles INSERT/UPDATE/DELETE via wallet_apply_mutation function, authenticated users cannot

-- ============================================================
-- FIX 4: pool_crawl_state — Restrict to service role only
-- ============================================================
-- Problem: RLS enabled but no policies; admin/service-only table with no access controls
-- Solution: Create a deny-all policy; service role bypasses RLS entirely

drop policy if exists "Pool Crawl State Service Only" on public.pool_crawl_state;
create policy "Pool Crawl State Service Only"
on public.pool_crawl_state for all
using (false);

-- ============================================================
-- FIX 5: referral tables — Add RLS policies
-- ============================================================

-- 5a. referral_invites: authenticated users can SELECT their own invite (inviter_user_id = auth.uid())
drop policy if exists "Referral Invites Select Own" on public.referral_invites;
create policy "Referral Invites Select Own"
on public.referral_invites for select
to authenticated
using (auth.uid() = inviter_user_id);

-- 5b. referral_claims: authenticated users can SELECT claims where they are invitee
drop policy if exists "Referral Claims Select Own as Invitee" on public.referral_claims;
create policy "Referral Claims Select Own as Invitee"
on public.referral_claims for select
to authenticated
using (auth.uid() = invitee_user_id);

-- 5c. referral_device_claims: service role only (fraud prevention data not readable by clients)
drop policy if exists "Referral Device Claims Service Only" on public.referral_device_claims;
create policy "Referral Device Claims Service Only"
on public.referral_device_claims for all
using (false);

commit;
