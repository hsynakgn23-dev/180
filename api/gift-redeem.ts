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

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>, headers: Record<string, string> = {}) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    }
    if (res && typeof res.status === 'function') return res.status(status).json(payload);
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
    });
};

const getHeader = (req: ApiRequest, key: string): string => {
    const h = req.headers;
    if (!h) return '';
    if (typeof (h as Headers).get === 'function') return ((h as Headers).get(key) || '').trim();
    const obj = h as Record<string, string | undefined>;
    return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
    const match = getHeader(req, 'authorization').match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() || null : null;
};

const parseBody = async (req: ApiRequest): Promise<unknown> => {
    if (req.body !== undefined) return req.body;
    if (typeof req.on !== 'function') return null;
    const chunks: string[] = [];
    await new Promise<void>((resolve) => {
        req.on?.('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)));
        req.on?.('end', () => resolve());
    });
    const raw = chunks.join('').trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
};

const normalizeCode = (value: unknown): string =>
    String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type',
        methods: 'POST, OPTIONS'
    });

    if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

    const accessToken = getBearerToken(req);
    if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !serviceKey) return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);

    const supabase = createSupabaseServiceClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const code = normalizeCode(bodyObj.code);

    if (!code || code.length < 6) {
        return sendJson(res, 400, { ok: false, error: 'Invalid code format.' }, cors);
    }

    // ── Fetch the gift code ──────────────────────────────────────────────────
    const { data: giftCode, error: codeError } = await supabase
        .from('gift_codes')
        .select('id,code,gift_type,value,max_uses,use_count,expires_at,is_revoked')
        .eq('code', code)
        .maybeSingle();

    if (codeError || !giftCode) {
        return sendJson(res, 404, { ok: false, error: 'CODE_NOT_FOUND' }, cors);
    }

    if (giftCode.is_revoked) {
        return sendJson(res, 410, { ok: false, error: 'CODE_REVOKED' }, cors);
    }

    if (giftCode.expires_at && new Date(giftCode.expires_at) < new Date()) {
        return sendJson(res, 410, { ok: false, error: 'CODE_EXPIRED' }, cors);
    }

    if (giftCode.use_count >= giftCode.max_uses) {
        return sendJson(res, 410, { ok: false, error: 'CODE_EXHAUSTED' }, cors);
    }

    // ── Check if user already redeemed this code ─────────────────────────────
    const { data: existingRedemption } = await supabase
        .from('gift_code_redemptions')
        .select('id')
        .eq('code', code)
        .eq('user_id', user.id)
        .maybeSingle();

    if (existingRedemption) {
        return sendJson(res, 409, { ok: false, error: 'ALREADY_REDEEMED' }, cors);
    }

    // ── Apply the gift ────────────────────────────────────────────────────────
    const giftType = giftCode.gift_type as 'tickets' | 'premium';
    const value = Number(giftCode.value);

    if (giftType === 'tickets') {
        // Read-modify-write wallet with optimistic retry
        const MAX_RETRIES = 5;
        let granted = false;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const { data: profileRow } = await supabase
                .from('profiles')
                .select('xp_state, updated_at')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!profileRow) break;

            const xpState = (
                profileRow.xp_state && typeof profileRow.xp_state === 'object' && !Array.isArray(profileRow.xp_state)
                    ? profileRow.xp_state : {}
            ) as Record<string, unknown>;

            const wallet = (
                xpState.wallet && typeof xpState.wallet === 'object' && !Array.isArray(xpState.wallet)
                    ? xpState.wallet : {}
            ) as Record<string, unknown>;

            const { error: writeError } = await supabase
                .from('profiles')
                .update({
                    xp_state: {
                        ...xpState,
                        wallet: {
                            ...wallet,
                            balance: Math.max(0, Number(wallet.balance) || 0) + value,
                            lifetimeEarned: Math.max(0, Number(wallet.lifetimeEarned) || 0) + value
                        }
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('updated_at', profileRow.updated_at);

            if (!writeError) { granted = true; break; }
            if (attempt === MAX_RETRIES - 1) {
                return sendJson(res, 500, { ok: false, error: 'WALLET_UPDATE_FAILED' }, cors);
            }
        }

        if (!granted) {
            return sendJson(res, 500, { ok: false, error: 'WALLET_UPDATE_FAILED' }, cors);
        }

    } else if (giftType === 'premium') {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + value * 24 * 60 * 60 * 1000).toISOString();

        const { error: subError } = await supabase.from('subscriptions').upsert(
            {
                user_id: user.id,
                plan: 'premium',
                provider: 'gift_code',
                status: 'active',
                starts_at: now.toISOString(),
                expires_at: expiresAt,
                metadata: { source: 'gift_code', code, granted_at: now.toISOString() }
            },
            { onConflict: 'user_id' }
        );

        if (subError) {
            return sendJson(res, 500, { ok: false, error: 'SUBSCRIPTION_UPDATE_FAILED' }, cors);
        }

        await supabase
            .from('profiles')
            .update({ subscription_tier: 'premium', updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
    }

    // ── Record redemption & increment use_count atomically ───────────────────
    const { error: redemptionError } = await supabase
        .from('gift_code_redemptions')
        .insert({ code, user_id: user.id, gift_type: giftType, value });

    if (redemptionError) {
        // Unique constraint violation = already redeemed (race condition)
        if (redemptionError.code === '23505') {
            return sendJson(res, 409, { ok: false, error: 'ALREADY_REDEEMED' }, cors);
        }
        return sendJson(res, 500, { ok: false, error: 'REDEMPTION_LOG_FAILED' }, cors);
    }

    await supabase
        .from('gift_codes')
        .update({ use_count: giftCode.use_count + 1 })
        .eq('code', code);

    return sendJson(res, 200, {
        ok: true,
        giftType,
        value,
        code
    }, cors);
}
