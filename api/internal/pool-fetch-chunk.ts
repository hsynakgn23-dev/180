/**
 * pool-fetch-chunk
 * ----------------
 * Fetches one TMDB discover page, enriches with credits, saves new movies
 * to the pool, and submits a mini Anthropic batch for question generation.
 *
 * Designed to be called by a cron every ~5 minutes so the full 400-movie
 * target is reached gradually without hitting TMDB rate limits.
 *
 * State is stored in the `pool_crawl_state` table (singleton row id = 1).
 */

import {
    fetchTmdbSinglePage,
    enrichMoviesWithCredits,
    saveMoviesToPool,
    buildBatchRequests,
    submitAnthropicBatch,
    type TmdbPageResult,
} from '../lib/questionPool.js';
import { createSupabaseServiceClient } from '../lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    headers?: Record<string, string | undefined> | Headers;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
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

    // ── Read crawl state ──────────────────────────────────────
    const { data: stateRow, error: stateErr } = await supabase
        .from('pool_crawl_state')
        .select('next_page, movies_fetched, movies_target, status')
        .eq('id', 1)
        .single();

    if (stateErr || !stateRow) {
        return sendJson(res, 500, { ok: false, error: 'Could not read pool_crawl_state. Run migration first.' });
    }

    if (stateRow.status === 'done') {
        return sendJson(res, 200, {
            ok: true,
            skipped: true,
            reason: 'Target already reached.',
            movies_fetched: stateRow.movies_fetched,
            movies_target: stateRow.movies_target,
        });
    }

    const page: number = stateRow.next_page ?? 1;
    const moviesFetched: number = stateRow.movies_fetched ?? 0;
    const moviesTarget: number = stateRow.movies_target ?? 400;

    // Mark as running
    await supabase
        .from('pool_crawl_state')
        .update({ status: 'running', last_run_at: new Date().toISOString() })
        .eq('id', 1);

    // ── Fetch one TMDB page ───────────────────────────────────
    let pageResult: TmdbPageResult;
    try {
        pageResult = await fetchTmdbSinglePage(page);
    } catch (e) {
        await supabase.from('pool_crawl_state').update({ status: 'idle' }).eq('id', 1);
        return sendJson(res, 502, { ok: false, error: `TMDB fetch failed: ${String(e)}` });
    }

    const { movies: tmdbMovies, totalPages: totalTmdbPages } = pageResult;

    // ── Filter movies already in pool ─────────────────────────
    const { data: existing } = await supabase
        .from('question_pool_movies')
        .select('tmdb_id');

    const existingIds = new Set((existing || []).map((m) => Number(m.tmdb_id)));
    const newMovies = tmdbMovies.filter((m) => !existingIds.has(Number(m.id)));

    // ── Enrich + save ─────────────────────────────────────────
    let batchId: string | null = null;
    let savedCount = 0;

    if (newMovies.length > 0) {
        const enriched = await enrichMoviesWithCredits(newMovies);
        const { inserted } = await saveMoviesToPool(enriched);
        savedCount = inserted;

        // Submit mini Anthropic batch
        if (enriched.length > 0) {
            const requests = buildBatchRequests(enriched);
            const result = await submitAnthropicBatch(requests);
            if (result.ok) batchId = result.batchId;
        }
    }

    // ── Update cursor ─────────────────────────────────────────
    const newFetched = moviesFetched + savedCount;
    const isLastPage = page >= totalTmdbPages;
    const isDone = newFetched >= moviesTarget || isLastPage;

    await supabase
        .from('pool_crawl_state')
        .update({
            next_page: page + 1,
            movies_fetched: newFetched,
            status: isDone ? 'done' : 'idle',
            last_run_at: new Date().toISOString(),
        })
        .eq('id', 1);

    return sendJson(res, 200, {
        ok: true,
        page_fetched: page,
        tmdb_results: tmdbMovies.length,
        new_movies: newMovies.length,
        saved: savedCount,
        batch_id: batchId,
        movies_fetched_total: newFetched,
        movies_target: moviesTarget,
        progress_pct: Math.round((newFetched / moviesTarget) * 100),
        done: isDone,
        next_page: isDone ? null : page + 1,
    });
}
