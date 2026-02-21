# Mobile Phase-1 Package 5.39 (Release-Readiness Gate)

## Summary
- Added a release-readiness checker for mobile Phase-1 rollout.
- Extended runbook with warn-mode and strict-mode release validation commands.
- Kept release checks aligned with existing Phase-1 QA gate.

## Changed Files
- `scripts/mobile-release-ready.mjs`
- `package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_39.md`

## Behavior
- New command: `npm run mobile:phase1:release:check`
  - runs `mobile:phase1:qa`
  - runs release checker in warn mode
- New command: `npm run mobile:phase1:release:check:strict`
  - same flow
  - treats warnings as failure
- Release checker validates:
  - app identity fields (`scheme`, Android package, iOS bundle id)
  - EAS `production` profile existence
  - EAS project id validity + parity (`.env` vs `app.json`)
  - endpoint shape (`https`, non-local host) with warning policy
  - push-on path requirements (`google-services.json` and app.json setting)

## Notes
- Warn mode is suitable for local/dev rehearsal.
- Strict mode is intended for pre-release CI/release-candidate checks.
