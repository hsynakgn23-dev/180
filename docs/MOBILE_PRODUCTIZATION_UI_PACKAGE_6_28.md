# Mobile Productization/UI Package 6.28 (Share Reward Parity)

## Summary
- Continued the mobile share flow after package `6.27`.
- Added mobile cloud sync for the daily share reward so the share hub now updates `profiles.xp_state`.
- Wired mobile analytics to emit `share_reward_claimed` and `share_reward_denied`.

## Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobileShareRewardSync.ts`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_28.md`

## What Changed
- `apps/mobile/App.tsx`
  - keeps the native share flow from `6.27`
  - claims the daily share reward after the native share sheet opens successfully
  - refreshes mobile profile stats after a reward is granted
  - emits `share_reward_claimed` and `share_reward_denied`
  - updates the share hub status copy to reflect reward success, already-claimed state, or sync failure
- `apps/mobile/src/lib/mobileShareRewardSync.ts`
  - reads the signed-in mobile user from Supabase session
  - reads `profiles.xp_state`
  - blocks duplicate same-day share rewards via `lastShareRewardDate`
  - preserves existing xp state keys while merging fallback profile/comment data
  - writes `totalXP` and `lastShareRewardDate` back to `profiles.xp_state`

## Rationale
- The mobile parity audit still showed the share bonus logic as incomplete on mobile.
- Package `6.27` made the share route usable, but it still did not award the XP bonus that web users receive.
- This package closes that gap without changing the existing share UI surface.

## Validation
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run build`
- `npm run lint`
