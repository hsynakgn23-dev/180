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
- `node test-supabase-connection.js` - quick Supabase read/write capability check

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

Server/cron (`api/cron/daily.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (optional, default `posters`)
- `TMDB_API_KEY`
- `DAILY_ROLLOVER_TIMEZONE` (optional, default `Europe/Istanbul`)

Server analytics ingest (`api/analytics.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional edge-friendly cache (`api/daily.ts`, Redis/KV REST):
- `KV_REST_API_URL` or `UPSTASH_REDIS_REST_URL`
- `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_TOKEN`

## Supabase Rollout
- Base setup SQL: `supabase_setup.sql`
- Social migration SQL: `sql/migrations/20260207_social_model_v2.sql`
- Rate limit migration SQL: `sql/migrations/20260213_rate_limits.sql`
- Analytics migration SQL: `sql/migrations/20260215_analytics_events.sql`
- Rollout checklist: `docs/ROLLOUT_SOCIAL_MODEL.md`
- Test checklist: `docs/TEST_PLAN_SOCIAL_SYNC.md`
- Integration plan: `PLAN_SUPABASE_INTEGRATION.md`
- Analytics package notes: `docs/ANALYTICS_PACKAGE_1.md`

## Notes
- Social interactions use relational tables (`ritual_echoes`, `ritual_replies`).
- Client-side Daily 5 writes are restricted to dev mode; production writer should be cron/service role.
- `vercel.json` cron is set to `21:00 UTC` to align with `Europe/Istanbul` midnight rollover.
- If you change rollover timezone, update cron schedule to the matching UTC hour.
- Debug panel is dynamically imported only in dev mode.
- SEO evergreen landing pages:
  - `/discover/mood-films/`
  - `/discover/director-deep-dives/`
- SEO package notes: `docs/SEO_PACKAGE_2.md`
