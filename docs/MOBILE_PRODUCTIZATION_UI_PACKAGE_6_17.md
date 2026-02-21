# Mobile Productization/UI Package 6.17 (Visible Package Label)

## Summary
- Continued plan-based UI iteration without changing web-aligned design language.
- Added an explicit package label in the hero meta row so progress numbers are visible inside the mobile app UI.
- Kept existing palette, typography, and minimal layout conventions.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_17.md`

## Behavior
- Hero meta row now shows a third badge: `UI Package 6.17`.
- This helps map release notes/package numbers to what you see on emulator/device.
- No data flow, API, or logic changes were introduced.

## Where To See In App
- Open the app home screen.
- In the top hero card (`180 Absolute Cinema`), check the badge row under subtitle.
- You should see:
  - `Screen: ...`
  - `Session: ...`
  - `UI Package 6.17`

## Design Guardrail Compliance
- No new color family introduced.
- Existing dark + sage/clay token family preserved.
- Inter typography preserved.
- Minimal visual language preserved.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
