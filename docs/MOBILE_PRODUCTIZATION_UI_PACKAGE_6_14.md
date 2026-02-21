# Mobile Productization/UI Package 6.14 (Scroll-Aware Navigator + Back To Top)

## Summary
- Continued plan-based mobile polish under existing web design guardrails.
- Upgraded hero quick navigator to be scroll-aware with active section emphasis.
- Added floating `Yukari` action for faster long-page navigation on mobile.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_14.md`

## Behavior
- Quick navigator (`Core / Flow / Debug`) now highlights the currently active section while scrolling.
- Scroll tracking updates active section and back-to-top visibility.
- `Yukari` button appears after scrolling down and jumps to the top of the page.
- Existing feature logic and data flows are unchanged.

## Design Guardrail Compliance
- No new palette family introduced.
- Existing dark + sage/clay tokens preserved.
- Inter typography preserved.
- Minimal visual language preserved.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
