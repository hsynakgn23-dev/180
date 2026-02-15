# Referral Package 3.1 (Server Hardening)

## Scope
- Switched invite claim flow to API-first with local fallback only when API is unavailable.
- Added authenticated referral API helpers in client:
  - `ensureInviteCodeViaApi`
  - `claimInviteCodeViaApi`
  - `getReferralDeviceKey`
- Added referral API routes:
  - `POST /api/referral/create`
  - `POST /api/referral/claim`
- Added SQL hardening migration:
  - device-level guard table (`referral_device_claims`)
  - server-side RPC settlement functions:
    - `get_or_create_referral_invite(...)`
    - `claim_referral_invite(...)`

## Key Files
- `src/context/XPContext.tsx`
- `src/lib/referralApi.ts`
- `src/features/profile/SettingsModal.tsx`
- `api/referral/create.ts`
- `api/referral/claim.ts`
- `sql/migrations/20260217_referral_hardening_rpc.sql`

## Behavior Changes
- `claimInviteCode` is now async and calls server API first when Supabase is live.
- Auto-claim from pending URL invite now runs with async flow.
- Settings invite apply action now awaits async claim result.
- API error codes are mapped to user-facing messages and analytics failure reasons.

## Deployment Notes
- Run migration `sql/migrations/20260217_referral_hardening_rpc.sql` after `20260216_referral_program.sql`.
- Ensure server env has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`).
