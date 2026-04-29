import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | undefined> | Headers;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
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
        methods: 'POST, OPTIONS'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, {}, cors);
    }

    if (req.method !== 'POST') {
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

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const movieId = String(bodyObj.movie_id || bodyObj.movieId || '').trim();
    const direction = String(bodyObj.direction || '').trim();

    if (!movieId) {
        return sendJson(res, 400, { ok: false, error: 'Missing movie_id.' }, cors);
    }
    if (direction !== 'left' && direction !== 'right') {
        return sendJson(res, 400, { ok: false, error: 'Invalid direction. Must be "left" or "right".' }, cors);
    }

    const { error: swipeError } = await supabase
        .from('movie_pool_swipes')
        .upsert({
            user_id: user.id,
            movie_id: movieId,
            direction,
            created_at: new Date().toISOString()
        }, { onConflict: 'user_id,movie_id' });

    if (swipeError) {
        return sendJson(res, 500, { ok: false, error: swipeError.message }, cors);
    }

    return sendJson(res, 200, {
        ok: true,
        movieId,
        direction,
        message: direction === 'right' ? 'Movie selected for quiz.' : 'Movie skipped.'
    }, cors);
}
