# Mobile Phase-1 Package 5.35 (Notification Inbox View Prefs Persistence)

## Summary
- Added persistent inbox view preferences (filter, sort, search query) on mobile.
- Inbox card now restores the last used view configuration after app restart.
- Extended push inbox smoke coverage to include view prefs read/write checks.

## Changed Files
- `apps/mobile/src/lib/mobilePushInbox.ts`
- `apps/mobile/App.tsx`
- `scripts/mobile-push-inbox-smoke.mjs`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_35.md`

## Behavior
- New storage helpers:
  - `readPushInboxViewPrefs`
  - `writePushInboxViewPrefs`
- `PushInboxCard` on mount:
  - loads persisted `filter/sort/search`
  - validates filter/sort keys before applying
- `PushInboxCard` on state changes:
  - writes current `filter/sort/search` back to storage after initial hydration

## Notes
- View prefs are local-device scoped and independent from inbox message storage.
