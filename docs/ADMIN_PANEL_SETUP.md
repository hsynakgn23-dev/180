# Admin Panel Setup

Date: 2026-03-04

## Scope
- Web-only admin panel route: `#/admin`
- Service-role protected admin APIs under `/api/admin/*`
- Moderation actions:
  - remove/restore ritual comments
  - remove/restore replies
  - suspend users
  - lift suspensions
  - delete accounts

## Required rollout
1. Apply the migration:
```sql
-- paste the full file contents into Supabase SQL Editor
-- sql/migrations/20260304_admin_panel_and_user_safety.sql
```

2. Seed at least one admin user:
```sql
insert into public.admin_users (user_id, role, note)
values ('<YOUR_AUTH_USER_UUID>', 'admin', 'Initial web admin bootstrap')
on conflict (user_id) do update
set role = excluded.role,
    note = excluded.note;
```

3. Deploy the web app and API functions with:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`

4. Sign in with the seeded admin account and open:
```text
https://<your-domain>/#/admin
```

## Local verification
Run the app through Vercel dev so `/api/admin/*` functions are available:
```bash
npx vercel dev --listen 5173
```

Then open:
```text
http://localhost:5173/#/admin
```

## Notes
- The admin button appears only for users present in `public.admin_users`.
- Comment removal is soft-remove. User deletion is hard delete through Supabase Admin API.
- Block/report tables are included as backend groundwork for the next safety pass.
