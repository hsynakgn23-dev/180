import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, getQueryParam, sendJson } from './lib/httpHelpers.js';
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
        .gte('question_count', 5);

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
