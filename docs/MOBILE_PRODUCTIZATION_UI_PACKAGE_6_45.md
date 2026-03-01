# Mobile Productization/UI Package 6.45 (Surface Copy Reduction)

## Summary
- Continued the simplification pass after package `6.44`.
- Reduced copy density across marks, share, invite, and public-profile entry surfaces.
- Kept the same actions and data, but removed low-value explanatory text and repetitive meta blocks.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_45.md`

## What Changed
- `apps/mobile/src/ui/appScreens.tsx`
  - simplifies `ProfileMarksCard` into a shorter lead/state/content structure
  - trims `InviteClaimScreen` labels and success/error copy
  - simplifies `ShareHubScreen` by removing the visible invite-link detail block and shortening readiness/status text
  - reduces `PublicProfileBridgeCard` and `PublicProfileDetailCard` copy so they read faster
- `apps/mobile/App.tsx`
  - bumps the visible mobile package label to `6.45`

## Rationale
- The previous surfaces were functionally correct but visually verbose.
- Users should see the next action quickly instead of parsing long helper text.
- The mobile app benefits from shorter, more decisive copy than the web dashboard-style wording.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx`
