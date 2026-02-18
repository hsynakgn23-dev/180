# Mobile Phase-1 Package 5.22 (Dev Client Port Alignment)

## Summary
- Normalized Android dev-client Metro flow to port `8081`.
- Removed emulator-only hostname override from dev-client start script.
- Added explicit `adb reverse` guidance for emulator dev-client usage.

## Changed Files
- `package.json`
- `README.md`
- `docs/MOBILE_PHASE1_PACKAGE_5_22.md`

## Behavior
- `npm run mobile:devclient:start` now starts on `:8081`.
- Emulator dev-client flow is now explicit:
  - `adb reverse --remove-all`
  - `adb reverse tcp:8081 tcp:8081`

## Notes
- This package is workflow hardening only.
- Remote push token still requires physical device + dev client.
