# 180 Absolute Cinema

Single-page film ritual app built with React + TypeScript + Vite.

## Stack
- React 19
- TypeScript 5
- Vite 7
- Supabase (Auth, Postgres, Storage)
- Tailwind CSS

## Local Setup
1. Install dependencies:
```bash
npm install
```
2. Create/update `.env` with required values (see Environment section).
  Use `.env.example` as the baseline template.
3. Run dev server:
```bash
npm run dev
```

## Scripts
- `npm run dev` - start Vite dev server
- `npm run lint` - run ESLint
- `npm run build` - run TypeScript build + Vite production build
- `npm run analyze` - build with bundle visualizer output (`dist/bundle-analysis.html`)
- `npm run preview` - preview production build locally
- `npm run mobile:start` - start Expo dev server (`apps/mobile`) on `10.0.2.2:8090`
- `npm run mobile:android` - open Expo app on Android emulator/device on `10.0.2.2:8090`
- `npm run mobile:stack` - alias of `mobile:android` (local Expo loop)
- `npm run mobile:devclient:start` - start Expo dev server for custom dev client on `:8081` (`--dev-client`)
- `npm run mobile:devclient:android` - build/run Android dev client locally (`expo run:android`)
- `npm run mobile:eas:android:development` - trigger EAS Android development build (`apps/mobile/eas.json`)
- `npm run mobile:env:sync` - sync public mobile env values from root `.env` into `apps/mobile/.env`
- `npm run mobile:env:doctor` - validate mobile env and detect forbidden secret keys
- `npm run mobile:eas:projectid:sync` - read EAS project id and write it to `apps/mobile/.env` + `apps/mobile/app.json`
- `npm run mobile:ready` - run full mobile readiness chain (`env:sync`, `projectid:sync`, `env:doctor`, final checklist)
- `npm run mobile:phase1:qa` - run push-haric phase-1 QA chain (`mobile:ready`, mobile typecheck, mobile contract smoke, lint, build)
- `npm run mobile:phase1:smoke:no-push` - run push-haric QA + deep-link runtime smoke + referral e2e smoke (fresh invitee)
- `node test-supabase-connection.js` - quick Supabase read/write capability check
- `npm run test:referral:smoke:create` - sign in inviter + verify `/api/referral/create`
- `npm run test:referral:smoke:claim -- --code=ABC12345` - sign in invitee + verify `/api/referral/claim`
- `npm run test:referral:smoke:e2e` - create + claim + duplicate-claim rejection (`ALREADY_CLAIMED`)
- `npm run test:referral:smoke:e2e:fresh` - create temporary invitee, then run e2e claim flow
- `npm run test:mobile:deeplink:smoke` - dispatch mobile deep links via `adb` and scan runtime logs for crash signals
- `npm run test:mobile:contracts` - validate shared mobile route/deep-link/prompt contracts via Node smoke cases

## Mobile (Expo)
- Expo app root: `apps/mobile`
- Shared mobile contracts: `packages/shared/src/mobile`
- Expo Go on SDK 53+ does not support remote push token flow. Use dev client for remote push tests.
- Android remote push icin Firebase `google-services.json` zorunlu:
  - `apps/mobile/google-services.json` dosyasini koy
  - Android package adi Firebase'de `com.hsyna.absolutecinema` olmali
- Troubleshooting (Firebase init):
  - Hata: `Default FirebaseApp is not initialized`
  - Push'i gecici kapat: `EXPO_PUBLIC_PUSH_ENABLED=0`
  - Push acik akisa don: `google-services.json` + `app.json/android.googleServicesFile` + `npm run mobile:devclient:android` ile native rebuild
- Run:
```bash
npm run mobile:stack
```
- Dev client flow (Android):
```bash
npm run mobile:ready
npm run mobile:devclient:android
npm run mobile:devclient:start
npm run mobile:eas:projectid:sync
```
- Dev client (emulator) icin port koheransi:
```bash
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081
```
- If imports from `packages/shared` fail, ensure Metro picks up workspace config from `apps/mobile/metro.config.js`.

## Environment
Client:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET` (optional, default `posters`)
- `VITE_AUTH_REDIRECT_TO` (optional, OAuth redirect override)
- `VITE_TMDB_API_KEY` (optional fallback path)
- `VITE_TMDB_API_DISABLED` (`0` enables client TMDB fallback, default disabled)
- `VITE_IMAGE_MODE` (optional image proxy mode)
- `VITE_IMAGE_PROXIES` (optional comma-separated proxy templates)
- `VITE_ENABLE_DEBUG_PANEL` (`0` disables debug panel in dev)
- `VITE_ENABLE_MOCK_NOTIFICATIONS` (`1` enables seeded notifications in dev)
- `VITE_ALLOW_CLIENT_DAILY_WRITE` (`1` enables client write path in dev only)
- `VITE_DAILY_ROLLOVER_TIMEZONE` (optional, default `Europe/Istanbul`)
- `VITE_ANALYTICS_ENABLED` (`0` disables analytics event tracking)
- `VITE_ANALYTICS_ENDPOINT` (optional, default `/api/analytics`)
- `VITE_PUBLIC_APP_URL` (optional canonical app origin for share/invite links)
- `VITE_REFERRAL_API_BASE` (optional, default same-origin API)
- `VITE_MOBILE_DEEP_LINK_BASE` (optional, default `absolutecinema://open`)
- `VITE_MOBILE_WAITLIST_URL` (optional, used by web-to-app mobile prompt CTA)
- `VITE_MOBILE_APP_STORE_IOS_URL` (optional iOS fallback URL when deep link open fails)
- `VITE_MOBILE_APP_STORE_ANDROID_URL` (optional Android fallback URL when deep link open fails)

