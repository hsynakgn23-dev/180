# UI i18n + Mobile Consistency Audit (2026 Q1 / P1)

## Scope
- Global UI text audit for hardcoded English labels in app shell and prompt components.
- Mobile consistency pass for web-to-app prompt action layout.

## Changes
- Localized discover and loading/error labels in:
  - `src/App.tsx`
- Localized SEO footer link labels in:
  - `src/components/InfoFooter.tsx`
- Localized web-to-app prompt copy and improved mobile button layout:
  - `src/components/WebToAppPrompt.tsx`
- Extended dictionary contract and language entries:
  - `src/i18n/dictionary.ts`

## i18n Coverage Added
- Discover panel labels.
- Daily/Arena loading and fallback strings.
- Web-to-app prompt badge/title/subtitle/actions.

## Mobile UI Consistency
- Prompt action buttons now stack full-width on small screens and switch to inline row on `sm+`.
- Reduces uneven wrapping and improves touch targeting.

## Validation
- `npm run lint`
- `npm run build`
