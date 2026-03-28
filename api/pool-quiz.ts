import { createCorsHeaders } from './lib/cors.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined> | Headers;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

const sendJson = (
    res: ApiResponse,
    status: number,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
        }
    }
    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
    });
};

const getQueryParam = (req: ApiRequest, key: string): string | null => {
    const raw = req?.query?.[key];
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
    const rawUrl = typeof req?.url === 'string' ? req.url : '';
    if (!rawUrl) return null;
    try {
        const url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : 'https://localhost');
        return url.searchParams.get(key);
    } catch { return null; }
};

const getHeader = (req: ApiRequest, key: string): string => {
    const headers = req.headers;
    if (!headers) return '';
    if (typeof (headers as Headers).get === 'function') {
        return ((headers as Headers).get(key) || '').trim();
    }
    const obj = headers as Record<string, string | undefined>;
    return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
    const authHeader = getHeader(req, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() || null : null;
};

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type, apikey, x-client-info',
        methods: 'GET, OPTIONS'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, {}, cors);
    }

    if (req.method !== 'GET') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);
    }

    const accessToken = getBearerToken(req);
    if (!accessToken) {
        return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !supabaseServiceKey) {
        return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);
    }

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
        return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);
    }

    const movieId = getQueryParam(req, 'movie_id') || getQueryParam(req, 'movieId') || '';
    const lang = getQueryParam(req, 'lang') || 'tr';

    if (!movieId) {
        return sendJson(res, 400, { ok: false, error: 'Missing movie_id.' }, cors);
    }

    // Get movie info
    const { data: movie, error: movieError } = await supabase
        .from('question_pool_movies')
        .select('id, tmdb_id, title, poster_path, genre, era, director')
        .eq('id', movieId)
        .single();

    if (movieError || !movie) {
        return sendJson(res, 404, { ok: false, error: 'Movie not found.' }, cors);
    }

    // Get questions for this movie
    const { data: questions, error: questionsError } = await supabase
        .from('question_pool_questions')
        .select('id, question_order, question_translations, options_translations, correct_option, explanation_translations, difficulty')
        .eq('movie_id', movieId)
        .order('question_order', { ascending: true });

    if (questionsError) {
        return sendJson(res, 500, { ok: false, error: questionsError.message }, cors);
    }

    // Get user's existing progress for this movie
    const { data: progress } = await supabase
        .from('movie_pool_user_progress')
        .select('questions_answered, correct_count, xp_earned, completed')
        .eq('user_id', user.id)
        .eq('movie_id', movieId)
        .single();

    // Format questions for the client (localized, without revealing correct answer)
    const validLang = ['tr', 'en', 'es', 'fr'].includes(lang) ? lang : 'tr';
    const formattedQuestions = (questions || []).map((q) => {
        const translations = q.question_translations as Record<string, string>;
        const optionsTranslations = q.options_translations as Record<string, Record<string, string>>;

        return {
            id: q.id,
            questionOrder: q.question_order,
            question: translations[validLang] || translations.tr || translations.en || '',
            options: ['a', 'b', 'c', 'd'].map((key) => ({
                key,
                label: optionsTranslations[key]?.[validLang] || optionsTranslations[key]?.tr || optionsTranslations[key]?.en || ''
            })),
            difficulty: q.difficulty
        };
    });

    return sendJson(res, 200, {
        ok: true,
        movie_id: movie.id,
        title: movie.title,
        movie: {
            id: movie.id,
            tmdb_id: movie.tmdb_id,
            title: movie.title,
            poster_path: movie.poster_path,
            genre: movie.genre,
            era: movie.era,
            director: movie.director
        },
        questions: formattedQuestions,
        question_count: formattedQuestions.length,
        progress: progress || null
    }, cors);
}
