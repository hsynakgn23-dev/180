# Mobile Productization/UI Package 6.16 (Floating Quick Shortcuts)

## Summary
- Continued plan-based UI iteration without breaking web-first design guardrails.
- Extended the floating `Yukari` surface with contextual quick shortcuts (`Flow`, `Debug`).
- Improved one-hand navigation ergonomics on long mobile screens.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_16.md`

## Behavior
- When the floating area appears, it now includes:
  - `Flow` shortcut
  - `Debug` shortcut
  - `Yukari` button
- `Flow` and `Debug` use the existing smart jump handler (`jumpToSection`), including debug auto-open behavior.
- Existing data/feature logic is unchanged; this package is UX/navigation polish only.

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
