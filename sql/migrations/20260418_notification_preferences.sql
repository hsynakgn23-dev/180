-- Migration: notification preferences
--
-- Adds push_prefs JSONB column to user_settings so users can opt out of
-- individual push notification categories (comment, like, follow, daily_drop,
-- arena, streak).
--
-- Shape: { "comment": true, "like": false, ... }
-- Absent key = enabled (default). false = disabled.
--
-- Safe to re-run: guarded by IF NOT EXISTS.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS push_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_settings.push_prefs IS
  'Per-category push notification opt-out. Keys: comment, like, follow, daily_drop, arena, streak. false = disabled, absent/true = enabled.';
