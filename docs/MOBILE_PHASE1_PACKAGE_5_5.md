# Mobile Phase-1 Package 5.5 (Invite Claim API Integration)

## Summary
- Connected `invite_claim` screen to real `/api/referral/claim` backend endpoint.
- Added mobile referral API client with device-key persistence and Supabase session token usage.
- Added success/error state UI for invite claim with analytics events.
- Added lightweight mobile session card (email/password sign-in + sign-out) for local testing.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobileReferralApi.ts`
- `apps/mobile/.env.example`
- `README.md`

## Environment
- Required:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Optional:
  - `EXPO_PUBLIC_REFERRAL_API_BASE`
- If `EXPO_PUBLIC_REFERRAL_API_BASE` is missing, mobile derives API base from:
  - `EXPO_PUBLIC_ANALYTICS_ENDPOINT` or `EXPO_PUBLIC_DAILY_API_URL`

## Behavior
- Session card lets tester create Supabase session directly inside Expo app.
- Invite screen button now calls backend claim flow.
- Success path logs:
  - `invite_accepted`
  - `invite_reward_granted` (invitee and inviter when applicable)
- Failure path logs:
  - `invite_claim_failed` with mapped reason + error code
