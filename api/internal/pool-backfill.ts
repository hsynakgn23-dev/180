import { syncDailyQuestionsToPool } from '../lib/questionPool.js';
import { createSupabaseServiceClient } from '../lib/supabaseServiceClient.js';
import { getBearerToken, getQueryParam, sendJson } from '../lib/httpHelpers.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    headers?: Record<string, string | undefined> | Headers;
    query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
    status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

const resolveSecret = (): string =>
    String(
        process.env.DAILY_QUIZ_IMPORT_SECRET ||
            process.env.DAILY_SOURCE_SECRET ||
            process.env.CRON_SECRET ||
            ''
    ).trim();

/**
 * Backfill the question pool from existing daily_movie_questions.
 * No TMDB calls needed — purely Supabase to Supabase.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const expectedSecret = resolveSecret();
    const providedSecret = getBearerToken(req) || getQueryParam(req, 'secret') || '';
    if (!expectedSecret || providedSecret !== expectedSecret) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }

    try {
        const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
        const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
        if (!url || !key) {
            return sendJson(res, 500, { ok: false, error: 'Missing Supabase config.' });
        }
        const supabase = createSupabaseServiceClient(url, key);

        // Get all distinct batch_dates from daily_movie_questions
        const { data: dates } = await supabase
            .from('daily_movie_questions')
            .select('batch_date')
            .order('batch_date', { ascending: true });

        if (!dates || dates.length === 0) {
            return sendJson(res, 200, { ok: true, message: 'No daily questions found.', synced: 0 });
        }

        const uniqueDates = [...new Set(dates.map((d: { batch_date: string }) => d.batch_date))];

        let totalSynced = 0;
        const errors: string[] = [];

        for (const dateKey of uniqueDates) {
            try {
                const result = await syncDailyQuestionsToPool(dateKey);
                totalSynced += result.synced;
            } catch (e) {
                errors.push(`${dateKey}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        return sendJson(res, 200, {
            ok: true,
            datesProcessed: uniqueDates.length,
            totalSynced,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (e) {
        return sendJson(res, 500, {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        });
    }
}
