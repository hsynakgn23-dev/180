# Mobile Productization/UI Package 6.32 (Profile Movie Archive Parity)

## Summary
- Continued the mobile profile parity work after package `6.31`.
- Made watched-movie rows in the signed-in profile actionable.
- Added a mobile archive modal that shows ritual records and reply history for the selected film.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobileProfileMovieArchive.ts`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_32.md`

## What Changed
- `apps/mobile/src/lib/mobileProfileMovieArchive.ts`
  - adds a Supabase-backed reader for the signed-in user's ritual archive by movie title
  - resolves reply history from `ritual_replies`
  - normalizes archive records into a mobile-friendly shape
- `apps/mobile/App.tsx`
  - adds archive modal state and refresh/close handlers
  - opens the archive when a watched-movie row is pressed
  - emits `movie_archive_opened` and `movie_archive_failed`
  - bumps the visible mobile package label to `6.32`
- `apps/mobile/src/ui/appScreens.tsx`
  - adds `ProfileMovieArchiveModal`
  - shows poster, watch metadata, ritual entries, and nested replies in a read-only modal flow
- `apps/mobile/src/ui/appStyles.ts`
  - adds archive header, badge, entry-card, and action hint styles

## Rationale
- Web profile already exposes per-film comment history and reply context.
- Mobile profile only listed watched movies, so there was no way to inspect the historical ritual trail behind a title.
- This package closes that gap without introducing edit/delete complexity on mobile yet.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/lib/mobileProfileMovieArchive.ts`
