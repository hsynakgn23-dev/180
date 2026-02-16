# Mobile Phase-0 Package 4.4 (Web-to-App Prompt)

## Summary
- Added high-intent web-to-app prompt surface for authenticated users.
- Prompt visibility now follows a shared contract:
  - show for `streak >= 3` with `share/streak` intent
  - show for `dailyRitualsCount >= 1` with `share/comment` intent
- Prompt emits analytics for view, click, and dismiss actions.

## Changed Files
- `src/domain/mobileWebPromptContract.ts`
- `src/components/WebToAppPrompt.tsx`
- `src/domain/deepLinks.ts`
- `src/domain/analyticsEvents.ts`
- `src/App.tsx`
- `.env.example`
- `README.md`

## Notes
- Prompt dismissal is client-side (`localStorage`) with a 48-hour cooldown.
- Optional waitlist CTA uses `VITE_MOBILE_WAITLIST_URL`; if unset, CTA is hidden.
- Deep-link generation uses shared route + screen contracts to keep web/mobile intent in sync.

## Validation
- `npm run lint`
- `npm run build`
