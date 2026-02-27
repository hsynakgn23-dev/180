# Mobile Productization/UI Package 6.36 (Progressive Disclosure Sections)

## Summary
- Continued the mobile polish pass after package `6.35`.
- Added collapsible section cards to reduce the stacked-wall-of-content feeling.
- Applied progressive disclosure to secondary profile and public-profile surfaces.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_36.md`

## What Changed
- `apps/mobile/src/ui/appScreens.tsx`
  - adds `CollapsibleSectionCard`
  - animates expand/collapse with a simple content reveal and chevron rotation
- `apps/mobile/App.tsx`
  - wraps own-profile secondary blocks such as identity note, genre distribution, and watched movies
  - wraps public-profile film archive and comment feed sections
  - keeps the primary lead cards visible while moving deeper content behind progressive disclosure
  - bumps the visible mobile package label to `6.36`
- `apps/mobile/src/ui/appStyles.ts`
  - adds collapsible section header, chevron, and animated body styles

## Rationale
- The app still felt crowded because too many sections demanded attention at once.
- Not every block should compete with the primary task on first render.
- This package introduces a clearer first-pass reading order while still keeping the data close by.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts`
- `npm run test:mobile:design:parity`
- `npm run build`
- `npm run mobile:phase1:qa`
