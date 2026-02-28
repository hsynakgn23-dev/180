# Mobile Productization/UI Package 6.46 (Route Contract Expansion + Auth Handoff)

## Summary
- Expanded the shared web-to-mobile route contract beyond `daily / invite / share`.
- Added first-class `public_profile` and `discover` targets so web prompts can hand off with explicit intent.
- Strengthened signed-out invite/share handoff by opening the mobile auth surface automatically.

## Files
- `packages/shared/src/mobile/mobileRouteContract.ts`
- `packages/shared/src/mobile/mobileScreenMap.ts`
- `packages/shared/src/mobile/deepLinks.ts`
- `scripts/mobile-contract-smoke.mjs`
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_46.md`

## What Changed
- `packages/shared/src/mobile/mobileRouteContract.ts`
  - expands supported targets to include `public_profile` and `discover`
  - normalizes `user_id`, `username`, and discover-route payloads
  - supports encode/parse roundtrips for the new targets
- `packages/shared/src/mobile/mobileScreenMap.ts`
  - maps `public_profile` to `public_profile`
  - maps `discover` to `discover_home`
- `packages/shared/src/mobile/deepLinks.ts`
  - lets shared deep-link builders emit `public_profile` and `discover` app links
- `scripts/mobile-contract-smoke.mjs`
  - adds smoke coverage for the new route targets and their query params
- `apps/mobile/App.tsx`
  - routes `public_profile` deep links into the existing in-app public-profile loader
  - maps `discover_home` and `public_profile` to the correct tabs
  - auto-opens auth modal once for signed-out `invite` and `share` routes

## Rationale
- Web and mobile already shared the same contract style, but the contract surface was incomplete.
- Missing first-class route targets force generic fallbacks and make debugging handoff problems harder.
- Signed-out invite/share users should land directly on the auth step instead of reading an intermediate gate.

## Validation
- `npm run test:mobile:contracts`
- `npm run mobile:env:doctor`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
