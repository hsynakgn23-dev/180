# Mobile Phase-1 Package 5.31 (Notification Inbox Search + Sort)

## Summary
- Added client-side search for inbox rows (`title`, `body`, `deep-link`).
- Added sort controls for inbox triage (`newest`, `oldest`, `unopened first`, `opened first`).
- Integrated search/sort with existing filter + pagination flow.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_31.md`

## Behavior
- New search input on Notification Inbox:
  - case-insensitive match on title/body/deep-link
  - live result count in card meta line
- New sort chips:
  - `En Yeni`
  - `En Eski`
  - `Yeni Ustte`
  - `Opened Ustte`
- Pagination remains active and now applies after filter + search + sort.
- Page index resets to first page when filter/sort/search changes.

## Notes
- This package is UI-state only; inbox persistence model is unchanged.
