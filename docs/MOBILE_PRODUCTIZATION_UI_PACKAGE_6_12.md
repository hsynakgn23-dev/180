# Mobile Productization/UI Package 6.12 (Ops Snapshot Row)

## Summary
- Continued plan-driven mobile UI polish under existing design guardrails.
- Added a second, compact operational snapshot row under hero for faster state scanning.
- Preserved web-derived design language (palette/tokens, Inter typography, minimal structure).

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_12.md`

## Behavior
- New hero-level snapshot cards:
  - `Unread Links`
  - `Queue Pending`
  - `Streak`
- Snapshot values are live and derived from existing app state:
  - unread deep-link inbox count
  - ritual retry queue pending count
  - profile streak value when available
- Visual emphasis uses existing sage/clay status tones only.

## Design Guardrail Compliance
- No new palette family introduced.
- Existing dark + sage/clay tokens preserved.
- Inter hierarchy preserved.
- Minimal layout language preserved.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
