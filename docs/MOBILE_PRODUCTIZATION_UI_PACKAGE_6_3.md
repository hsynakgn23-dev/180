# Mobile Productization/UI Package 6.3 (Web Design Parity Guardrails)

## Summary
- Re-aligned mobile UI palette to the web design language (dark surface + sage/clay accents).
- Removed warm custom palette drift introduced in productization kickoff.
- Added an automated design-parity guard so unapproved palette drift fails QA.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/theme.ts`
- `scripts/mobile-design-parity-check.mjs`
- `package.json`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_3.md`

## Behavior
- Mobile colors now follow web tokens:
  - base: `#121212`, `#171717`, `#1f1f1f`
  - text: `#E5E4E2`, `#8e8b84`
  - accents: `#8A9A5B` (sage), `#A57164` (clay)
- New QA gate:
  - `npm run test:mobile:design:parity`
  - validates `apps/mobile/App.tsx`, `apps/mobile/src/ui/theme.ts`, `apps/mobile/src/ui/primitives.tsx`
  - fails if disallowed hex colors appear or required web tokens are missing
- `mobile:phase1:qa` now includes the design parity check.

## Notes
- This package formalizes "web-first design rules" for mobile to prevent accidental visual divergence.
