# Mobile Productization/UI Package 6.42 (Ritual Composer + Inbox + Arena Pulse)

## Summary
- Continued the mobile polish pass after package `6.41`.
- Reworked the remaining operational-feeling ritual composer and notification inbox surfaces into guided product cards.
- Added an explicit arena pulse layer so the `Explore` flow explains how daily activity feeds the weekly leaderboard.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_42.md`

## What Changed
- `apps/mobile/src/ui/appScreens.tsx`
  - upgrades `RitualDraftCard` with a lead surface, readiness/status strips, and stronger queue-submit messaging
  - upgrades `PushInboxCard` with lead metrics, clearer inbox state messaging, and a more productized list presentation
  - upgrades `ArenaChallengeCard` into a real explore-facing pulse surface
  - upgrades `PlatformRulesCard` so internal guidance follows the same hierarchy as the rest of the productized stack
- `apps/mobile/App.tsx`
  - mounts `ArenaChallengeCard` ahead of the weekly leaderboard in `Explore`
  - bumps the visible mobile package label to `6.42`

## Rationale
- The composer and inbox still read like internal tooling even though they are part of the core mobile loop.
- Arena needed a bridge layer between discovery and leaderboard so the user understands why daily ritual activity matters.
- Productization is more coherent when system guidance, empty states, and action blocks share the same rhythm across tabs.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx`
