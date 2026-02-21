# Mobile Productization/UI Package 6.8 (Visible UI Polish Within Web Design Guardrails)

## Summary
- Applied visible mobile UI polish while keeping the web design language as source of truth.
- Preserved color/token system (dark base + sage/clay accents), Inter typography, and minimal layout logic.
- Increased card hierarchy clarity with subtle accent strips and stronger spacing rhythm.
- Added hero status badges so the active screen/session state is visible at a glance.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appStyles.ts`
- `apps/mobile/src/ui/appScreens.tsx`
- `README.md`
- `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_8.md`

## Behavior
- Hero area now shows:
  - current screen badge (`Screen: ...`)
  - session state badge (`Session: ready/required`)
- Core cards (`Session`, `Push`, `Inbox`, `Profile`, `Daily`, `Ritual`, `Invite`, `Share`) now render through a shared `ScreenCard` wrapper with:
  - small sage/clay accent strip
  - slightly refined card spacing and depth
- Manual route action row (`Daily/Invite/Share`) is now visually grouped with a bordered surface container.

## Design Guardrail Compliance
- No new palette family introduced.
- Existing allowed tokens are preserved (`#121212`, `#171717`, `#1f1f1f`, `#8A9A5B`, `#A57164`, `#E5E4E2`, `#8e8b84` and existing support colors).
- Typography remains Inter-based with existing hierarchy weights.

## Validation
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/ui/appScreens.tsx`
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
