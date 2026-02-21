# Mobile Productization/UI Package 6.7 (Hook Modularization - Route Intent + Entry Motion)

## Summary
- Continued the productization plan with architecture-only refactor and no visual/token changes.
- Moved deep-link and route-intent orchestration out of `App.tsx` into a dedicated hook.
- Moved page-entry animation lifecycle into a dedicated hook.
- Kept web design parity rules and mobile visual language unchanged.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/hooks/useMobileRouteIntent.ts`
- `apps/mobile/src/hooks/usePageEntranceAnimation.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_7.md`

## Behavior
- `useMobileRouteIntent` now owns:
  - manual/deep-link intent state
  - initial URL + URL subscription handling
  - app-open analytics mapping for invite/share intents
  - screen plan and generated deep-link derivation
- `usePageEntranceAnimation` now owns:
  - page entrance timing config (`fade + translateY`)
  - derived `pageEnterTranslateY` interpolation
- `App.tsx` now consumes both hooks and remains focused on feature state/actions composition.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/hooks/useMobileRouteIntent.ts apps/mobile/src/hooks/usePageEntranceAnimation.ts`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`

## Notes
- This package is refactor-only and preserves existing UI rules (color, typography, minimal layout).
