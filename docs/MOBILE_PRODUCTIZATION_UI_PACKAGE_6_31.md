# Mobile Productization/UI Package 6.31 (Google OAuth Parity)

## Summary
- Continued the mobile auth surface after package `6.30`.
- Added a native Google OAuth entry point to the mobile auth card.
- Reused the existing mobile auth callback handler so OAuth can complete through the app deep link.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_31.md`

## What Changed
- `apps/mobile/App.tsx`
  - adds `handleGoogleSignIn()`
  - starts Supabase Google OAuth with `skipBrowserRedirect: true`
  - opens the returned OAuth URL with the native URL handler
  - points OAuth redirect back to `absolutecinema://open`
  - emits `oauth_start`, `oauth_redirect_started`, and `oauth_failure`
- `apps/mobile/src/ui/appScreens.tsx`
  - adds a `Google ile Devam Et` CTA to the mobile auth card in login mode
  - keeps existing password, forgot-password, and recovery flows unchanged

## Rationale
- The mobile parity audit still listed Google OAuth as missing.
- The callback/session logic already existed in `mobileAuthCallback.ts`, so the missing piece was the OAuth start surface.
- This package closes the auth completeness gap without introducing new route complexity.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx`
- `npm run test:mobile:design:parity`
- `npm run build`
- `npm run mobile:phase1:qa`
