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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
        return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);
    }

    const limit = Math.min(Math.max(1, parseInt(getQueryParam(req, 'limit') || '20', 10) || 20), 50);
    const genre = getQueryParam(req, 'genre') || null;
    const era = getQueryParam(req, 'era') || null;

    // Get movies user hasn't swiped yet, with questions available
    let query = supabase
        .from('question_pool_movies')
        .select('id, tmdb_id, title, poster_path, release_year, genre, era, overview, vote_average, director, question_count')
        .gt('question_count', 0);

    if (genre) query = query.eq('genre', genre);
    if (era) query = query.eq('era', era);

    const { data: allMovies, error: moviesError } = await query
        .order('vote_average', { ascending: false, nullsFirst: false })
        .limit(200);

    if (moviesError) {
        return sendJson(res, 500, { ok: false, error: moviesError.message }, cors);
    }

    // Get user's swiped movie IDs
    const { data: swipes } = await supabase
        .from('movie_pool_swipes')
        .select('movie_id')
        .eq('user_id', user.id);

    const swipedIds = new Set((swipes || []).map((s) => s.movie_id));
    const unswiped = (allMovies || []).filter((m) => !swipedIds.has(m.id));

    return sendJson(res, 200, {
        ok: true,
        movies: unswiped.slice(0, limit),
        total: unswiped.length,
        hasMore: unswiped.length > limit
    }, cors);
}
