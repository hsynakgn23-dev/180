# Mobile Phase 0 Package 4.2 (Route-Map Contract)

## Scope
- Added shared mobile route intent contract:
  - `src/domain/mobileRouteContract.ts`
- Added normalize/encode/parse helpers for deep-link payloads.
- Updated deep-link helper to consume route contract instead of duplicating rules.

## Updated Files
- `src/domain/mobileRouteContract.ts`
- `src/domain/deepLinks.ts`

## Route Targets
- `daily`
- `invite`
- `share`

## Share Params
- `platform`: `instagram | tiktok | x`
- `goal`: `comment | streak`
- `invite`: optional invite code

## Why This Matters
- Mobile app can parse links with the same rules used by web link generation.
- Prevents drift in target naming and param validation before Expo implementation.
