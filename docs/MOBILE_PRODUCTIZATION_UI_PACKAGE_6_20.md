# Mobile Productization/UI Package 6.20 (React Navigation Runtime)

## Summary
- Upgraded mobile runtime from custom in-page tab state to `react-navigation` bottom tabs.
- Preserved existing web-aligned design language and card surfaces.
- Kept dev-only debug/test surfaces behind `__DEV__`.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/index.ts`
- `apps/mobile/src/ui/appStyles.ts`
- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_20.md`

## Behavior
- Main app shell now runs on `NavigationContainer` + `BottomTabNavigator`:
  - `Daily`
  - `Inbox`
  - `Profile`
  - `Account`
- Deep-link route intent (`daily/invite/share`) still controls flow target and now auto-focuses the correct tab (`Daily` or `Account`).
- Push registration auto-attempt stays enabled for signed-in users when token is not ready.
- Existing business/data logic remains unchanged; this package is runtime navigation hardening.

## Where To See In App
- Bottom native tab bar is now rendered by React Navigation, not custom button row.
- Switch tabs and verify each screen surface is isolated.
- In dev mode, debug/push test panels remain under `Account` tab.

## Design Guardrail Compliance
- No new color family introduced.
- Existing dark + sage/clay token family preserved.
- Inter typography preserved.
- Minimal visual language preserved.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/index.ts`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
