# Mobile Phase-1 Package 5.38 (Notification Inbox Interaction Analytics)

## Summary
- Added analytics signals for inbox interaction funnel actions beyond open/remove flows.
- Instrumented filter, sort, search, page navigation, and link-copy interactions.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_38.md`

## Behavior
- New `trackMobileEvent('page_view', { reason: ... })` reasons:
  - `mobile_push_inbox_filter_changed`
  - `mobile_push_inbox_sort_changed`
  - `mobile_push_inbox_search_changed`
  - `mobile_push_inbox_page_changed`
  - `mobile_push_inbox_link_copied`
- Search event tracking is debounced-query driven and skips initial hydration snapshot.
- Existing analytics events remain:
  - `mobile_push_inbox_bulk_opened`
  - `mobile_push_inbox_bulk_removed`
  - `mobile_push_inbox_deeplink_opened`

## Notes
- Event schema stays compatible by using existing `page_view` envelope with `reason` + properties.
