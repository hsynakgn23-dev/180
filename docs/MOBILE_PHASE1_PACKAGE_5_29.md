# Mobile Phase-1 Package 5.29 (Notification Inbox Filter + Pagination)

## Summary
- Added inbox filtering controls for notification QA and triage.
- Added pagination controls to browse large inbox history without truncating at first six rows.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_29.md`

## Behavior
- Notification inbox now supports filter chips:
  - `Tum`
  - `Yeni Link`
  - `Linkli`
  - `Reply`
  - `Follow`
  - `Streak`
  - `Generic`
- Filter chips show live counts for each segment.
- Inbox list is paginated:
  - page size: 6
  - `Onceki` / `Sonraki` navigation
  - current page indicator
- Empty-state message is filter-aware.

## Notes
- This package is UI-only; storage schema and push delivery pipeline are unchanged.
