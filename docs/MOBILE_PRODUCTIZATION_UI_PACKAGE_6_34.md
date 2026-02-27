# Mobile Productization/UI Package 6.34 (Explore + Profile Hierarchy Refresh)

## Summary
- Started the first design polish pass focused on clarity instead of new parity surface area.
- Restructured the `Explore` and `Profile` tabs around clearer lead cards, faster actions, and stronger section hierarchy.
- Turned the bottom navigation into a more legible labeled tab bar.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_34.md`

## What Changed
- `apps/mobile/src/ui/appScreens.tsx`
  - makes `ScreenCard` actually render its `accent` bar, so section tone is visible
  - adds `SectionLeadCard` for title, body, badges, stats, and quick actions
- `apps/mobile/App.tsx`
  - enables visible tab labels in the bottom nav
  - removes the redundant Arena summary card from `Explore`
  - adds a guided `Explore` lead card with quick actions and clearer section ordering
  - replaces the overloaded first `Profile` cards with clearer lead cards for both own profile and public profile states
  - adds quick actions for settings, share hub, refresh, follow, and return flows
  - bumps the visible mobile package label to `6.34`
- `apps/mobile/src/ui/appStyles.ts`
  - expands the lead-card visual system
  - adjusts tab bar sizing for icon + label readability

## Rationale
- The app felt flat because too many sections shared the same card weight and text rhythm.
- Users had to read through stacked blocks to infer where to act.
- This package starts correcting that by introducing:
  - stronger first-glance hierarchy
  - clearer top-of-screen direction
  - visible action clusters
  - more readable navigation

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts`
- `npm run test:mobile:design:parity`
- `npm run build`
- `npm run mobile:phase1:qa`
