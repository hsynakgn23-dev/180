# Mobile Phase-1 Package 5.41 (Release CI Strict Gate + Artifacts)

## Summary
- Upgraded mobile CI workflow from QA-only execution to strict release gate execution.
- Added automated release-check artifacts (JSON report + markdown checklist) for every CI run.
- Standardized a CI-specific release command for reproducible local/CI behavior.

## Changed Files
- `scripts/mobile-release-ready.mjs`
- `package.json`
- `.github/workflows/mobile-phase1-qa.yml`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_41.md`

## Behavior
- New command: `npm run mobile:phase1:release:check:ci`
  - runs `mobile:phase1:qa`
  - runs `mobile:release:env:sync`
  - runs strict release checker with artifact outputs:
    - `artifacts/mobile-release/release-ready-report.json`
    - `artifacts/mobile-release/release-checklist.md`
- `mobile-release-ready.mjs` now supports:
  - `--report-file=<path>` for JSON report output
  - `--checklist-file=<path>` for markdown checklist output
- GitHub workflow `mobile-phase1-qa.yml` now:
  - runs strict release gate command
  - uploads release artifacts (report/checklist + generated `apps/mobile/.env.release`) via `actions/upload-artifact`
  - uploads artifacts even if gate fails (`if: always()`).

## Notes
- Checklist/report artifacts make release failures diagnosable without rerunning locally.
- Strict gate remains aligned with existing local command chain and env sync logic.
