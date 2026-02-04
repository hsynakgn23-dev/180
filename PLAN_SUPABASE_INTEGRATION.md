# Supabase Integration Plan: "Absolute Sync"

## Objective
Migrate **180 | Absolute Cinema** from local-only storage to a unified Supabase backend. This ensures all users see the exact same "Daily 5" movies, share a persistent "Arena", and maintain their XP/League progress across devices.

## 1. Database Schema Design

We need three core tables to handle the application state.

### Table: `daily_showcase`
*Purpose: Ensures the "Daily 5" is identical for everyone.*
- `date` (DATE, Primary Key): e.g., '2024-02-14'
- `movies` (JSONB): Array of 5 movie objects (including the *verified* poster URL).
- `created_at` (TIMESTAMPTZ)

### Table: `users` (Optional for Phase 1 if using Anon login, but recommended)
*Purpose: Persist XP and Profile*
- `id` (UUID, Primary Key)
- `username` (TEXT)
- `xp` (INTEGER)
- `league` (TEXT)
- `streak` (INTEGER)

### Table: `rituals` (The Arena)
*Purpose: Global social feed*
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `movie_id` (INTEGER)
- `text` (TEXT)
- `timestamp` (TIMESTAMPTZ)
- `echoes` (INTEGER)

## 2. Synchronization Logic (The "Sync Engine")

### Daily Movies (`useDailyMovies.ts`)
**Current:** Checks LocalStorage -> Fetches TMDB API -> Saves to LocalStorage.
**New:**
1. **Check DB:** Query `daily_showcase` for `TODAY`.
2. **Hit:** Return the data immediately. (Fast, Consistent, Verified Images).
3. **Miss:** (First user of the day triggers this)
   - Fetch fresh data from TMDB API.
   - **Verify Images:** Check if posters exist (using our new Dynamic Validator).
   - **Write to DB:** Insert into `daily_showcase`.
   - Return data.

### The Cleanup
- **No more 404s:** Since we verify images *before* saving to the DB, no broken link ever enters the system.
- **Global Time:** The DB server time serves as the "Universal Clock", solving timezone issues.

## 3. Implementation Steps

### Phase 1: Setup
1. Create Supabase Project.
2. Run SQL Scripts to create tables.
3. specific environment variables in `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Phase 2: Client Integration
1. Install `@supabase/supabase-js`.
2. Initialize `src/lib/supabase.ts`.
3. Refactor `useDailyMovies` to use the DB strategy.

### Phase 3: Migration (Optional)
- We can write a script to upload the current working `tmdbSeeds` to the DB as a backup.

---

## Action Plan for User
1. **Approve Schema:** Confirm if you want to proceed with these tables.
2. **Connect:** I will need the Supabase URL and Anon Key after you create the project.
