# Mobile Phase-1 Package 5.13 (Emulator Local Push Simulation)

## Summary
- Added emulator-safe local notification simulation for push/deep-link testing.
- Added a dedicated action on `Push Status` card to trigger local test notification.
- Kept remote push test flow intact for physical device validation.

## Changed Files
- `apps/mobile/src/lib/mobilePush.ts`
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_13.md`

## Behavior
- New action: `Emulator Local Push Simule Et`
  - schedules local notification with deep-link payload
  - works without Expo push token/cloud sync
- Useful for validating:
  - notification listener wiring
  - deep-link intake from notification data
  - in-app routing reaction

## Notes
- Real Expo push token + cloud sync + server dispatch still require physical device.
- Local simulation is intended only as a dev unblock path on emulator.
