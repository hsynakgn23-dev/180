# Mobile Phase-1 Package 5.18 (EAS Project ID Sync)

## Summary
- Added one-command sync for Expo EAS project id into mobile env/config.
- Reduced manual setup errors for remote push token registration.

## Changed Files
- `scripts/mobile-eas-projectid-sync.mjs`
- `package.json`
- `apps/mobile/package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_18.md`

## Behavior
- `npm run mobile:eas:projectid:sync`:
  - reads EAS project info via `eas-cli project:info --json`
  - extracts project UUID
  - writes `EXPO_PUBLIC_EXPO_PROJECT_ID` into `apps/mobile/.env`
  - writes `expo.extra.eas.projectId` into `apps/mobile/app.json`
- If login/link is missing, command fails with explicit next steps (`login`, `project:init`).

## Notes
- Command is idempotent; it can be run multiple times safely.
- Requires authenticated EAS session for first successful sync.
