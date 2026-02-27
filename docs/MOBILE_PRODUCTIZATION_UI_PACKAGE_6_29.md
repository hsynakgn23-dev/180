# Mobile Productization/UI Package 6.29 (Password Reset Parity)

## Summary
- Continued the mobile auth surface after package `6.28`.
- Added mobile forgot-password request flow.
- Wired recovery deep-link callbacks into the app and exposed a native new-password form.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_29.md`

## What Changed
- `apps/mobile/App.tsx`
  - adds auth flow modes: `login`, `forgot`, `recovery`
  - sends Supabase password reset emails with a mobile deep-link redirect target
  - handles auth callback URLs via `applyMobileAuthCallbackFromUrl(...)`
  - opens recovery mode when `type=recovery` is returned from Supabase
  - completes password reset with `supabase.auth.updateUser({ password })`
  - emits `password_reset_requested`, `password_reset_completed`, and auth failure telemetry
- `apps/mobile/src/ui/appScreens.tsx`
  - upgrades `AuthCard` from a login-only surface into a multi-mode auth card
  - adds segmented login / forgot-password mode switching
  - adds the recovery form with password confirmation
  - keeps signed-in session state and sign-out actions in the same card

## Rationale
- The mobile parity audit still listed forgot/reset password as missing.
- Recovery callback plumbing already existed in `mobileAuthCallback.ts`, but it was not connected to the visible mobile auth surface.
- This package closes the basic password reset gap without waiting for full OAuth parity.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx`
- `npm run test:mobile:design:parity`
- `npm run build`
- `npm run mobile:phase1:qa`
