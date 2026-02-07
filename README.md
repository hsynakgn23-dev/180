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

Server/cron (`api/cron/daily.ts`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (optional, default `posters`)
- `TMDB_API_KEY`

## Supabase Rollout
- Base setup SQL: `supabase_setup.sql`
- Social migration SQL: `sql/migrations/20260207_social_model_v2.sql`
- Rollout checklist: `docs/ROLLOUT_SOCIAL_MODEL.md`
- Test checklist: `docs/TEST_PLAN_SOCIAL_SYNC.md`
- Integration plan: `PLAN_SUPABASE_INTEGRATION.md`

## Notes
- Social interactions use relational tables (`ritual_echoes`, `ritual_replies`).
- Client-side Daily 5 writes are restricted to dev mode; production writer should be cron/service role.
- Debug panel is dynamically imported only in dev mode.
