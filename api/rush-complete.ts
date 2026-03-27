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

// XP thresholds and rewards
const RUSH_XP_CONFIG = {
    rush_15: { threshold: 10, xp: 75 },
    rush_30: { threshold: 21, xp: 180 },
    endless: { threshold: 10, xpPerThreshold: 30 }
} as const;

const sendJson = (
    res: ApiResponse,
    status: number,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    }
    if (res && typeof res.status === 'function') return res.status(status).json(payload);
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
    const sessionId = String(bodyObj.sessionId || '').trim();

    if (!sessionId) {
        return sendJson(res, 400, { ok: false, error: 'Missing sessionId.' }, cors);
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
        .from('quiz_rush_sessions')
        .select('id, user_id, mode, status, correct_count, wrong_count, total_questions, time_limit_seconds, started_at, expires_at')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (sessionError || !session) {
        return sendJson(res, 404, { ok: false, error: 'Session not found.' }, cors);
    }

    if (session.status !== 'in_progress') {
        return sendJson(res, 409, { ok: false, error: 'Session already completed.', status: session.status }, cors);
    }

    const now = new Date();
    const isExpired = session.expires_at && now > new Date(session.expires_at);
    const finalStatus = isExpired ? 'expired' : 'completed';

    // Calculate XP
    const mode = session.mode as keyof typeof RUSH_XP_CONFIG;
    let xpEarned = 0;

    if (mode === 'endless') {
        const endlessConfig = RUSH_XP_CONFIG.endless;
        const thresholdsMet = Math.floor((session.correct_count || 0) / endlessConfig.threshold);
        xpEarned = thresholdsMet * endlessConfig.xpPerThreshold;
    } else {
        const modeConfig = RUSH_XP_CONFIG[mode];
        if (modeConfig && (session.correct_count || 0) >= modeConfig.threshold) {
            xpEarned = modeConfig.xp;
        }
    }

    // Update session
    await supabase
        .from('quiz_rush_sessions')
        .update({
            status: finalStatus,
            xp_earned: xpEarned,
            completed_at: now.toISOString()
        })
        .eq('id', sessionId);

    // Update profile XP
    if (xpEarned > 0) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('xp_state')
            .eq('user_id', user.id)
            .single();

        if (profile) {
            const xpState = (profile.xp_state || {}) as Record<string, unknown>;
            const currentXp = Number(xpState.xp || 0);
            await supabase
                .from('profiles')
                .update({
                    xp_state: { ...xpState, xp: currentXp + xpEarned },
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id);
        }
    }

    // Check ad trigger
    const { data: profileSub } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

    const isFreeUser = !profileSub?.subscription_tier || profileSub.subscription_tier === 'free';
    const shouldShowAd = isFreeUser;

    // Record ad impression if needed
    if (shouldShowAd) {
        await supabase
            .from('ad_impressions')
            .insert({
                user_id: user.id,
                trigger_type: 'rush',
                shown_at: now.toISOString()
            });
    }

    const modeConfig = mode === 'endless' ? RUSH_XP_CONFIG.endless : RUSH_XP_CONFIG[mode];
    const threshold = mode === 'endless' ? RUSH_XP_CONFIG.endless.threshold : (modeConfig as { threshold: number }).threshold;
    const passedThreshold = (session.correct_count || 0) >= threshold;

    return sendJson(res, 200, {
        ok: true,
        sessionId,
        mode: session.mode,
        status: finalStatus,
        correctCount: session.correct_count,
        wrongCount: session.wrong_count,
        totalQuestions: session.total_questions,
        xpEarned,
        passedThreshold,
        threshold,
        shouldShowAd,
        summary: {
            accuracy: session.total_questions > 0
                ? Math.round(((session.correct_count || 0) / session.total_questions) * 100)
                : 0,
            timeUsed: session.started_at
                ? Math.round((now.getTime() - new Date(session.started_at).getTime()) / 1000)
                : 0
        }
    }, cors);
}
