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
- `npm run mobile:eas:ios:development` - trigger EAS iOS development build (`apps/mobile/eas.json`)
- `npm run mobile:eas:ios:preview` - trigger EAS iOS preview/internal build (`apps/mobile/eas.json`)
- `npm run mobile:eas:ios:production` - trigger EAS iOS store build for TestFlight/App Store Connect
- `npm run mobile:eas:ios:submit:production` - submit iOS build via EAS Submit (`submit.production.ios`)
- `npm run mobile:env:sync` - sync public mobile env values from root `.env` into `apps/mobile/.env`
- `npm run mobile:release:env:sync` - generate release-focused mobile env profile at `apps/mobile/.env.release`
- `npm run mobile:env:doctor` - validate mobile env and detect forbidden secret keys
- `npm run mobile:eas:projectid:sync` - read EAS project id and write it to `apps/mobile/.env` + `apps/mobile/app.json`
- `npm run mobile:ready` - run full mobile readiness chain (`env:sync`, `projectid:sync`, `env:doctor`, final checklist)
- `npm run mobile:phase1:qa` - run push-haric phase-1 QA chain (`mobile:ready`, mobile typecheck, mobile contract smoke, push inbox smoke, design parity check, lint, build)
- `npm run mobile:phase1:smoke:no-push` - run push-haric QA + deep-link runtime smoke + referral e2e smoke (fresh invitee)
- `npm run mobile:phase1:release:check` - run phase-1 QA + release env sync + release-readiness validation (warn mode)
- `npm run mobile:phase1:release:check:ios` - run strict iOS release gate (`usesAppleSignIn`, iOS submit profile, prod web origin)
- `npm run mobile:phase1:release:check:strict` - same as release check, but warnings fail the command
- `npm run mobile:phase1:release:check:ci` - strict release gate + JSON report + markdown checklist artifact output under `artifacts/mobile-release`
- `node test-supabase-connection.js` - quick Supabase read/write capability check
- `npm run test:referral:smoke:create` - sign in inviter + verify `/api/referral/create`
- `npm run test:referral:smoke:claim -- --code=ABC12345` - sign in invitee + verify `/api/referral/claim`
- `npm run test:referral:smoke:e2e` - create + claim + duplicate-claim rejection (`ALREADY_CLAIMED`)
- `npm run test:referral:smoke:e2e:fresh` - create temporary invitee, then run e2e claim flow
- `npm run test:mobile:deeplink:smoke` - dispatch mobile deep links via `adb` and scan runtime logs for crash signals
- `npm run test:mobile:contracts` - validate shared mobile route/deep-link/prompt contracts via Node smoke cases
- `npm run test:mobile:push-inbox:smoke` - validate mobile notification inbox dedupe/merge behavior
- `npm run test:mobile:design:parity` - enforce web/mobile design token parity for mobile UI files

## Mobile (Expo)
- Expo app root: `apps/mobile`
- Shared mobile contracts: `packages/shared/src/mobile`
- Mobile UI design parity policy: web design tokens/colors are the source of truth; mobile palette changes require explicit product direction.
- Mobile typography parity policy: Inter is used as the primary mobile font to match web.
- Expo Go on SDK 53+ does not support remote push token flow. Use dev client for remote push tests.
- iOS auth/review prep:
  - `apps/mobile/app.json` now enables `ios.usesAppleSignIn`
  - iOS auth modal surfaces native Apple sign-in on supported devices
  - Supabase Dashboard > Authentication > Providers > Apple setup must be completed before release
- Android remote push icin Firebase `google-services.json` zorunlu:
  - `apps/mobile/google-services.json` dosyasini koy
  - Android package adi Firebase'de `com.hsyna.absolutecinema` olmali
- GitHub Actions `mobile:phase1:release:check:ci` icin push-acik gate kullanacaksan secret gerekli:
  - Repo secret adi: `MOBILE_GOOGLE_SERVICES_JSON_B64`
  - Deger: `apps/mobile/google-services.json` dosyasinin base64 metni
  - Secret yoksa workflow push'u kapatip non-push strict gate ile devam eder
  - PowerShell (tek satir base64):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("apps/mobile/google-services.json"))
