# Mobile Phase-1 Package 5.16 (Dev Client Setup)

## Summary
- Added Android dev client workflow to bypass Expo Go remote push limitations.
- Added `expo-dev-client` dependency and plugin wiring.
- Added EAS build profiles for development/preview Android APK output.

## Changed Files
- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `package.json`
- `apps/mobile/.env.example`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_16.md`

## Behavior
- New mobile scripts:
  - `npm run mobile:devclient:android` (local Android dev build)
  - `npm run mobile:devclient:start` (start Metro in dev-client mode)
  - `npm run mobile:eas:android:development` (cloud dev build via EAS)
- `expo-dev-client` is enabled in app config plugins.
- `apps/mobile/eas.json` now defines `development` and `preview` Android profiles.

## Notes
- Remote push token registration should be tested in dev client / physical device flow.
- Emulator remains useful for local notification + deep-link simulation.
