# Mobile Productization/UI Package 6.21 (Consumer Surface Lock)

## Summary
- Addressed UX confusion caused by internal QA/debug surfaces appearing in app runtime.
- Switched internal surfaces to opt-in mode with env gate.
- Simplified visible hero/account surfaces for consumer-facing flow alignment.

## Changed Files
- `apps/mobile/App.tsx`
- `scripts/mobile-env-sync.mjs`
- `scripts/mobile-release-env-sync.mjs`
- `.env.example`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_21.md`

## Behavior
- Internal surfaces are now hidden by default:
  - screen/package/tab debug badges
  - runtime ops status rails
  - release snapshot/internal push test/debug cards
  - manual route force controls
- Internal surfaces can be enabled only in local dev with:
  - `EXPO_PUBLIC_MOBILE_INTERNAL_SURFACES=1`
- Release env generation hard-locks:
  - `EXPO_PUBLIC_MOBILE_INTERNAL_SURFACES=0`

## Why This Package
- User-facing app runtime should not expose internal QA operations.
- This reduces mismatch perception between web product language and mobile runtime.

## Validation
- `npm run lint -- apps/mobile/App.tsx scripts/mobile-env-sync.mjs scripts/mobile-release-env-sync.mjs`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
