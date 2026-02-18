# Mobile Phase-1 Package 5.24 (Firebase Init Error Guardrails)

## Summary
- Hardened mobile push registration error handling for Android Firebase init failures.
- Added explicit troubleshooting guidance for `Default FirebaseApp is not initialized`.

## Changed Files
- `apps/mobile/src/lib/mobilePush.ts`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_24.md`

## Behavior
- `registerForPushNotifications` now normalizes native error text:
  - Detects Firebase init missing (`default firebaseapp is not initialized` / `firebaseapp.initializeapp`).
  - Returns `config_missing` with actionable message instead of opaque runtime text.
- If `EXPO_PUBLIC_EXPO_PROJECT_ID` is missing and project-id related errors occur, the message points to `mobile:ready`.

## Notes
- Push-disabled local flow remains unchanged (`EXPO_PUBLIC_PUSH_ENABLED=0`).
- Remote push still requires native rebuild after Firebase config updates.
