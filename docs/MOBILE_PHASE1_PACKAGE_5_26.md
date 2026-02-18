# Mobile Phase-1 Package 5.26 (Shared Contract Smoke Gate)

## Summary
- Added runtime smoke checks for shared mobile route/deep-link/web-prompt contracts.
- Wired the contract smoke into `mobile:phase1:qa` so regressions fail earlier.

## Changed Files
- `scripts/mobile-contract-smoke.mjs`
- `package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_26.md`

## Behavior
- New script: `npm run test:mobile:contracts`
  - Runs with `tsx` (TypeScript-aware Node runner).
  - Imports shared TypeScript contract modules directly.
  - Validates:
    - invite normalization rules
    - route encode/parse roundtrip
    - screen-map resolution
    - deep-link build/parse behavior
    - web-to-app prompt decision branches
    - analytics event list uniqueness + required funnel events
- `mobile:phase1:qa` now includes this contract smoke step before lint/build.

## Notes
- This test is runner-safe (no adb/emulator requirement) and suitable for CI.
