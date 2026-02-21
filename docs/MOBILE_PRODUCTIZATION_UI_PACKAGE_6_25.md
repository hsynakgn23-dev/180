# Mobile Productization/UI Package 6.25 (Explore Parity + Rule Background)

## Summary
- Added a new `Kesif` tab to carry core web surfaces into mobile runtime.
- Removed circular sage/clay backdrop orbs and replaced them with a rule-based layered background.
- Preserved existing color token and typography parity guardrails.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `apps/mobile/.env.example`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_25.md`

## Behavior
- New `Kesif` tab now includes:
  - `Kesif Rotalari` card (`Mood Films`, `Director Deep Dives`, `Daily Curated Picks`)
  - `Arena Ozeti` card with quick jump back to `Gunluk` flow
  - `Platform Kurallari` card aligned with web manifesto/rules language
- Route open actions use resolved web base URL when available:
  - `EXPO_PUBLIC_WEB_APP_URL`
  - fallback: referral/analytics/daily-derived base
- Background shell update:
  - removed circular ambient orbs
  - added non-circular layered rule background (top/bottom bands + guide lines)

## Why This Package
- User feedback highlighted missing web surfaces in mobile.
- Circular backdrop treatment was no longer aligned with current visual direction request.
- This package increases perceived product completeness while staying within existing design token policy.

## Design Guardrail Compliance
- No new color family introduced.
- Existing dark + sage/clay token family preserved.
- Inter typography preserved.
- Mobile design parity policy preserved.

## Validation
- `npx tsc --noEmit` (run in `apps/mobile`)
- `npm run test:mobile:design:parity`
