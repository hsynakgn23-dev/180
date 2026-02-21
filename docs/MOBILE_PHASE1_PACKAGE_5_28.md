# Mobile Phase-1 Package 5.28 (Push Inbox Smoke Gate)

## Summary
- Added a dedicated smoke test for notification inbox dedupe/merge behavior.
- Covered both primary dedupe key (`notificationId`) and fallback dedupe path (content + time window).

## Changed Files
- `scripts/mobile-push-inbox-smoke.mjs`
- `package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_28.md`

## Behavior
- New script: `npm run test:mobile:push-inbox:smoke`
  - clears inbox
  - appends `received` + `opened` for same notification id
  - verifies a single merged row remains (`opened=true`, `source=opened`)
  - verifies fallback dedupe path without notification id
  - verifies storage readback consistency

## Notes
- This smoke test is Node-runner safe and does not require adb/emulator.
- Runtime deep-link smoke remains in `npm run test:mobile:deeplink:smoke`.
