import { createCorsHeaders } from './lib/cors.js';
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

const RUSH_CONFIG = {
    rush_15: { questionCount: 15, timeLimitSeconds: 90 },
    rush_30: { questionCount: 30, timeLimitSeconds: 150 },
    endless: { questionCount: 50, timeLimitSeconds: null }
} as const;

const FREE_DAILY_RUSH_LIMIT = 3;

const sendJson = (
    res: ApiResponse,
    status: number,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    }
    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
    });
};

const getHeader = (req: ApiRequest, key: string): string => {
    const headers = req.headers;
    if (!headers) return '';
    if (typeof (headers as Headers).get === 'function') return ((headers as Headers).get(key) || '').trim();
    const obj = headers as Record<string, string | undefined>;
    return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
    const authHeader = getHeader(req, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() || null : null;
};

const parseBody = async (req: ApiRequest): Promise<unknown> => {
    if (req.body !== undefined) return req.body;
    if (typeof req.on !== 'function') return null;
    const chunks: string[] = [];
    await new Promise<void>((resolve) => {
        req.on?.('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
        });
        req.on?.('end', () => resolve());
    });
    const raw = chunks.join('').trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
};

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Fisher-Yates shuffle
const shuffle = <T>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type, apikey, x-client-info',
        methods: 'POST, OPTIONS'
    });

    if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

    const accessToken = getBearerToken(req);
    if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !supabaseServiceKey) return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const mode = String(bodyObj.mode || '').trim();
    const lang = String(bodyObj.lang || 'tr').trim();

    if (!['rush_10', 'rush_20', 'endless'].includes(mode)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid mode. Must be "rush_10", "rush_20", or "endless".' }, cors);
    }

    const config = RUSH_CONFIG[mode as keyof typeof RUSH_CONFIG];

    // Check subscription for endless mode and daily limit
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

    const isFreeUser = !profile?.subscription_tier || profile.subscription_tier === 'free';

    if (isFreeUser && mode === 'endless') {
        return sendJson(res, 403, {
            ok: false,
            error: 'Endless mode requires a premium subscription.',
            requiresSubscription: true
        }, cors);
    }

    // Check daily rush limit for free users
    if (isFreeUser) {
        const { data: dailyCount } = await supabase
            .rpc('get_daily_rush_count', { p_user_id: user.id });

        if ((dailyCount || 0) >= FREE_DAILY_RUSH_LIMIT) {
            return sendJson(res, 429, {
                ok: false,
                error: 'Daily rush limit reached.',
                dailyLimit: FREE_DAILY_RUSH_LIMIT,
                requiresSubscription: true
            }, cors);
        }
    }

    // Fetch random questions from the pool
    const { data: allQuestions, error: questionsError } = await supabase
        .from('question_pool_questions')
        .select(`
            id,
            tmdb_movie_id,
            question_order,
            question_translations,
            options_translations,
            difficulty,
            question_pool_movies!inner (title, poster_path, genre)
        `)
        .limit(config.questionCount * 3); // overfetch for randomization

    if (questionsError || !allQuestions || allQuestions.length === 0) {
        return sendJson(res, 503, { ok: false, error: 'Not enough questions available.' }, cors);
    }

    const shuffled = shuffle(allQuestions).slice(0, config.questionCount);
    const validLang = ['tr', 'en', 'es', 'fr'].includes(lang) ? lang : 'tr';

    // Create session
    const now = new Date();
    const expiresAt = config.timeLimitSeconds
        ? new Date(now.getTime() + config.timeLimitSeconds * 1000).toISOString()
        : null;

    const { data: session, error: sessionError } = await supabase
        .from('quiz_rush_sessions')
        .insert({
            user_id: user.id,
            mode,
            total_questions: shuffled.length,
            correct_count: 0,
            wrong_count: 0,
            time_limit_seconds: config.timeLimitSeconds,
            xp_earned: 0,
            status: 'in_progress',
            started_at: now.toISOString(),
            expires_at: expiresAt
        })
        .select('id')
        .single();

    if (sessionError || !session) {
        return sendJson(res, 500, { ok: false, error: 'Failed to create session.' }, cors);
    }

    // Format questions for client
    const formattedQuestions = shuffled.map((q) => {
        const translations = q.question_translations as Record<string, string>;
        const optionsTranslations = q.options_translations as Record<string, Record<string, string>>;
        const movieData = q.question_pool_movies as unknown as { title: string; poster_path: string | null; genre: string | null };

        return {
            id: q.id,
            movieTitle: movieData?.title || '',
            moviePosterPath: movieData?.poster_path || null,
            movieGenre: movieData?.genre || null,
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
        sessionId: session.id,
        mode,
        totalQuestions: shuffled.length,
        timeLimitSeconds: config.timeLimitSeconds,
        startedAt: now.toISOString(),
        expiresAt,
        questions: formattedQuestions
    }, cors);
}
