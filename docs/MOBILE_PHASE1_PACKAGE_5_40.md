# Mobile Phase-1 Package 5.40 (Release Env Profile Sync)

## Summary
- Added a dedicated release env profile generator for mobile (`apps/mobile/.env.release`).
- Wired release-check commands to validate against generated release profile instead of local dev `.env`.
- Documented release override keys to make strict pre-release checks reproducible.

## Changed Files
- `scripts/mobile-release-env-sync.mjs`
- `scripts/mobile-release-ready.mjs`
- `package.json`
- `.env.example`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_40.md`

## Behavior
- New command: `npm run mobile:release:env:sync`
  - reads root `.env` + mobile `.env`
  - writes ordered `apps/mobile/.env.release`
  - prefers `MOBILE_RELEASE_*` overrides when present
- Updated release checks:
  - `npm run mobile:phase1:release:check`
  - `npm run mobile:phase1:release:check:strict`
  - both now run `mobile:release:env:sync` before `mobile-release-ready`
  - checker target env is `apps/mobile/.env.release` via `--env-file=...`
- `mobile-release-ready` supports `--env-file` so CI/local can validate different env profiles.

## Notes
- Local development env noise is isolated from release-readiness checks.
- `apps/mobile/.env.release` is generated and can be refreshed before every RC/CI run.
