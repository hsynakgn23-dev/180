# Mobile Productization/UI Package 6.44 (Auth Screen + Profile Simplification)

## Summary
- Continued the mobile polish pass after package `6.43`.
- Moved member login into a dedicated modal screen instead of embedding session detail blocks inside the profile tab.
- Reduced signed-out profile noise by replacing the old account section with a single compact access CTA.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_44.md`

## What Changed
- `apps/mobile/src/ui/appScreens.tsx`
  - simplifies `AuthCard` copy and status treatment
  - adds `AuthModal` so auth now lives in a dedicated full-screen flow
- `apps/mobile/App.tsx`
  - removes the embedded profile auth section
  - adds a compact signed-out profile access panel with a single login CTA
  - keeps full profile surfaces only for signed-in users
  - bumps the visible mobile package label to `6.44`

## Rationale
- The previous profile experience mixed content, account status, and login controls in one long stack.
- Signed-out users need one obvious path forward, not multiple low-value sections.
- A dedicated auth screen is clearer and lets the profile surface stay focused on profile content.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx`
