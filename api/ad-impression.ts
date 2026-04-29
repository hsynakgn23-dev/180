import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
import { isPremiumTier } from './lib/subscriptionAccess.js';
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

    // Check if user is premium (premium users should not see ads)
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

    if (isPremiumTier(profile?.subscription_tier)) {
        return sendJson(res, 200, { ok: true, recorded: false, reason: 'Premium user, no ads.' }, cors);
    }

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const triggerType = String(bodyObj.triggerType || '').trim();

    if (!['ritual', 'timer', 'quiz', 'rush'].includes(triggerType)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid triggerType.' }, cors);
    }

    const now = new Date().toISOString();

    // Record impression
    await supabase
        .from('ad_impressions')
        .insert({
            user_id: user.id,
            trigger_type: triggerType,
            shown_at: now
        });

    // Update last_ad_shown_at on profile
    await supabase
        .from('profiles')
        .update({ last_ad_shown_at: now })
        .eq('user_id', user.id);

    return sendJson(res, 200, {
        ok: true,
        recorded: true,
        triggerType,
        shownAt: now
    }, cors);
}
