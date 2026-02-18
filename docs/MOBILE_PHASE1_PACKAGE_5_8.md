# Mobile Phase-1 Package 5.8 (Profile Snapshot + Streak Tracking)

## Summary
- Added mobile profile snapshot flow backed by Supabase profile state.
- Added streak/ritual/day/follow counters to native app for signed-in sessions.
- Added fallback stat derivation from `rituals` timeline when `profiles.xp_state` is unavailable.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobileProfileStats.ts`
- `docs/MOBILE_PHASE1_PACKAGE_5_8.md`
- `README.md`

## Behavior
- New `Profile Snapshot` card is rendered in mobile app shell.
- For signed-in users:
  - reads `profiles.xp_state` and maps `totalXP`, `streak`, `dailyRituals`, `activeDays`.
  - reads follower/following counts from `user_follows`.
  - supports manual refresh via `Profili Yenile`.
- If profile state is missing/incompatible:
  - derives streak and activity from `rituals` timestamps as fallback.
- Successful ritual submit and successful queue flush now refresh profile snapshot automatically.

## Notes
- `page_view` analytics events are emitted for profile snapshot load/fail reasons.
- This package addresses Phase-1 MVP requirement for profile and streak tracking visibility on mobile.
