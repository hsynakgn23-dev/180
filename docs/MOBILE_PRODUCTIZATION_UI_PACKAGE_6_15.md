# Mobile Productization/UI Package 6.15 (Smart Quick-Nav Jump)

## Summary
- Continued plan-based UI polish while preserving web-first design guardrails.
- Improved quick navigator behavior with smart section jump handling.
- Added lightweight quick-nav interaction telemetry for section jumps.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_15.md`

## Behavior
- Quick-nav actions (`Core / Flow / Debug`) now route through a single jump handler.
- Pressing `Debug` in quick-nav now auto-opens debug panel (if closed) before scrolling.
- `Yukari` action now uses shared jump handler logic and emits quick-nav telemetry.
- Quick-nav hint now includes debug panel state (`open/closed`) for clarity.

## Design Guardrail Compliance
- No new palette family introduced.
- Existing dark + sage/clay tokens preserved.
- Inter typography preserved.
- Minimal layout language preserved.

## Validation
- `npm run lint -- apps/mobile/App.tsx`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
