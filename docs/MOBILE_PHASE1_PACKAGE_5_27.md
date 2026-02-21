# Mobile Phase-1 Package 5.27 (Notification Inbox Dedupe + Open Merge)

## Summary
- Prevented duplicate inbox rows when the same notification arrives as both `received` and `opened`.
- Added notification id propagation from Expo notification payload into local inbox storage.
- Merged duplicate rows by promoting existing record to opened state instead of appending a second row.

## Changed Files
- `apps/mobile/src/lib/mobilePush.ts`
- `apps/mobile/src/lib/mobilePushInbox.ts`
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_27.md`

## Behavior
- `PushNotificationSnapshot` now carries `notificationId`.
- Inbox append flow now deduplicates by:
  - exact `notificationId` match (primary)
  - content fingerprint + time window fallback (secondary)
- If an `opened` event matches an existing row:
  - row is updated in place
  - `opened=true`, `source=opened`, `openedAt` is set
  - unread deep-link count no longer stays inflated by duplicate pairs

## Notes
- Backward compatible with existing inbox records (items without `notificationId` still load).
- This is local-device scoped behavior; server push pipeline is unchanged.
