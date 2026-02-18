# Mobile Phase-1 Package 5.19 (Readiness Runner)

## Summary
- Added one-command readiness runner for mobile push/dev-client setup checks.
- Bundled env sync + project id sync + env doctor + final checklist in a single command.

## Changed Files
- `scripts/mobile-ready.mjs`
- `package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_19.md`

## Behavior
- `npm run mobile:ready` now executes:
  1) `mobile:env:sync`
  2) `mobile:eas:projectid:sync`
  3) `mobile:env:doctor`
  4) `scripts/mobile-ready.mjs`
- Final checklist validates:
  - mobile/root env presence
  - required mobile public keys
  - project id validity and parity (`.env` vs `app.json`)
  - secret leak guard in mobile env
  - push API and migration file presence
  - server service-role key presence in root env

## Notes
- Goal is to reduce setup drift and make “can I run remote push today?” answerable with one command.
