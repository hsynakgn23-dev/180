# Mobile Productization/UI Package 6.37 (Profile State Surfaces + Touch Feedback)

## Summary
- Continued the mobile polish pass after package `6.36`.
- Replaced remaining flat profile/public-profile empty-loading states with guided state panels.
- Added clearer touch feedback to collapsible headers and profile movie archive rows.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_37.md`

## What Changed
- `apps/mobile/App.tsx`
  - uses `StatePanel` inside public-profile film archive and comment sections
  - uses `StatePanel` inside own-profile watched-movies section when the archive is loading, empty, or failed
  - upgrades profile and public-profile movie rows with pressed-state feedback
  - bumps the visible mobile package label to `6.37`
- `apps/mobile/src/ui/appScreens.tsx`
  - applies `StatePanel` to both archive modals for loading, empty, and error moments
  - gives `CollapsibleSectionCard` a pressed visual response
- `apps/mobile/src/ui/appStyles.ts`
  - adds pressed styles for collapsible headers and movie archive rows

## Rationale
- The previous pass reduced clutter, but some surfaces still collapsed back into plain text when data was absent or refreshing.
- Those low-information moments make the app feel unfinished even if the structure is better.
- This package keeps profile/public-profile states visually intentional and makes taps feel more obvious.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts`
- `npm run test:mobile:design:parity`
- `npm run build`
- `npm run mobile:phase1:qa`
