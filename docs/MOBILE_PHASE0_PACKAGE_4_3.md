# Mobile Phase 0 Package 4.3 (Screen-Map Contract)

## Scope
- Added shared screen-map resolver:
  - `src/domain/mobileScreenMap.ts`
- Updated deep-link builder to append resolved screen id:
  - `screen=daily_home | invite_claim | share_hub`
- Kept existing target params backward compatible.

## Updated Files
- `src/domain/mobileScreenMap.ts`
- `src/domain/deepLinks.ts`

## Screen Mapping
- `target=daily` -> `screen=daily_home`
- `target=invite` -> `screen=invite_claim`
- `target=share` -> `screen=share_hub`

## Why This Matters
- Mobile client can route from a stable `screen` id without ad-hoc mapping.
- Web-generated links and mobile parser now share route and screen intent model.
