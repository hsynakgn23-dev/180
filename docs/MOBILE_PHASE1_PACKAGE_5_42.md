# Mobile Phase-1 Package 5.42 (iOS Release Prep)

## Summary
- Added iOS-facing Expo/EAS release commands and a strict iOS release-check entrypoint.
- Wired native Sign in with Apple into the mobile auth modal for iOS builds.
- Extended mobile env/release env sync so production web-origin links stay explicit during iOS review.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `apps/mobile/package.json`
- `apps/mobile/.env.example`
- `package.json`
- `scripts/mobile-env-sync.mjs`
- `scripts/mobile-release-env-sync.mjs`
- `scripts/mobile-release-ready.mjs`
- `.env.example`
- `README.md`

## Behavior
- New root scripts:
  - `npm run mobile:eas:ios:development`
  - `npm run mobile:eas:ios:preview`
  - `npm run mobile:eas:ios:production`
  - `npm run mobile:eas:ios:submit:production`
  - `npm run mobile:phase1:release:check:ios`
- `apps/mobile/app.json` now enables `ios.usesAppleSignIn`.
- Auth modal now shows native Apple sign-in on supported iOS devices and exchanges the Apple ID token with Supabase.
- Env sync now preserves `EXPO_PUBLIC_WEB_APP_URL` for mobile discover/account-deletion web surfaces.
- iOS release check now validates:
  - `ios.buildNumber`
  - `ios.usesAppleSignIn`
  - `submit.production.ios`
  - release web origin presence when running `--platform=ios`

## Notes
- App Store review should not see Google-only sign-in anymore on iOS.
- `submit.production.ios` is present so EAS Submit has a stable profile name.
- Adding `ascAppId` later is still recommended for deterministic App Store Connect submission.
