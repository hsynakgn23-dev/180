# Test Plan: Referral 3.1 API Hardening

Date: 2026-02-15

## Goal
Validate server-backed referral invite creation and claim settlement after migration `20260217_referral_hardening_rpc.sql`.

## Coverage
1. Invite code creation idempotency (same user gets same code).
2. Invite claim success path (+24 invitee XP, +40 inviter XP).
3. Self-invite block by user id and by email.
4. One claim per invitee account (`ALREADY_CLAIMED`).
5. Device daily limit (`DEVICE_DAILY_LIMIT`).
6. Same device + same code same day block (`DEVICE_CODE_REUSE`).
7. API-first client behavior in `XPContext` with clear error mapping.
8. Data integrity across `referral_invites`, `referral_claims`, `referral_device_claims`.

## Preconditions
1. SQL migrations applied in order:
- `sql/migrations/20260216_referral_program.sql`
- `sql/migrations/20260217_referral_hardening_rpc.sql`
2. App/server env configured:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`)
3. Two test users exist:
- User A (inviter)
- User B (invitee)

## Manual Scenarios
1. Invite create (user A)
- Login as user A.
- Open settings invite section (or trigger auto code creation).
- Expected:
- Invite code shown.
- Repeating create action returns same code.
- `invite_claims_count` stays unchanged.

2. Invite click + pending capture (user B browser session)
- Open app with `?invite=<CODE>&utm_source=invite`.
- Expected:
- Pending code is captured.
- `invite_clicked` analytics event is emitted once per session/code pair.

3. Invite claim success (user B)
- Login as user B and apply user A code.
- Expected:
- Claim succeeds.
- User B gains +24 XP.
- User A gains +40 XP.
- `invitedByCode` is set on user B.
- Pending invite code is cleared.

4. Account already claimed block
- While still user B, try any other valid code.
- Expected:
- Claim fails with message mapped from `ALREADY_CLAIMED`.
- No new row in `referral_claims` for user B.

5. Self invite block
- Login as user A and try own code.
- Expected:
- Claim fails with mapped self-invite message.
- No extra row in `referral_claims`.

6. Same device same code reuse block
- Use a fresh user C on same browser/device.
- Claim user A code once (success).
- Try same code again from same device for same day.
- Expected:
- Second attempt fails with `DEVICE_CODE_REUSE`.

7. Device daily cap
- On same device/day, use additional fresh accounts (D/E/F) and claim up to 3 total claims.
- Attempt 4th claim on same day.
- Expected:
- 4th attempt fails with `DEVICE_DAILY_LIMIT`.

8. API unavailable fallback sanity (optional)
- Temporarily make referral API unreachable.
- Try claim in a non-production-safe environment.
- Expected:
- Client logs `invite_claim_failed` with `api_unavailable`.
- Local fallback logic handles only local-mode path.

## API Smoke Snippets
```bash
# Create invite code (Bearer token: logged-in user A access token)
curl -X POST "https://<app-domain>/api/referral/create" \
  -H "content-type: application/json" \
  -H "authorization: Bearer <ACCESS_TOKEN_A>" \
  -d '{"seed":"userA"}'

# Claim invite code (Bearer token: logged-in user B access token)
curl -X POST "https://<app-domain>/api/referral/claim" \
  -H "content-type: application/json" \
  -H "authorization: Bearer <ACCESS_TOKEN_B>" \
  -d '{"code":"<INVITE_CODE>","deviceKey":"dev-smoke-001"}'
```

## Scripted Smoke Runner
```bash
# create only
npm run test:referral:smoke:create

# claim only (requires code)
npm run test:referral:smoke:claim -- --code=ABC12345

# full create + claim + duplicate rejection probe
npm run test:referral:smoke:e2e
```

## SQL Verification Snippets
```sql
-- Invite codes
select code, inviter_user_id, inviter_email, claim_count, created_at, updated_at
from public.referral_invites
order by updated_at desc
limit 20;

-- Claims (one row per invitee account expected)
select code, invitee_user_id, invitee_email, inviter_reward_xp, invitee_reward_xp, created_at
from public.referral_claims
order by created_at desc
limit 50;

-- Device guards
select device_key, claim_date, code, invitee_user_id, created_at
from public.referral_device_claims
order by created_at desc
limit 100;

-- Duplicates should be zero
select invitee_user_id, count(*)
from public.referral_claims
group by invitee_user_id
having count(*) > 1;
```

## Exit Criteria
1. All mandatory scenarios pass.
2. No duplicate invitee claims found.
3. API error codes map to expected UI messages.
4. XP changes and claim counts match reward config:
- inviter: `+40`
- invitee: `+24`
