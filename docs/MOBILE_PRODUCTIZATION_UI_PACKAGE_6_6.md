# Mobile Productization/UI Package 6.6 (App.tsx Modularization - View Components + Shared Types)

## Summary
- Continued productization plan with a structural refactor while preserving the existing mobile visual output.
- Moved presentational card/screen components out of `App.tsx` into a dedicated UI module.
- Centralized mobile app view-state and inbox view config types/constants into a shared UI contracts module.
- Extended design parity guardrails to scan the new extracted screen module.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appTypes.ts`
- `apps/mobile/src/ui/appScreens.tsx`
- `scripts/mobile-design-parity-check.mjs`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_6.md`

## Behavior
- `App.tsx` now focuses on orchestration (state/hooks/domain actions) and imports UI components from `appScreens.tsx`.
- UI/state contracts are shared via `appTypes.ts`:
  - push inbox filter/sort keys and options
  - app screen state unions (auth, daily, push, profile, invite, queue)
- `mobile-design-parity-check` now includes `apps/mobile/src/ui/appScreens.tsx` to prevent unapproved palette drift in extracted UI components.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appTypes.ts apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/ui/theme.ts apps/mobile/src/ui/primitives.tsx scripts/mobile-design-parity-check.mjs`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`

## Notes
- This package is architecture/refactor-only; no business logic, route contract, or visual design rule changes were introduced.
