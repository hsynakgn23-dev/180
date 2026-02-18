# Mobile Phase-1 Package 5.25 (GitHub Actions QA Automation)

## Summary
- Added GitHub Actions workflow to run Phase-1 mobile QA checks on `push` and `pull_request`.
- CI now executes the same local QA chain (`mobile:phase1:qa`) with deterministic CI-safe env bootstrap.

## Changed Files
- `.github/workflows/mobile-phase1-qa.yml`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_25.md`

## Behavior
- Workflow name: `mobile-phase1-qa`
- Triggers:
  - `pull_request` to `main`
  - `push` to `main`
  - Scoped to mobile/shared-mobile/scripts/package manifests/workflow file changes
- Steps:
  1) Checkout
  2) Node 22 setup with npm cache
  3) `npm ci` (root)
  4) `npm --prefix apps/mobile ci` (mobile)
  5) Write CI `.env` placeholders required by readiness checks
  6) `npm run mobile:phase1:qa`

## Notes
- CI intentionally runs push-haric QA; adb/emulator deep-link smoke is not part of hosted runner flow.
