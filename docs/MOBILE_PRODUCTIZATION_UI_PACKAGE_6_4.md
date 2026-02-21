# Mobile Productization/UI Package 6.4 (Typography + Mobile Minimal Ergonomics)

## Summary
- Applied web typography parity to mobile by loading and using Inter.
- Kept web color language unchanged and refined mobile ergonomics (touch target sizing).
- Updated Expo app shell defaults to dark to match the product's primary visual mode.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/primitives.tsx`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_4.md`

## Behavior
- Font parity:
  - `@expo-google-fonts/inter` added for mobile.
  - `Inter_400/500/600/700` loaded via `useFonts`.
  - Core text styles now use Inter families.
- Mobile-first minimal ergonomics:
  - `UiButton` min touch height: `44`
  - `UiChip` min touch height: `32`
  - Preserves existing visual hierarchy while improving finger-target usability.
- App shell parity:
  - `app.json` set to dark mode (`userInterfaceStyle: dark`)
  - splash/adaptive icon background aligned to `#121212`.

## Notes
- No product flow/business logic changes.
- Web design language is preserved; this package only improves mobile readability and touch ergonomics.