Mobile client (`apps/mobile`):
- `EXPO_PUBLIC_ANALYTICS_ENDPOINT` (required for mobile app-open/session analytics ingest, use absolute URL)
- `EXPO_PUBLIC_ANALYTICS_ENABLED` (optional, default `1`; set `0` to disable mobile analytics emit in local dev)
- `EXPO_PUBLIC_DAILY_API_URL` (optional absolute URL; if empty mobile derives `/api/daily` from analytics endpoint)
- `EXPO_PUBLIC_SUPABASE_URL` (required for mobile invite claim auth session checks)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (required for mobile invite claim auth session checks)
- `EXPO_PUBLIC_REFERRAL_API_BASE` (optional absolute API base; if empty mobile derives from analytics/daily endpoint)
- `EXPO_PUBLIC_PUSH_ENABLED` (optional, default `0`; set `1` to enable push register/test flow)
- `EXPO_PUBLIC_PUSH_API_BASE` (optional absolute API base for `/api/push/test`; if empty mobile falls back to referral/analytics/daily-derived base)
- `EXPO_PUBLIC_EXPO_PROJECT_ID` (recommended on SDK 53+ for Expo push token registration in dev client builds)

Server/cron (`api/cron/daily.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (optional, default `posters`)
- `TMDB_API_KEY`
- `DAILY_ROLLOVER_TIMEZONE` (optional, default `Europe/Istanbul`)

Server analytics ingest (`api/analytics.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Server referral API (`api/referral/create.ts`, `api/referral/claim.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY` fallback)
- `PUBLIC_APP_URL` (optional absolute origin for invite links)

Server push test API (`api/push/test.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY` fallback)

Referral smoke runner (`test-referral-smoke.js`, optional):
- `REFERRAL_API_BASE` (e.g. `https://your-app-domain`)
- `REFERRAL_TEST_INVITER_EMAIL`
- `REFERRAL_TEST_INVITER_PASSWORD`
- `REFERRAL_TEST_INVITEE_EMAIL`
- `REFERRAL_TEST_INVITEE_PASSWORD`
- `REFERRAL_TEST_DEVICE_KEY` (optional; deterministic device simulation)
- `REFERRAL_TEST_CODE` (optional for claim-only mode)

Optional edge-friendly cache (`api/daily.ts`, Redis/KV REST):
- `KV_REST_API_URL` or `UPSTASH_REDIS_REST_URL`
- `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_TOKEN`

## Supabase Rollout
- Base setup SQL: `supabase_setup.sql`
- Social migration SQL: `sql/migrations/20260207_social_model_v2.sql`
- Rate limit migration SQL: `sql/migrations/20260213_rate_limits.sql`
- Analytics migration SQL: `sql/migrations/20260215_analytics_events.sql`
- Analytics KPI views SQL: `sql/migrations/20260218_analytics_kpi_views.sql`
- Web-to-app prompt KPI SQL: `sql/migrations/20260219_web_to_app_prompt_kpis.sql`
- Mobile app-open analytics SQL: `sql/migrations/20260220_mobile_app_open_views.sql`
- Mobile push profile-state SQL: `sql/migrations/20260221_mobile_push_profile_state.sql`
- Referral migration SQL: `sql/migrations/20260216_referral_program.sql`
- Referral hardening SQL: `sql/migrations/20260217_referral_hardening_rpc.sql`
- Rollout checklist: `docs/ROLLOUT_SOCIAL_MODEL.md`
- Test checklist: `docs/TEST_PLAN_SOCIAL_SYNC.md`
- Referral test checklist: `docs/TEST_PLAN_REFERRAL_3_1.md`
- Integration plan: `PLAN_SUPABASE_INTEGRATION.md`
- Analytics package notes: `docs/ANALYTICS_PACKAGE_1.md`
- KPI dashboard notes: `docs/KPI_DASHBOARD_2026Q1.md`
- Referral package notes: `docs/REFERRAL_PACKAGE_3.md`
- Referral hardening notes: `docs/REFERRAL_PACKAGE_3_1.md`
- Referral 3.1 test checklist: `docs/TEST_PLAN_REFERRAL_3_1.md`
- Mobile phase-0 package notes: `docs/MOBILE_PHASE0_PACKAGE_4.md`
- Mobile phase-0 deep-link package notes: `docs/MOBILE_PHASE0_PACKAGE_4_1.md`
- Mobile phase-0 route-map package notes: `docs/MOBILE_PHASE0_PACKAGE_4_2.md`
- Mobile phase-0 screen-map package notes: `docs/MOBILE_PHASE0_PACKAGE_4_3.md`
- Mobile phase-0 web-to-app prompt package notes: `docs/MOBILE_PHASE0_PACKAGE_4_4.md`
- Mobile phase-0 prompt KPI package notes: `docs/MOBILE_PHASE0_PACKAGE_4_5.md`
- Mobile phase-0 app-store fallback package notes: `docs/MOBILE_PHASE0_PACKAGE_4_6.md`
- Mobile phase-1 bootstrap + shared contract notes: `docs/MOBILE_PHASE1_PACKAGE_5_1.md`
- Mobile phase-1 deep-link intake + app-open analytics notes: `docs/MOBILE_PHASE1_PACKAGE_5_2.md`
- Mobile phase-1 screen flow + safe-area notes: `docs/MOBILE_PHASE1_PACKAGE_5_3.md`
- Mobile phase-1 daily API integration notes: `docs/MOBILE_PHASE1_PACKAGE_5_4.md`
- Mobile phase-1 invite claim integration notes: `docs/MOBILE_PHASE1_PACKAGE_5_5.md`
- Mobile phase-1 daily offline cache notes: `docs/MOBILE_PHASE1_PACKAGE_5_6.md`
- Mobile phase-1 ritual draft queue notes: `docs/MOBILE_PHASE1_PACKAGE_5_7.md`
- Mobile phase-1 profile snapshot notes: `docs/MOBILE_PHASE1_PACKAGE_5_8.md`
- Mobile phase-1 Expo push baseline notes: `docs/MOBILE_PHASE1_PACKAGE_5_9.md`
- Mobile phase-1 push cloud sync notes: `docs/MOBILE_PHASE1_PACKAGE_5_10.md`
- Mobile phase-1 push test dispatch notes: `docs/MOBILE_PHASE1_PACKAGE_5_11.md`
- Mobile phase-1 push receipt verify notes: `docs/MOBILE_PHASE1_PACKAGE_5_12.md`
- Mobile phase-1 emulator local push sim notes: `docs/MOBILE_PHASE1_PACKAGE_5_13.md`
- Mobile phase-1 Expo Go stability notes: `docs/MOBILE_PHASE1_PACKAGE_5_14.md`
- Mobile phase-1 analytics circuit-breaker notes: `docs/MOBILE_PHASE1_PACKAGE_5_15.md`
- Mobile phase-1 dev client setup notes: `docs/MOBILE_PHASE1_PACKAGE_5_16.md`
- Mobile phase-1 env doctor notes: `docs/MOBILE_PHASE1_PACKAGE_5_17.md`
- Mobile phase-1 EAS project id sync notes: `docs/MOBILE_PHASE1_PACKAGE_5_18.md`
- Mobile phase-1 readiness runner notes: `docs/MOBILE_PHASE1_PACKAGE_5_19.md`
- Mobile phase-1 notification inbox notes: `docs/MOBILE_PHASE1_PACKAGE_5_20.md`
- Mobile phase-1 notification types notes: `docs/MOBILE_PHASE1_PACKAGE_5_21.md`
- Mobile phase-1 dev-client port alignment notes: `docs/MOBILE_PHASE1_PACKAGE_5_22.md`
- Mobile phase-1 push-haric final QA notes: `docs/MOBILE_PHASE1_PACKAGE_5_23.md`
- Mobile phase-1 Firebase init guardrails notes: `docs/MOBILE_PHASE1_PACKAGE_5_24.md`
- Mobile phase-1 GitHub Actions QA automation notes: `docs/MOBILE_PHASE1_PACKAGE_5_25.md`
- Mobile phase-1 shared contract smoke gate notes: `docs/MOBILE_PHASE1_PACKAGE_5_26.md`
- UI i18n/mobile consistency audit notes: `docs/UI_I18N_MOBILE_AUDIT_2026Q1_P1.md`

## Notes
- Social interactions use relational tables (`ritual_echoes`, `ritual_replies`).
- Client-side Daily 5 writes are restricted to dev mode; production writer should be cron/service role.
- `vercel.json` cron is set to `21:00 UTC` to align with `Europe/Istanbul` midnight rollover.
- If you change rollover timezone, update cron schedule to the matching UTC hour.
- Debug panel is dynamically imported only in dev mode.
- SEO evergreen landing pages:
  - `/discover/mood-films/`
  - `/discover/director-deep-dives/`
  - `/discover/daily-curated-picks/`
- SEO package notes: `docs/SEO_PACKAGE_2.md`
- Mobile/web shared analytics contract: `src/domain/analyticsEvents.ts`
- Mobile route-map contract: `src/domain/mobileRouteContract.ts`
- Mobile screen-map contract: `src/domain/mobileScreenMap.ts`
- Mobile web prompt contract: `src/domain/mobileWebPromptContract.ts`
