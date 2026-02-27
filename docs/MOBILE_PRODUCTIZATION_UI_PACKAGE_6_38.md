# Mobile Productization/UI Package 6.38 (Account Center + Share Surfaces)

## Summary
- Continued the mobile polish pass after package `6.37`.
- Reworked the account-facing surfaces so auth, invite, and share flows read like product surfaces instead of debug cards.
- Extended the same visual system into settings `session`, invite-claim, and share-hub moments.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_38.md`

## What Changed
- `apps/mobile/src/ui/appScreens.tsx`
  - adds reusable `StatusStrip` for non-error/non-empty product feedback
  - upgrades `AuthCard` with clearer status badges, flow guidance, loading messaging, and signed-in summaries
  - restructures settings `session` tab around a lead card plus collapsible invite/rules sections
  - upgrades `InviteClaimScreen` into a lead + state-driven claim surface
  - upgrades `ShareHubScreen` with a lead card, readiness panel, invite/link context, and clearer platform actions
- `apps/mobile/src/ui/appStyles.ts`
  - adds support styles for status strips, auth mode surfaces, action stacks, and compact detail info grids
- `apps/mobile/App.tsx`
  - bumps the visible mobile package label to `6.38`

## Rationale
- After the profile/explore polish, the roughest remaining product surface was the account/share area.
- These flows carried the right technical behavior but still looked like operational scaffolding.
- This package makes login, referral, and sharing feel like first-class user journeys without changing any contracts or event names.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts`
