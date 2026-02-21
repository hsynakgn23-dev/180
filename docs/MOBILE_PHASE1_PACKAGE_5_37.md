# Mobile Phase-1 Package 5.37 (Notification Inbox FlatList Virtualization)

## Summary
- Migrated inbox row rendering from inline `.map` to `FlatList`.
- Added virtualization-oriented list settings for more stable performance on larger inbox scopes.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_37.md`

## Behavior
- Inbox list now uses `FlatList` with:
  - `initialNumToRender`
  - `maxToRenderPerBatch`
  - `windowSize`
  - `removeClippedSubviews` (Android)
- Row separator moved to dedicated style (`inboxItemSeparator`) for predictable spacing.
- Existing paging/filter/sort/search behavior remains unchanged.

## Notes
- `FlatList` is rendered with `scrollEnabled={false}` because screen-level scrolling remains controlled by parent layout.
