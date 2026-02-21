# Mobile Phase-1 Package 5.36 (Notification Inbox Row Memoization)

## Summary
- Refactored inbox row rendering into a dedicated memoized component.
- Reduced unnecessary row rerenders when unrelated inbox card state updates.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_36.md`

## Behavior
- Added `PushInboxRowCard` memoized component for row UI.
- Added shared `buildHighlightedNodes` helper for row-level highlight rendering.
- Row rerender guard now tracks:
  - item reference
  - active search query
  - copy-feedback state for the row

## Notes
- Functional behavior stays the same (open/copy/highlight/filter/sort/pagination unchanged).
- This package is focused on render-cost optimization for larger inbox lists.
