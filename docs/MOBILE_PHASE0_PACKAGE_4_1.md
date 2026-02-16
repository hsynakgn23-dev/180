# Mobile Phase 0 Package 4.1 (Deep-Link Contract on Web)

## Scope
- Added shared deep-link helper for mobile route intent parameters:
  - `src/domain/deepLinks.ts`
- Updated invite/share web URLs to append app-intent metadata:
  - `app_target`
  - `app_link`
- Wired share and invite builders to use the shared helper.

## Updated Files
- `src/domain/deepLinks.ts`
- `src/context/XPContext.tsx`
- `src/components/SharePromptModal.tsx`
- `src/features/profile/ProfileView.tsx`
- `.env.example`
- `README.md`

## Contract
- Default deep-link base: `absolutecinema://open`
- Override via env:
  - `VITE_MOBILE_DEEP_LINK_BASE`
- Target types:
  - `daily`
  - `invite`
  - `share`

## Why This Matters
- Mobile launch plan requires web-to-app path consistency.
- Shared deep-link contract reduces future branch-specific mapping logic.
- Existing web share links remain valid while carrying app intent hints.
