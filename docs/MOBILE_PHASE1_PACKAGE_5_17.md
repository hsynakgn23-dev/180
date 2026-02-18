# Mobile Phase-1 Package 5.17 (Env Doctor + Secret Guard)

## Summary
- Added env sync script for mobile public env values.
- Added env doctor script to validate required keys and block forbidden secret keys.
- Removed accidental `SUPABASE_SERVICE_ROLE_KEY` exposure from `apps/mobile/.env`.

## Changed Files
- `apps/mobile/.env`
- `scripts/mobile-env-sync.mjs`
- `scripts/mobile-env-doctor.mjs`
- `package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_17.md`

## Behavior
- `npm run mobile:env:sync`:
  - syncs allowed `EXPO_PUBLIC_*` keys into `apps/mobile/.env`
  - removes non-public/unsupported keys from `apps/mobile/.env`
- `npm run mobile:env:doctor`:
  - fails on forbidden secret keys in `apps/mobile/.env`
  - checks required mobile keys
  - warns on project id absence / emulator host mismatch

## Notes
- `apps/mobile/.env` should only contain `EXPO_PUBLIC_*` keys.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in root/server env, never mobile env.
