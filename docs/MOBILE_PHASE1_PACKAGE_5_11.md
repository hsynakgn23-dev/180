# Mobile Phase-1 Package 5.11 (Push Test Dispatch)

## Summary
- Added a mobile API client for authenticated push test requests to `/api/push/test`.
- Added in-app "self test push" action on `Push Status` card.
- Added UI state for test request lifecycle and Expo ticket counters.

## Changed Files
- `api/push/test.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobilePushApi.ts`
- `apps/mobile/.env.example`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_11.md`

## Behavior
- `Push Status` card now supports two actions:
  - push permission/token refresh
  - self test push dispatch
- Test push call is enabled when:
  - user is signed in
  - push cloud sync status is `synced`
- Test result view shows:
  - sent token count
  - Expo ticket count
  - Expo ticket error count

## Notes
- Mobile client sends bearer token from current Supabase session.
- API base resolution order for push test:
  - `EXPO_PUBLIC_PUSH_API_BASE`
  - `EXPO_PUBLIC_REFERRAL_API_BASE`
  - derived base from `EXPO_PUBLIC_ANALYTICS_ENDPOINT` / `EXPO_PUBLIC_DAILY_API_URL`
