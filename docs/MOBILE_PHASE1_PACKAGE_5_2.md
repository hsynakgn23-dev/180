# Mobile Phase-1 Package 5.2 (Deep-Link Intake + App-Open Analytics)

## Summary
- Mobile app now listens to incoming deep links via Expo Linking.
- Added app-open analytics events for invite/share entry points.
- Added SQL view to monitor mobile app-open trends daily.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobileAnalytics.ts`
- `apps/mobile/.env.example`
- `packages/shared/src/mobile/analyticsEvents.ts`
- `README.md`
- `sql/migrations/20260220_mobile_app_open_views.sql`

## Behavior
- On app boot and URL events:
  - parses deep link with shared contract (`parseMobileDeepLink`)
  - tracks `app_opened_from_invite` when target is `invite`
  - tracks `app_opened_from_share` when target is `share`
- Tracks `session_start` from native app surface.
- Analytics endpoint is read from `EXPO_PUBLIC_ANALYTICS_ENDPOINT`.

## Run Notes
- Set `apps/mobile/.env`:
  - `EXPO_PUBLIC_ANALYTICS_ENDPOINT=http://10.0.2.2:5173/api/analytics` (Android emulator local dev)
- Start mobile app:
  - `npm run mobile:android`
