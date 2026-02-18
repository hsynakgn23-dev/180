# Mobile Phase-1 Package 5.20 (Notification Inbox)

## Summary
- Added persistent mobile notification inbox for push/local notification history.
- Added in-app deep-link open action for inbox items.
- Added clear/reload controls for notification inbox state.

## Changed Files
- `apps/mobile/src/lib/mobilePushInbox.ts`
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_20.md`

## Behavior
- Inbox stores recent notification snapshots in local storage.
- Notification listeners append entries with source metadata (`received` / `opened`).
- Inbox card supports:
  - reload
  - clear
  - open deep-link per row when available

## Notes
- Inbox is local-device scoped.
- This package improves day-to-day push QA and user-visible notification continuity.
