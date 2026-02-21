# Mobile Phase-1 Package 5.32 (Inbox Notification ID + Copy Link Action)

## Summary
- Added per-row notification id preview in mobile notification inbox.
- Added explicit `Link Kopyala` action for inbox rows with deep links.
- Integrated Expo clipboard module for reliable copy behavior on mobile runtime.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_32.md`

## Behavior
- Inbox row meta now includes a short notification id suffix (`id:xxxxxxxx`).
- For actionable rows (`deepLink` present), a new copy button is shown:
  - button label switches to `Kopyalandi` briefly after successful copy
  - rows without deep-link keep the button disabled

## Notes
- Clipboard implementation uses `expo-clipboard` SDK-compatible package.
