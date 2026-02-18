# Mobile Phase-1 Package 5.1 (Expo Bootstrap + Shared Contracts)

## Summary
- Bootstrapped React Native app with Expo at `apps/mobile`.
- Added shared mobile contract layer at `packages/shared/src/mobile`.
- Wired web domain contract files to re-export shared implementations.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/app.json`
- `apps/mobile/metro.config.js`
- `packages/shared/package.json`
- `packages/shared/src/mobile/index.ts`
- `packages/shared/src/mobile/analyticsEvents.ts`
- `packages/shared/src/mobile/mobileRouteContract.ts`
- `packages/shared/src/mobile/mobileScreenMap.ts`
- `packages/shared/src/mobile/mobileWebPromptContract.ts`
- `packages/shared/src/mobile/deepLinks.ts`
- `src/domain/analyticsEvents.ts`
- `src/domain/mobileRouteContract.ts`
- `src/domain/mobileScreenMap.ts`
- `src/domain/mobileWebPromptContract.ts`
- `src/domain/deepLinks.ts`
- `README.md`

## Notes
- Expo app currently uses a contract smoke view to validate deep-link generation/parsing and screen mapping.
- Mobile app identifier placeholders were set to:
  - `com.hsyna.absolutecinema` (Android)
  - `com.hsyna.absolutecinema` (iOS)
