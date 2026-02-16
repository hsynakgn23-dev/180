# Mobile Phase-0 Package 4.6 (Deep-Link Store Fallback)

## Summary
- Added fallback behavior for web-to-app prompt deep-link open.
- If app open does not succeed quickly, user is redirected to platform store URL (or waitlist fallback).

## Changed Files
- `src/components/WebToAppPrompt.tsx`
- `.env.example`
- `README.md`
- `docs/CHECKPOINT_2026-02-07.md`

## Behavior
- `Open In App` first attempts mobile deep-link.
- After a short delay, fallback redirects only if page did not move to hidden state.
- Fallback source priority:
  1. iOS App Store URL (`VITE_MOBILE_APP_STORE_IOS_URL`) for iOS user-agents
  2. Android Store URL (`VITE_MOBILE_APP_STORE_ANDROID_URL`) for Android user-agents
  3. Any available store URL if platform cannot be detected
  4. `VITE_MOBILE_WAITLIST_URL`

## Analytics
- Existing event `web_to_app_prompt_clicked` now also records:
  - `action: "open_app_fallback"`
  - `fallbackSource: "ios_store" | "android_store" | "waitlist"`

## Validation
- `npm run lint`
- `npm run build`
