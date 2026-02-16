# Mobile Phase 0 Package 4 (Shared Analytics Contract)

## Scope
- Extracted analytics event name union into shared domain layer:
  - `src/domain/analyticsEvents.ts`
- Wired web analytics client to consume shared type:
  - `src/lib/analytics.ts`
- Established a single source of truth for event schema before React Native build.

## Why This Matters
- Phase 0 requires mobile analytics schema to match web events.
- Shared contract prevents drift between web and mobile tracking names.
- Funnel and KPI queries remain stable across platforms.

## Added Files
- `src/domain/analyticsEvents.ts`

## Updated Files
- `src/lib/analytics.ts`

## Next Mobile Steps
1. Reuse `src/domain/analyticsEvents.ts` in Expo app package.
2. Mirror `trackEvent` payload shape for mobile (`eventName`, `eventTime`, `userId`, `properties`).
3. Add deep-link event coverage (`app_opened_from_invite`, `app_opened_from_share`) once mobile routes exist.
