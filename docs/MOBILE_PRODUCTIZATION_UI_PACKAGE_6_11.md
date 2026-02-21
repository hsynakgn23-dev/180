# Mobile Productization/UI Package 6.11 (Active Route Action Emphasis)

## Summary
- Continued plan-based mobile polish with no palette/theme/font divergence from web design language.
- Made route action buttons visually reflect the currently active screen route.
- Added a compact route hint label under action buttons for clearer flow visibility.
- Hardened local deep-link generation references in `App.tsx` with explicit import/constants.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_11.md`

## Behavior
- `Daily / Invite / Share` action row now uses dynamic tone per active route:
  - active `Daily` -> `brand`
  - active `Invite` -> `teal`
  - active `Share` -> `teal`
  - others remain `neutral`
- New helper text displays active route: `Aktif route: ...`.
- No navigation logic change; only visibility/affordance improvement.

## Design Guardrail Compliance
- Existing dark + sage/clay token family preserved.
- Inter typography and hierarchy preserved.
- Minimal layout language preserved; change is state emphasis only.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
