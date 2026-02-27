# Mobile Productization/UI Package 6.41 (Public Profile Detail + Explore Cards)

## Summary
- Continued the mobile polish pass after package `6.40`.
- Reworked the native public-profile detail summary into a clearer identity, metrics, and follow-action surface.
- Refreshed `Explore` route and arena cards so they behave more like guided product surfaces than plain utility cards.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_41.md`

## What Changed
- `apps/mobile/src/ui/appScreens.tsx`
  - upgrades `PublicProfileDetailCard` with stronger hierarchy, explicit follow-state messaging, and cleaner top actions
  - upgrades `DiscoverRoutesCard` with route readiness guidance and empty-state handling
  - upgrades `ArenaLeaderboardCard` with a lead section, clearer source messaging, loading/empty/error states, and explicit profile CTA buttons
- `apps/mobile/App.tsx`
  - bumps the visible mobile package label to `6.41`

## Rationale
- The remaining rough public/explore surfaces were still technically correct but visually underpowered.
- Public profile detail needed a better reading order for identity, follow state, and actions.
- Explore routes and arena leaderboard needed clearer readiness signals so users do not have to infer which paths are actionable.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx`
