# Mobile Productization/UI Package 6.10 (Hero Status Rail)

## Summary
- Continued plan-driven mobile UI productization with visible but guardrail-safe improvements.
- Added a compact status rail under hero to make app state readable at first glance.
- Kept web design source rules intact: same palette/tokens, Inter typography, minimal card language.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_10.md`

## Behavior
- Hero now includes four live status pills:
  - `Auth` (`ready/required`)
  - `Push` (`synced/syncing/error/idle`)
  - `Daily` (`N picks/loading/error/idle`)
  - `Inbox` (`N items`)
- Status pills use existing token family and do not alter feature behavior.

## Design Guardrail Compliance
- No new visual language or palette family introduced.
- Existing dark + sage/clay tokens retained.
- Inter hierarchy retained.
- Minimal structure retained; change is state visibility polish only.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
