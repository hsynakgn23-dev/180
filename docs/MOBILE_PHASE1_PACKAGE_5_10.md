# Mobile Phase-1 Package 5.10 (Push Token Cloud Sync)

## Summary
- Added cloud sync for Expo push token and device metadata into `profiles.mobile_push_state`.
- Added automatic sync trigger when user is signed in and token is present/updated.
- Added migration and base schema update for push profile-state column.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobilePushProfileSync.ts`
- `sql/migrations/20260221_mobile_push_profile_state.sql`
- `supabase_setup.sql`
- `docs/MOBILE_PHASE1_PACKAGE_5_10.md`
- `README.md`

## Behavior
- Push registration flow now has two stages:
  - token registration (`expo-notifications`)
  - profile cloud sync (`profiles.mobile_push_state`)
- `Push Status` card now shows:
  - cloud sync status
  - cloud sync message
  - device key preview
- Auto sync rules:
  - user must be signed in
  - token must exist
  - token must be unsynced or changed since last successful sync
- If DB schema is not ready, app reports migration requirement without crashing.

## Notes
- `mobile_push_state` keeps device-scoped push metadata and latest device pointer.
- This package establishes backend-ready targeting metadata for future push send pipeline.
