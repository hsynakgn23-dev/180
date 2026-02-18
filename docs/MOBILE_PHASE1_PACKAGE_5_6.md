# Mobile Phase-1 Package 5.6 (Daily Offline Cache Fallback)

## Summary
- Added AsyncStorage-backed cache for `/api/daily` responses in Expo mobile app.
- Daily screen now falls back to last successful cached payload when live API fails.
- Added cache metadata to UI (`live/cache`, stale flag, cache age) to make fallback explicit.

## Changed Files
- `apps/mobile/src/lib/dailyApi.ts`
- `apps/mobile/App.tsx`
- `docs/MOBILE_PHASE1_PACKAGE_5_6.md`
- `README.md`

## Behavior
- On successful live `/api/daily` response:
  - payload is normalized and cached with timestamp.
- On live fetch timeout/error/non-OK response:
  - app tries cached payload first.
  - if cache exists, UI shows cached data and live warning text.
  - if cache does not exist, existing error state is shown.
- If daily endpoint config is missing but cache exists:
  - app still renders cached daily content to preserve continuity.

## Notes
- Cache max-age heuristic is currently `18h` for stale indicator.
- This package addresses Phase-1 offline-first requirement for daily list caching.
