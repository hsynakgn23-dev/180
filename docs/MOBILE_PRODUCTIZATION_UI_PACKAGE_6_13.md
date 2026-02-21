# Mobile Productization/UI Package 6.13 (Quick Section Navigator)

## Summary
- Continued the plan with visible UI polish while preserving existing web-first design guardrails.
- Added a quick navigator under hero for long-screen usability on mobile.
- Users can now jump directly to `Core`, `Flow`, and `Debug` sections.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_13.md`

## Behavior
- Added section anchors for:
  - Core Ops
  - Active Flow
  - Debug
- Added quick action row under hero:
  - `Core` -> scrolls to Core Ops
  - `Flow` -> scrolls to Active Flow
  - `Debug` -> scrolls to Debug
- No business logic changes; only navigation ergonomics and visibility improvements.

## Design Guardrail Compliance
- No new palette family introduced.
- Existing dark + sage/clay tokens preserved.
- Inter typography preserved.
- Minimal composition preserved.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
