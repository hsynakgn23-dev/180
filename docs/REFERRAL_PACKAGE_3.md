# Referral Package 3 (Invite MVP)

## Scope
- Added invite code generation per account (`XPContext` state).
- Added invite claim flow with anti-abuse checks:
  - self-invite blocked
  - one invite claim per account
  - per-device daily claim limit
  - duplicate code reuse on same device blocked
- Added inviter/invitee reward split:
  - inviter: `+40 XP`
  - invitee: `+24 XP`
- Added URL-based invite capture (`?invite=CODE`) with auto-apply after auth.
- Added invite analytics events:
  - `invite_created`
  - `invite_clicked`
  - `invite_accepted`
  - `invite_reward_granted`
  - `invite_claim_failed`
- Added referral UI in `SettingsModal` session tab.
- Updated share payload links to include referral UTM + invite parameters.

## Key Files
- `src/context/XPContext.tsx`
- `src/features/profile/SettingsModal.tsx`
- `src/components/SharePromptModal.tsx`
- `src/features/profile/ProfileView.tsx`
- `src/lib/analytics.ts`

## Notes
- This MVP uses client-side local persistence for invite registry/guards.
- Cloud-backed referral settlement can be layered in next package using `referral_invites` and `referral_claims`.
