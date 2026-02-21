# Mobile Phase-1 Package 5.33 (Inbox Debounced Search + Highlight)

## Summary
- Added debounce to inbox search input to reduce unnecessary recompute on each keystroke.
- Added inline highlight for search matches in title/body/deep-link text.

## Changed Files
- `apps/mobile/App.tsx`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_33.md`

## Behavior
- Search pipeline now uses debounced query (`220ms`) before filtering.
- Matching text segments are highlighted in:
  - inbox title
  - inbox body
  - deep-link preview
- Existing filter + sort + pagination flow remains intact.

## Notes
- Highlight is case-insensitive and client-side only.
