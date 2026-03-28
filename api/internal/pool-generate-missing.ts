/**
 * pool-generate-missing
 * ----------------------
 * Finds all movies in question_pool_movies with question_count = 0,
 * builds Anthropic batch requests from stored DB data (no TMDB calls),
 * and submits them for question generation.
 */

import { buildBatchRequests, submitAnthropicBatch } from '../lib/questionPool.js';
import { createSupabaseServiceClient } from '../lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    headers?: Record<string, string | undefined> | Headers;
};

type ApiResponse = {
    status?: (code: number) => { json: (p: Record<string, unknown>) => unknown };
};

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
    if (res && typeof res.status === 'function') return res.status(status).json(payload);
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
};

const resolveSecret = () =>
    String(process.env.CRON_SECRET || process.env.DAILY_QUIZ_IMPORT_SECRET || '').trim();

const getHeader = (req: ApiRequest, key: string): string => {
    const h = req.headers;
    if (!h) return '';
    if (typeof (h as Headers).get === 'function') return ((h as Headers).get(key) || '').trim();
    const o = h as Record<string, string | undefined>;
    return (o[key.toLowerCase()] || o[key] || '').trim();
};

const getBearerToken = (req: ApiRequest) => {
    const m = getHeader(req, 'authorization').match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() || null : null;
};

const getSupabase = () => {
    const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) throw new Error('Missing Supabase service config.');
    return createSupabaseServiceClient(url, key);
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });

    const secret = resolveSecret();
    const provided = getBearerToken(req) || '';
    if (!secret || provided !== secret) return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });

    const supabase = getSupabase();

    // ── Find movies with no questions ─────────────────────────
    const { data: movies, error } = await supabase
        .from('question_pool_movies')
        .select('id, tmdb_id, title, overview, cast_names, director, genre, release_year')
        .eq('question_count', 0)
        .order('id', { ascending: true });

    if (error) return sendJson(res, 500, { ok: false, error: error.message });
    if (!movies || movies.length === 0) {
        return sendJson(res, 200, { ok: true, message: 'No movies missing questions.', total: 0 });
    }

    // ── Map DB rows to the format buildBatchRequests expects ──
    const enriched = movies.map((m) => {
        const genreNames = typeof m.genre === 'string'
            ? m.genre.split('/').map((g: string) => g.trim()).filter(Boolean)
            : [];

        return {
            id: m.tmdb_id as number,
            title: String(m.title || ''),
            overview: String(m.overview || ''),
            poster_path: null,
            release_date: m.release_year ? `${m.release_year}-01-01` : undefined,
            vote_average: undefined,
            original_language: undefined,
            genres: genreNames.map((name: string) => ({ id: 0, name })),
            director: String(m.director || ''),
            castNames: Array.isArray(m.cast_names) ? (m.cast_names as string[]) : [],
            tagline: '',
        };
    });

    // ── Submit in batches to Anthropic ────────────────────────
    const CHUNK_SIZE = 5; // movies per batch request (same as MOVIES_PER_BATCH)
    const requests = buildBatchRequests(enriched);
    const result = await submitAnthropicBatch(requests);

    if (!result.ok) {
        return sendJson(res, 500, { ok: false, error: result.error });
    }

    return sendJson(res, 200, {
        ok: true,
        movies_queued: enriched.length,
        batch_requests: requests.length,
        batch_id: result.batchId,
        message: `Submitted ${enriched.length} movies (${requests.length} batch requests) to Anthropic. Use /api/internal/pool-batch-status?batchId=${result.batchId} to check progress.`,
        hint: `When done, call /api/internal/pool-batch-status?batchId=${result.batchId}&process=true to write questions to DB.`,
        per_batch: CHUNK_SIZE,
    });
}
