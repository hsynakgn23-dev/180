# Mobile Phase-1 Package 5.30 (QA Gate Extension: Push Inbox Smoke)

## Summary
- Extended the Phase-1 QA chain to include push inbox dedupe smoke validation.
- Ensured CI `mobile:phase1:qa` now fails if inbox merge/dedupe behavior regresses.

## Changed Files
- `package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_30.md`

## Behavior
- `npm run mobile:phase1:qa` now runs:
  1) `mobile:ready`
  2) mobile typecheck
  3) shared contract smoke
  4) push inbox smoke
  5) lint
  6) build

## Notes
- Existing GitHub Actions workflow already calls `mobile:phase1:qa`, so no workflow file change was required.
