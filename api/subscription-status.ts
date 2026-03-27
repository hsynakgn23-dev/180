import { createCorsHeaders } from './lib/cors.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
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

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type, apikey, x-client-info',
        methods: 'GET, OPTIONS'
    });

    if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

    const accessToken = getBearerToken(req);
    if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !supabaseServiceKey) return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

    // Get subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, provider, status, starts_at, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

    // Get profile tier
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, last_ad_shown_at')
        .eq('user_id', user.id)
        .single();

    // Get daily rush count
    const { data: dailyRushCount } = await supabase
        .rpc('get_daily_rush_count', { p_user_id: user.id });

    const isPremium = subscription?.plan === 'premium' && subscription?.status === 'active';
    const tier = isPremium ? 'premium' : 'free';

    return sendJson(res, 200, {
        ok: true,
        tier,
        isPremium,
        subscription: subscription ? {
            plan: subscription.plan,
            provider: subscription.provider,
            status: subscription.status,
            startsAt: subscription.starts_at,
            expiresAt: subscription.expires_at
        } : null,
        limits: {
            dailyRushUsed: dailyRushCount || 0,
            dailyRushLimit: isPremium ? null : 3,
            endlessMode: isPremium,
            adsEnabled: !isPremium
        },
        lastAdShownAt: profile?.last_ad_shown_at || null
    }, cors);
}
