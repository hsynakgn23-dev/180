-- Paket 8: Push notification dispatch support
--
-- 1. Expands notification_events.kind CHECK to include 'arena' and
--    'streak_milestone' (arena-finalize already writes these).
-- 2. Adds push_sent_at column — set by push-dispatch cron after delivery.
-- 3. Adds a partial index for the dispatch query (only undelivered rows).
--
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS guards.

-- ── 1. Expand the kind CHECK constraint ─────────────────────────────────────
-- PostgreSQL requires DROP + ADD to modify a CHECK constraint.
-- The original inline constraint is named notification_events_kind_check.

alter table public.notification_events
  drop constraint if exists notification_events_kind_check;

alter table public.notification_events
  add constraint notification_events_kind_check
  check (kind in (
    'comment',
    'like',
    'follow',
    'daily_drop',
    'streak',
    'streak_milestone',
    'arena',
    'generic'
  ));

-- ── 2. Add push_sent_at column ───────────────────────────────────────────────
alter table public.notification_events
  add column if not exists push_sent_at timestamptz;

-- ── 3. Partial index for dispatch query ─────────────────────────────────────
-- Only covers rows where push_sent_at IS NULL — keeps the index small and
-- allows the cron to find pending rows without a full table scan.
create index if not exists notification_events_pending_push_idx
  on public.notification_events (created_at desc)
  where push_sent_at is null;
