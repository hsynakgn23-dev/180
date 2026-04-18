import { createCorsHeaders } from './lib/cors.js';
import { applyProgressionReward } from './lib/progressionProfile.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import { applyProgressionReward } from './lib/progressionProfile.js';

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

const normalizeText = (value: unknown, maxLength = 200): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

type GiftRedemptionClaimRow = {
    redemptionId: string;
    code: string;
    giftType: 'tickets' | 'premium';
    value: number;
    status: 'pending' | 'fulfilled';
};

const normalizeGiftClaimRow = (value: unknown): GiftRedemptionClaimRow | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const redemptionId = normalizeText(row.redemption_id ?? row.redemptionId, 120);
    const code = normalizeCode(row.code);
    const giftType = normalizeText(row.gift_type ?? row.giftType, 40);
    const valueNumber = Number(row.value);
    const status = normalizeText(row.status, 40);
    if (!redemptionId || !code || !Number.isFinite(valueNumber)) return null;
    if (giftType !== 'tickets' && giftType !== 'premium') return null;
    if (status !== 'pending' && status !== 'fulfilled') return null;
    return {
        redemptionId,
        code,
        giftType,
        value: Math.max(0, Math.floor(valueNumber)),
        status,
    };
};

const normalizeGiftClaimResponse = (value: unknown): GiftRedemptionClaimRow | null => {
    if (Array.isArray(value)) return normalizeGiftClaimRow(value[0] ?? null);
    return normalizeGiftClaimRow(value);
};

const mapGiftClaimError = (message: string): string => {
    const normalized = normalizeText(message, 200).toUpperCase();
    if (!normalized) return 'GIFT_REDEEM_FAILED';
    if (normalized.includes('INVALID_CODE')) return 'INVALID_CODE';
    if (normalized.includes('CODE_NOT_FOUND')) return 'CODE_NOT_FOUND';
    if (normalized.includes('CODE_REVOKED')) return 'CODE_REVOKED';
    if (normalized.includes('CODE_EXPIRED')) return 'CODE_EXPIRED';
    if (normalized.includes('CODE_EXHAUSTED')) return 'CODE_EXHAUSTED';
    if (normalized.includes('UNAUTHORIZED')) return 'UNAUTHORIZED';
    return 'GIFT_REDEEM_FAILED';
};

const claimGiftRedemption = async (
    supabase: ReturnType<typeof createSupabaseServiceClient>,
    code: string,
    userId: string
): Promise<GiftRedemptionClaimRow> => {
    const { data, error } = await supabase.rpc('claim_gift_code_redemption', {
        p_code: code,
        p_user_id: userId,
    });
    if (error) throw new Error(mapGiftClaimError(error.message));
    const normalized = normalizeGiftClaimResponse(data);
    if (!normalized) throw new Error('GIFT_REDEEM_FAILED');
    return normalized;
};

const markGiftRedemptionFulfilled = async (
    supabase: ReturnType<typeof createSupabaseServiceClient>,
    redemptionId: string,
    userId: string
): Promise<void> => {
    const { error } = await supabase.rpc('mark_gift_code_redemption_fulfilled', {
        p_redemption_id: redemptionId,
        p_user_id: userId,
    });
    if (error) {
        throw new Error(normalizeText(error.message, 200) || 'MARK_REDEMPTION_FULFILLED_FAILED');
    }
};

const markGiftRedemptionFailed = async (
    supabase: ReturnType<typeof createSupabaseServiceClient>,
    redemptionId: string,
    userId: string,
    errorMessage: string
): Promise<void> => {
    const { error } = await supabase.rpc('mark_gift_code_redemption_failed', {
        p_redemption_id: redemptionId,
        p_user_id: userId,
        p_last_error: normalizeText(errorMessage, 500) || null,
    });
    if (error) {
        console.warn('[gift-redeem] failed to record redemption failure', {
            redemptionId,
            userId,
            message: normalizeText(error.message, 200),
        });
    }
};

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

    let claim: GiftRedemptionClaimRow;
    try {
        claim = await claimGiftRedemption(supabase, code, user.id);
    } catch (error) {
        const mappedError = mapGiftClaimError(error instanceof Error ? error.message : '');
        const status =
            mappedError === 'INVALID_CODE' ? 400
                : mappedError === 'CODE_NOT_FOUND' ? 404
                    : mappedError === 'UNAUTHORIZED' ? 401
                        : mappedError === 'GIFT_REDEEM_FAILED' ? 500
                            : 410;
        return sendJson(res, status, { ok: false, error: mappedError }, cors);
    }

    if (claim.status === 'fulfilled') {
        return sendJson(res, 409, { ok: false, error: 'ALREADY_REDEEMED' }, cors);
    }

    const giftType = claim.giftType;
    const value = claim.value;
    const fallbackDisplayName = (user.email ?? '').split('@')[0] || null;

    try {
        if (giftType === 'tickets') {
            await applyProgressionReward({
                supabase,
                userId: user.id,
                fallbackEmail: user.email,
                fallbackDisplayName,
                reward: { xp: 0, tickets: value, arenaScore: 0, arenaActivity: 0 },
                idempotencyKey: `gift_code:${claim.redemptionId}`,
                ledger: {
                    source: 'gift_code',
                    sourceId: claim.redemptionId,
                    reason: 'gift_redeem',
                    metadata: {
                        code: claim.code,
                        giftType,
                        value,
                    },
                    eventKey: `gift_code:${claim.redemptionId}`,
                }
            });
        } else {
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
                    metadata: {
                        source: 'gift_code',
                        code: claim.code,
                        redemption_id: claim.redemptionId,
                        granted_at: now.toISOString(),
                    }
                },
                { onConflict: 'user_id' }
            );

            if (subError) {
                throw new Error('SUBSCRIPTION_UPDATE_FAILED');
            }

            await supabase
                .from('profiles')
                .update({ subscription_tier: 'premium', updated_at: new Date().toISOString() })
                .eq('user_id', user.id);
        }

        await markGiftRedemptionFulfilled(supabase, claim.redemptionId, user.id);
    } catch (error) {
        const message = normalizeText(error instanceof Error ? error.message : 'GIFT_REDEEM_FAILED', 200);
        await markGiftRedemptionFailed(supabase, claim.redemptionId, user.id, message);
        if (message === 'SUBSCRIPTION_UPDATE_FAILED') {
            return sendJson(res, 500, { ok: false, error: 'SUBSCRIPTION_UPDATE_FAILED' }, cors);
        }
        if (giftType === 'tickets') {
            return sendJson(res, 500, { ok: false, error: 'WALLET_UPDATE_FAILED' }, cors);
        }
        return sendJson(res, 500, { ok: false, error: 'GIFT_REDEEM_FAILED' }, cors);
    }

    return sendJson(res, 200, {
        ok: true,
        giftType,
        value,
        code: claim.code
    }, cors);
}
