# Mobile Phase-1 Package 5.9 (Expo Push Baseline)

## Summary
- Added Expo push notification baseline for mobile app shell.
- Added permission + token registration flow with local token persistence.
- Added notification listeners that capture notification opens and route deep links when provided.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/app.json`
- `apps/mobile/src/lib/mobilePush.ts`
- `apps/mobile/.env.example`
- `docs/MOBILE_PHASE1_PACKAGE_5_9.md`
- `README.md`

## Behavior
- New `Push Status` card is rendered in mobile app shell.
- `Push Izin + Token Yenile` action:
  - requests notification permission (device-only).
  - requests Expo push token.
  - persists token locally (`AsyncStorage`).
- Notification events:
  - received/opened states update UI status.
  - analytics records push load/fail/open reasons using `page_view` with structured reason fields.
  - if notification payload includes `deepLink` / `url` / `link` / `app_link`, app routes through shared deep-link parser.

## Notes
- Push token flow requires physical device for real token generation.
- `EXPO_PUBLIC_EXPO_PROJECT_ID` is optional and used as fallback when project id cannot be resolved from app constants.
