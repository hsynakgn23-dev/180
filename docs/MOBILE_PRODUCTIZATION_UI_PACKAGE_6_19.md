# Mobile Productization/UI Package 6.19 (Single-Page to Tab Shell Transition)

## Summary
- Replaced the single long test page UX with a production-style tab shell.
- Split runtime into dedicated surfaces: `Daily`, `Inbox`, `Profile`, `Account`.
- Kept web-aligned design language (dark base + sage/clay tokens, Inter typography, minimal card system).

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `docs/GROWTH_AND_MOBILE_PLAN_2026Q1.md`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_19.md`

## Behavior
- App no longer renders all cards in one scroll surface.
- Bottom tab bar now controls primary runtime surfaces:
  - `Daily`: daily flow + ritual + invite/share route screens
  - `Inbox`: push inbox operations
  - `Profile`: profile snapshot/streak metrics
  - `Account`: auth/session and release snapshot
- Dev-only surfaces (`Push test`, debug deep-link cards, manual route triggers) are now gated behind `__DEV__`.
- Signed-in users now auto-attempt push registration if token is not ready.

## Where To See In App
- Open mobile app and use bottom tab bar.
- Each tab should show only its own domain surface; no giant all-in-one screen.
- In release build, dev-only debug/test surfaces should not be visible.

## Plan Alignment Update
- Growth/mobile plan `Phase 2` is updated from `200-500` beta target to low-budget approach:
  - small closed beta (`20-50`) + staged rollout in Play Console.

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
