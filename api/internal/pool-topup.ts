/**
 * pool-topup
 * ----------
 * Finds movies with question_count < 5, submits them to Anthropic
 * asking for 5 questions, then only inserts the missing question_orders.
 */

import { buildBatchRequests, submitAnthropicBatch } from '../lib/questionPool.js';
import { createSupabaseServiceClient } from '../lib/supabaseServiceClient.js';
import { getBearerToken, getQueryParam, sendJson } from '../lib/httpHelpers.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined> | Headers;
    body?: unknown;
    on?: (event: string, cb: (chunk: Buffer | string) => void) => void;
};

type ApiResponse = {
    status?: (code: number) => { json: (p: Record<string, unknown>) => unknown };
};

const resolveSecret = () =>
    String(process.env.CRON_SECRET || process.env.DAILY_QUIZ_IMPORT_SECRET || '').trim();

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

    // ?process=<batchId> — second pass: write results to DB
    const processBatchId = getQueryParam(req, 'process') || '';
    if (processBatchId) {
        const supabase = getSupabase();

        // Fetch Anthropic results
        const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
        if (!apiKey) return sendJson(res, 500, { ok: false, error: 'Missing ANTHROPIC_API_KEY' });

        const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${processBatchId}/results`, {
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        });
        if (!response.ok) return sendJson(res, 502, { ok: false, error: `Anthropic results fetch failed: ${response.status}` });

        const text = await response.text();
        const lines = text.trim().split('\n').filter(Boolean);

        // Parse the same way fetchAndProcessBatchResults does
        const LANGS = ['tr', 'en', 'es', 'fr'] as const;
        let inserted = 0;
        let skipped = 0;
        let moviesUpdated = 0;

        for (const line of lines) {
            try {
                const result = JSON.parse(line) as Record<string, unknown>;
                const msgResult = result.result as Record<string, unknown>;
                if (msgResult?.type !== 'succeeded') continue;

                const message = msgResult.message as Record<string, unknown>;
                const contentBlocks = Array.isArray(message?.content) ? message.content : [];
                const responseText = (contentBlocks as Array<Record<string, unknown>>)
                    .filter(b => b?.type === 'text')
                    .map(b => String(b?.text || ''))
                    .join('\n').trim();

                if (!responseText) continue;

                let cleaned = responseText.trim();
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
                }

                const parsed = JSON.parse(cleaned) as Record<string, unknown>;
                const films = Array.isArray(parsed.films) ? parsed.films : [];

                for (const film of films) {
                    const tmdbId = Number(film?.film_id || 0);
                    if (!tmdbId || film?.yetersiz_veri === true) continue;

                    const rawQuestions = Array.isArray(film?.sorular) ? film.sorular : [];
                    if (rawQuestions.length === 0) continue;

                    // Get movie from pool
                    const { data: poolMovie } = await supabase
                        .from('question_pool_movies')
                        .select('id, question_count')
                        .eq('tmdb_id', tmdbId)
                        .single();

                    if (!poolMovie?.id) continue;

                    const currentCount = Number(poolMovie.question_count || 0);
                    if (currentCount >= 5) { skipped++; continue; }

                    // Get existing question orders for this movie
                    const { data: existingQs } = await supabase
                        .from('question_pool_questions')
                        .select('question_order')
                        .eq('movie_id', poolMovie.id);

                    const existingOrders = new Set((existingQs || []).map(q => Number(q.question_order)));
                    const missingOrders = [0, 1, 2, 3, 4].filter(o => !existingOrders.has(o));

                    if (missingOrders.length === 0) { skipped++; continue; }

                    // Map AI questions to missing slots
                    let addedForMovie = 0;
                    for (let i = 0; i < rawQuestions.length && i < missingOrders.length; i++) {
                        const q = rawQuestions[i];
                        const order = missingOrders[i];

                        const questionTranslations: Record<string, string> = {};
                        const optionsTranslations: Record<string, Record<string, string>> = { a: {}, b: {}, c: {}, d: {} };
                        let correctOption = '';

                        for (const lang of LANGS) {
                            const langBlock = q?.[lang];
                            if (!langBlock) continue;
                            questionTranslations[lang] = String(langBlock.soru || '').trim();
                            const opts = langBlock.secenekler || {};
                            optionsTranslations.a[lang] = String(opts.A || opts.a || '').trim();
                            optionsTranslations.b[lang] = String(opts.B || opts.b || '').trim();
                            optionsTranslations.c[lang] = String(opts.C || opts.c || '').trim();
                            optionsTranslations.d[lang] = String(opts.D || opts.d || '').trim();
                            if (!correctOption) {
                                const raw = String(langBlock.dogru || '').trim().toLowerCase();
                                if (['a', 'b', 'c', 'd'].includes(raw)) correctOption = raw;
                            }
                        }

                        if (!questionTranslations.tr && !questionTranslations.en) continue;

                        const { error } = await supabase
                            .from('question_pool_questions')
                            .insert({
                                tmdb_movie_id: tmdbId,
                                movie_id: poolMovie.id,
                                question_order: order,
                                question_key: `topup:${processBatchId}:${tmdbId}:${order}`,
                                question_translations: questionTranslations,
                                options_translations: optionsTranslations,
                                correct_option: correctOption || 'a',
                                explanation_translations: {},
                                difficulty: 'medium',
                                source: 'topup',
                                metadata: { batch_id: processBatchId }
                            });

                        if (!error) { inserted++; addedForMovie++; }
                    }

                    if (addedForMovie > 0) {
                        // Update question_count
                        const newCount = existingOrders.size + addedForMovie;
                        await supabase
                            .from('question_pool_movies')
                            .update({ question_count: Math.min(newCount, 5), updated_at: new Date().toISOString() })
                            .eq('id', poolMovie.id);
                        moviesUpdated++;
                    }
                }
            } catch { continue; }
        }

        return sendJson(res, 200, {
            ok: true,
            batch_id: processBatchId,
            questions_inserted: inserted,
            movies_updated: moviesUpdated,
            skipped,
        });
    }

    // ── First pass: submit batch ──────────────────────────────
    const supabase = getSupabase();

    const { data: movies, error } = await supabase
        .from('question_pool_movies')
        .select('id, tmdb_id, title, overview, cast_names, director, genre, release_year, question_count')
        .lt('question_count', 5)
        .gt('question_count', 0)
        .order('id', { ascending: true });

    if (error) return sendJson(res, 500, { ok: false, error: error.message });
    if (!movies || movies.length === 0) {
        return sendJson(res, 200, { ok: true, message: 'All movies already have 5 questions.', total: 0 });
    }

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

    const requests = buildBatchRequests(enriched);
    const result = await submitAnthropicBatch(requests);

    if (!result.ok) return sendJson(res, 500, { ok: false, error: result.error });

    return sendJson(res, 200, {
        ok: true,
        movies_queued: enriched.length,
        batch_requests: requests.length,
        batch_id: result.batchId,
        message: `Submitted ${enriched.length} movies for top-up. Check status, then call with ?process=${result.batchId} to write results.`,
    });
}
