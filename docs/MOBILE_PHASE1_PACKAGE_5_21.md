# Mobile Phase-1 Package 5.21 (Notification Types: Reply/Follow/Streak)

## Summary
- Aligned mobile notification flow with planned MVP notification categories.
- Added notification type parsing for `reply`, `follow`, `streak`, and `generic`.
- Propagated type metadata to inbox storage and analytics events.

## Changed Files
- `apps/mobile/src/lib/mobilePush.ts`
- `apps/mobile/src/lib/mobilePushInbox.ts`
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_21.md`

## Behavior
- Incoming notification data now resolves a normalized type:
  - `reply`
  - `follow`
  - `streak`
  - fallback `generic`
- Inbox rows show notification type.
- Push receive/open analytics include `notificationType` property.

## Notes
- This package is scoped to type handling only; delivery pipeline remains unchanged.
