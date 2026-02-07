# Test Plan: Social Sync and Auth

Date: 2026-02-07

## Goal
Validate social interactions, auth-linked ownership, and RLS behavior after relational social migration.

## Coverage
1. Ritual create/delete ownership.
2. Echo uniqueness and ownership.
3. Reply create/read ownership.
4. Realtime feed consistency.
5. Client fallback boundaries (dev-only write paths).

## Manual Scenarios
1. Authenticated user posts ritual
- Expected: row created in `public.rituals` with `user_id = auth.uid()`.
2. Non-owner tries delete
- Expected: delete blocked by RLS.
3. Echo same ritual twice by same user
- Expected: single row in `public.ritual_echoes` due to `(ritual_id, user_id)` PK.
4. Reply submit
- Expected: row created in `public.ritual_replies` and visible in feed.
5. Echo/reply sync failure
- Expected: UI surfaces user-visible system notification and optimistic state rolls back.
6. Arena feed fetch failure
- Expected: feed error banner rendered and system notification shown once per unique error text.
7. Daily write protection
- Expected: `useDailyMovies` client insert path active only when `import.meta.env.DEV` and `VITE_ALLOW_CLIENT_DAILY_WRITE=1`.
8. Profile sync policy
- Expected: authenticated user upsert/read on `public.profiles` works only for own `user_id`.

## SQL Verification Snippets
```sql
-- Ritual ownership sanity
select id, user_id, author, timestamp
from public.rituals
order by timestamp desc
limit 20;

-- Echo uniqueness
select ritual_id, user_id, count(*)
from public.ritual_echoes
group by ritual_id, user_id
having count(*) > 1;

-- Reply integrity
select ritual_id, user_id, author, text, created_at
from public.ritual_replies
order by created_at desc
limit 50;
```

## Automation Gap
- No test runner is configured in `package.json` yet.
- Recommended next step:
1. Add `vitest` + React Testing Library for UI behavior tests.
2. Add Supabase integration test project with seed fixtures for RLS assertions.
