# Mobile Phase-1 Package 5.15 (Analytics Circuit Breaker)

## Summary
- Added mobile analytics runtime toggle: `EXPO_PUBLIC_ANALYTICS_ENABLED`.
- Added circuit-breaker behavior for permanent HTTP failures (e.g. 404) to avoid repeated noisy requests.
- Kept dev warnings but limited them to actionable, low-noise output.

## Changed Files
- `apps/mobile/src/lib/mobileAnalytics.ts`
- `apps/mobile/.env.example`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_15.md`

## Behavior
- When `EXPO_PUBLIC_ANALYTICS_ENABLED=0`, mobile analytics emit is skipped.
- On permanent API failures (`400/401/403/404/405/410/422`), analytics is paused for 10 minutes.
- During pause window, events are dropped silently except a single dev warning.

## Notes
- This package is for dev stability/noise reduction.
- Production analytics should keep `EXPO_PUBLIC_ANALYTICS_ENABLED=1` with a reachable ingest endpoint.
