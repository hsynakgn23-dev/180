# Mobile Phase-1 Package 5.34 (Notification Inbox Bulk Actions)

## Summary
- Added bulk actions on notification inbox scoped to current filter/search/sort result set.
- Added storage-layer helpers for batch opened update and batch removal.
- Extended push inbox smoke test to cover new batch operations.

## Changed Files
- `apps/mobile/src/lib/mobilePushInbox.ts`
- `apps/mobile/App.tsx`
- `scripts/mobile-push-inbox-smoke.mjs`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_34.md`

## Behavior
- New UI actions on Notification Inbox:
  - `Filtredekileri Opened Yap (N)`
  - `Filtredekileri Temizle (N)`
- Bulk actions operate on the currently visible logical scope:
  - after filter
  - after search
  - after sort
- Analytics events emitted:
  - `mobile_push_inbox_bulk_opened`
  - `mobile_push_inbox_bulk_removed`

## Notes
- Existing single-row actions (`Deep-link Ac`, `Link Kopyala`) remain unchanged.
- Batch helpers are local-device storage scoped.
