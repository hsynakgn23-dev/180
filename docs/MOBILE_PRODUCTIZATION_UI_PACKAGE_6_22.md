# Mobile Productization/UI Package 6.22 (Route-Tab Flow Alignment)

## Summary
- Continued mobile productization after consumer-surface lock.
- Aligned deep-link route surfaces with the active tab shell to prevent hidden route states.
- Kept the existing web-aligned visual language and token guardrails unchanged.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_22.md`

## Behavior
- `Daily` tab is now always actionable and consistently shows:
  - `Daily Home`
  - `Ritual Draft`
- Deep-link route surfaces are now rendered on `Account` tab:
  - `invite_claim` -> `Invite Claim` card appears in `Account`
  - `share_hub` -> `Share Hub` card appears in `Account`
- `Account` section header meta now reflects active route context (`Invite`, `Share`, `Session`).
- Hero package label updated to `UI Package 6.22`.

## Why This Package
- Invite/share deep links were mapped to `Account` tab, but related cards were rendered on `Daily`, causing route/tab mismatch.
- This package removes that mismatch and keeps tab UX predictable for consumer runtime.

## Design Guardrail Compliance
- No new color family introduced.
- Existing dark + sage/clay token family preserved.
- Inter typography preserved.
- Minimal visual language preserved.

## Validation
- `npx tsc --noEmit` (run in `apps/mobile`)
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/lib/mobilePushInbox.ts`
