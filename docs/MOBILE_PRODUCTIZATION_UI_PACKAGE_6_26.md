# Mobile Productization/UI Package 6.26 (Arena Leaderboard + Public Profile Bridge)

## Summary
- Continued `Kesif` expansion to close additional web/mobile feature gaps.
- Added Arena leaderboard surface with live Supabase-first data and fallback mode.
- Added direct public profile bridge flow from mobile to web profile routes.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobileArenaSnapshot.ts`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_26.md`

## Behavior
- `Kesif` tab now includes:
  - `Arena Leaderboard` card
    - reads top active authors from recent rituals
    - enriches with echo counts when available
    - falls back to deterministic snapshot list when live read is unavailable
  - `Public Profile Gecisi` card
    - username input -> web public profile hash route generation (`#/u/name:<username>`)
    - opens external profile target directly from mobile
- Leaderboard rows include profile open action when route URL can be built.
- `UI Package` label updated to `6.26`.

## Why This Package
- Previous package added discovery/rules shell but Arena depth and profile transitions were still shallow.
- This package makes the Explore surface actionable and closer to web behavior.

## Design Guardrail Compliance
- No new color family introduced.
- Existing dark + sage/clay token family preserved.
- Inter typography preserved.
- Mobile design parity policy preserved.

## Validation
- `npx tsc --noEmit` (run in `apps/mobile`)
- `npm run test:mobile:design:parity`
