import {
    clampInteger,
    normalizeUuid,
    parseBody,
    requireAdminAccess,
    sendJson,
    toObject,
    toText,
    type ApiRequest,
    type ApiResponse
} from '../lib/admin.js';

export const config = { runtime: 'nodejs' };

type GiftType = 'tickets' | 'premium';

const VALID_GIFT_TYPES = new Set<GiftType>(['tickets', 'premium']);

// Generate a random uppercase alphanumeric code, e.g. "CINE-A3K9-X72M"
const generateGiftCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
    const segment = (len: number) =>
        Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `CINE-${segment(4)}-${segment(4)}`;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const access = await requireAdminAccess(req, res, 'POST,GET,OPTIONS');
    if (!access.ok) return access.response;

    const { corsHeaders, serviceClient, authUser } = access.context;

    // ── GET: list codes created by this admin ────────────────────────────────
    if (req.method === 'GET') {
        const { data, error } = await serviceClient
            .from('gift_codes')
            .select('id,code,gift_type,value,max_uses,use_count,expires_at,note,created_at,is_revoked')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            return sendJson(res, 500, { ok: false, errorCode: 'SERVER_ERROR', message: error.message }, corsHeaders);
        }

        return sendJson(res, 200, { ok: true, data: data ?? [] }, corsHeaders);
    }

    // ── POST: create a new gift code ─────────────────────────────────────────
    const body = toObject(await parseBody(req));
    const giftType = toText(body?.giftType ?? body?.gift_type, 20).toLowerCase() as GiftType;
    const value = clampInteger(body?.value, 1, 5000, 100); // tickets amount OR premium days
    const maxUses = clampInteger(body?.maxUses ?? body?.max_uses, 1, 10000, 1);
    const note = toText(body?.note, 320);
    const expiresInDays = clampInteger(body?.expiresInDays ?? body?.expires_in_days, 0, 365, 30);

    if (!VALID_GIFT_TYPES.has(giftType)) {
        return sendJson(res, 400, {
            ok: false,
            errorCode: 'INVALID_ACTION',
            message: 'giftType must be "tickets" or "premium".'
        }, corsHeaders);
    }

    // Generate a unique code (retry up to 5 times on collision)
    let code = '';
    for (let i = 0; i < 5; i++) {
        const candidate = generateGiftCode();
        const { data: existing } = await serviceClient
            .from('gift_codes')
            .select('code')
            .eq('code', candidate)
            .maybeSingle();
        if (!existing) { code = candidate; break; }
    }

    if (!code) {
        return sendJson(res, 500, { ok: false, errorCode: 'SERVER_ERROR', message: 'Could not generate unique code.' }, corsHeaders);
    }

    const expiresAt = expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const { data: inserted, error: insertError } = await serviceClient
        .from('gift_codes')
        .insert({
            code,
            gift_type: giftType,
            value,
            max_uses: maxUses,
            note: note || null,
            expires_at: expiresAt,
            created_by: authUser.id
        })
        .select('id,code,gift_type,value,max_uses,expires_at,note,created_at')
        .single();

    if (insertError || !inserted) {
        return sendJson(res, 500, { ok: false, errorCode: 'SERVER_ERROR', message: insertError?.message || 'Insert failed.' }, corsHeaders);
    }

    return sendJson(res, 200, { ok: true, data: inserted }, corsHeaders);
}
