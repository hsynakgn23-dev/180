-- Fix: question_pool_questions was publicly readable including correct_option.
-- The pool-answer.ts API uses the service role key (bypasses RLS) to read
-- correct answers server-side. Client-side code only needs question text and
-- options — not the correct answer.

-- 1. Drop the overly permissive public read policy
drop policy if exists "Pool Questions Public Read" on public.question_pool_questions;

-- 2. Allow authenticated users to read questions (for displaying quiz UI),
--    but restrict via column-level security so correct_option is not exposed.
create policy "Pool Questions Authenticated Read"
on public.question_pool_questions for select
to authenticated
using (true);

-- 3. Revoke correct_option and explanation_translations from the anon and
--    authenticated roles at the column level. The server-side API uses the
--    service role which bypasses this restriction.
revoke select (correct_option, explanation_translations)
    on public.question_pool_questions
    from anon, authenticated;

-- Pool questions are still browsable by authenticated users for all other
-- columns (id, movie_id, tmdb_movie_id, question_translations, options_*,
-- question_order, language, created_at).
