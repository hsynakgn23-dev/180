# Mobile Productization/UI Package 6.33 (Public Profile Movie Archive Parity)

## Summary
- Continued the mobile public profile parity work after package `6.32`.
- Made public watched-movie rows actionable instead of passive.
- Added a public movie archive modal that reuses loaded profile activity to show per-film comments.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_33.md`

## What Changed
- `apps/mobile/App.tsx`
  - extends public watched-movie summaries with `posterPath`
  - adds public movie archive modal state and open/refresh/close handlers
  - groups existing `publicProfileFullState.items` by selected film title/year
  - emits `public_movie_archive_opened` and `public_movie_archive_failed`
  - bumps the visible mobile package label to `6.33`
- `apps/mobile/src/ui/appScreens.tsx`
  - adds `PublicProfileMovieArchiveModal`
  - shows poster, profile label, watch metadata, and filtered public comments for the selected film

## Rationale
- Web public profile already exposes a film archive surface, but mobile public watched movies were still static rows.
- The required comment data was already loaded on mobile, so opening a film archive should not depend on a new backend call.
- This package closes the public film drill-down gap with a cheap local grouping step and keeps the flow fast.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx`