```
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
- Android Studio store release flow:
  - Runbook: `docs/ANDROID_STUDIO_RELEASE.md`
  - Use the existing Play upload keystore, not a new key.
  - On March 10, 2026 the next manual Android upload should use `versionCode 23` or higher.
  - Local Gradle release signing reads Android Studio injected signing values or `apps/mobile/android/keystore.properties` (template: `apps/mobile/keystore.properties.example`).
- iOS EAS publish flow:
```bash
npm run mobile:phase1:release:check:ios
npm run mobile:eas:ios:production
npm run mobile:eas:ios:submit:production
```
- iOS submit note:
  - `apps/mobile/eas.json > submit.production.ios` profile is now present.
  - Adding `ascAppId` later makes App Store Connect submission more deterministic, but is not required to keep the profile wired.
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
- `EXPO_PUBLIC_WEB_APP_URL` (optional absolute web origin for mobile discover route links; if empty mobile derives base from referral/analytics/daily env)
- `EXPO_PUBLIC_MOBILE_INTERNAL_SURFACES` (optional, default `0`; set `1` only in local dev to reveal internal QA/debug surfaces)

Mobile release profile overrides (root `.env`, optional):
- `MOBILE_RELEASE_BASE_URL` (fallback base URL for generated mobile release endpoints)
- `MOBILE_RELEASE_WEB_APP_URL` (absolute override for `EXPO_PUBLIC_WEB_APP_URL`; if empty release profile falls back to `VITE_PUBLIC_APP_URL` then `MOBILE_RELEASE_BASE_URL`)
- `MOBILE_RELEASE_ANALYTICS_ENDPOINT` (absolute override for `EXPO_PUBLIC_ANALYTICS_ENDPOINT`)
- `MOBILE_RELEASE_DAILY_API_URL` (absolute override for `EXPO_PUBLIC_DAILY_API_URL`)
- `MOBILE_RELEASE_REFERRAL_API_BASE` (absolute override for `EXPO_PUBLIC_REFERRAL_API_BASE`)
- `MOBILE_RELEASE_PUSH_API_BASE` (absolute override for `EXPO_PUBLIC_PUSH_API_BASE`)
- `MOBILE_RELEASE_ANALYTICS_ENABLED` (`0/1` override for `EXPO_PUBLIC_ANALYTICS_ENABLED`, default `1`)
- `MOBILE_RELEASE_PUSH_ENABLED` (`0/1` override for `EXPO_PUBLIC_PUSH_ENABLED`, default `1`)
- `MOBILE_RELEASE_EXPO_PROJECT_ID` (override for `EXPO_PUBLIC_EXPO_PROJECT_ID`)
- `MOBILE_RELEASE_SUPABASE_URL` (override for `EXPO_PUBLIC_SUPABASE_URL`, falls back to `VITE_SUPABASE_URL`)
- `MOBILE_RELEASE_SUPABASE_ANON_KEY` (override for `EXPO_PUBLIC_SUPABASE_ANON_KEY`, falls back to `VITE_SUPABASE_ANON_KEY`)

Server/cron (`api/cron/daily.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (recommended; if set, cron endpoint requires `Authorization: Bearer <secret>` or `?secret=...`)
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
- Mobile phase-1 notification inbox dedupe notes: `docs/MOBILE_PHASE1_PACKAGE_5_27.md`
- Mobile phase-1 push inbox smoke notes: `docs/MOBILE_PHASE1_PACKAGE_5_28.md`
- Mobile phase-1 inbox filter + pagination notes: `docs/MOBILE_PHASE1_PACKAGE_5_29.md`
- Mobile phase-1 QA gate extension notes: `docs/MOBILE_PHASE1_PACKAGE_5_30.md`
- Mobile phase-1 inbox search + sort notes: `docs/MOBILE_PHASE1_PACKAGE_5_31.md`
- Mobile phase-1 inbox notification-id + copy action notes: `docs/MOBILE_PHASE1_PACKAGE_5_32.md`
- Mobile phase-1 inbox debounced search + highlight notes: `docs/MOBILE_PHASE1_PACKAGE_5_33.md`
- Mobile phase-1 inbox bulk actions notes: `docs/MOBILE_PHASE1_PACKAGE_5_34.md`
- Mobile phase-1 inbox view-prefs persistence notes: `docs/MOBILE_PHASE1_PACKAGE_5_35.md`
- Mobile phase-1 inbox row memoization notes: `docs/MOBILE_PHASE1_PACKAGE_5_36.md`
- Mobile phase-1 inbox flatlist virtualization notes: `docs/MOBILE_PHASE1_PACKAGE_5_37.md`
- Mobile phase-1 inbox interaction analytics notes: `docs/MOBILE_PHASE1_PACKAGE_5_38.md`
- Mobile phase-1 release-readiness gate notes: `docs/MOBILE_PHASE1_PACKAGE_5_39.md`
- Mobile phase-1 release env profile sync notes: `docs/MOBILE_PHASE1_PACKAGE_5_40.md`
- Mobile phase-1 release CI strict gate notes: `docs/MOBILE_PHASE1_PACKAGE_5_41.md`
- Mobile phase-1 iOS release prep notes: `docs/MOBILE_PHASE1_PACKAGE_5_42.md`
- Mobile productization/UI package 6.1 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_1.md`
- Mobile productization/UI package 6.2 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_2.md`
- Mobile productization/UI package 6.3 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_3.md`
- Mobile productization/UI package 6.4 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_4.md`
- Mobile productization/UI package 6.5 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_5.md`
- Mobile productization/UI package 6.6 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_6.md`
- Mobile productization/UI package 6.7 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_7.md`
- Mobile productization/UI package 6.8 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_8.md`
- Mobile productization/UI package 6.9 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_9.md`
- Mobile productization/UI package 6.10 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_10.md`
- Mobile productization/UI package 6.11 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_11.md`
- Mobile productization/UI package 6.12 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_12.md`
- Mobile productization/UI package 6.13 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_13.md`
- Mobile productization/UI package 6.14 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_14.md`
- Mobile productization/UI package 6.15 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_15.md`
- Mobile productization/UI package 6.16 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_16.md`
- Mobile productization/UI package 6.17 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_17.md`
- Mobile productization/UI package 6.18 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_18.md`
- Mobile productization/UI package 6.19 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_19.md`
- Mobile productization/UI package 6.20 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_20.md`
- Mobile productization/UI package 6.21 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_21.md`
- Mobile productization/UI package 6.22 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_22.md`
- Mobile productization/UI package 6.23 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_23.md`
- Mobile productization/UI package 6.24 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_24.md`
- Mobile productization/UI package 6.25 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_25.md`
- Mobile productization/UI package 6.26 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_26.md`
- Mobile productization/UI package 6.27 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_27.md`
- Mobile productization/UI package 6.28 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_28.md`
- Mobile productization/UI package 6.29 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_29.md`
- Mobile productization/UI package 6.30 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_30.md`
- Mobile productization/UI package 6.31 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_31.md`
- Mobile productization/UI package 6.32 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_32.md`
- Mobile productization/UI package 6.33 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_33.md`
- Mobile productization/UI package 6.34 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_34.md`
- Mobile productization/UI package 6.35 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_35.md`
- Mobile productization/UI package 6.36 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_36.md`
- Mobile productization/UI package 6.37 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_37.md`
- Mobile productization/UI package 6.38 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_38.md`
- Mobile productization/UI package 6.39 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_39.md`
- Mobile productization/UI package 6.40 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_40.md`
- Mobile productization/UI package 6.41 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_41.md`
- Mobile productization/UI package 6.42 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_42.md`
- Mobile productization/UI package 6.43 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_43.md`
- Mobile productization/UI package 6.44 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_44.md`
- Mobile productization/UI package 6.45 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_45.md`
- Mobile productization/UI package 6.46 notes: `docs/MOBILE_PRODUCTIZATION_UI_PACKAGE_6_46.md`
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
