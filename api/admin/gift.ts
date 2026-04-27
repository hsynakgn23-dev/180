import { randomInt } from 'node:crypto';
import {
    type AdminContext,
    clampInteger,
    isSupabaseCapabilityError,
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

type GiftCodeRow = {
    id: string;
    code: string;
    gift_type: GiftType;
    value: number;
    max_uses: number;
    use_count: number;
    expires_at: string | null;
    note: string | null;
    created_at: string;
    is_revoked: boolean;
    redemption_count?: number;
    redemptions?: GiftRedemptionRow[];
    auditWarning?: string;
};

type GiftRedemptionRow = {
    id: string;
    code: string;
    user_id: string | null;
    gift_type: string;
    value: number;
    status: string;
    redeemed_at: string | null;
    fulfilled_at: string | null;
    last_error: string | null;
};

const VALID_GIFT_TYPES = new Set<GiftType>(['tickets', 'premium']);
const GIFT_CODE_SELECT =
    'id,code,gift_type,value,max_uses,use_count,expires_at,note,created_at,is_revoked';
const GIFT_REDEMPTION_SELECT =
    'id,code,user_id,gift_type,value,status,redeemed_at,fulfilled_at,last_error';
const GIFT_REDEMPTION_FALLBACK_SELECT = 'id,code,user_id,gift_type,value,redeemed_at';

const getErrorMessage = (error: unknown, fallback = 'Admin operation failed.'): string => {
    if (!error) return '';
    if (error instanceof Error) return error.message || fallback;
    if (typeof error === 'object' && 'message' in error) {
        return toText((error as { message?: unknown }).message, 320) || fallback;
    }
    return fallback;
};

const normalizeGiftType = (value: unknown): GiftType => {
    const giftType = toText(value, 20).toLowerCase();
    return giftType === 'premium' ? 'premium' : 'tickets';
};

const normalizeNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeGiftCode = (row: unknown): GiftCodeRow | null => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const record = row as Record<string, unknown>;
    const id = normalizeUuid(record.id);
    const code = toText(record.code, 80).toUpperCase();
    if (!id || !code) return null;

    return {
        id,
        code,
        gift_type: normalizeGiftType(record.gift_type),
        value: normalizeNumber(record.value),
        max_uses: normalizeNumber(record.max_uses, 1),
        use_count: normalizeNumber(record.use_count),
        expires_at: toText(record.expires_at, 80) || null,
        note: toText(record.note, 320) || null,
        created_at: toText(record.created_at, 80),
        is_revoked: Boolean(record.is_revoked),
        redemption_count: 0,
        redemptions: []
    };
};

const normalizeGiftRedemption = (row: unknown): GiftRedemptionRow | null => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const record = row as Record<string, unknown>;
    const id = normalizeUuid(record.id);
    const code = toText(record.code, 80).toUpperCase();
    if (!id || !code) return null;

    return {
        id,
        code,
        user_id: normalizeUuid(record.user_id) || null,
        gift_type: toText(record.gift_type, 20) || 'tickets',
        value: normalizeNumber(record.value),
        status: toText(record.status, 32) || 'fulfilled',
        redeemed_at: toText(record.redeemed_at, 80) || null,
        fulfilled_at: toText(record.fulfilled_at, 80) || null,
        last_error: toText(record.last_error, 320) || null
    };
};

const generateGiftCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segment = (length: number) =>
        Array.from({ length }, () => chars[randomInt(chars.length)]).join('');
    return `CINE-${segment(4)}-${segment(4)}`;
};

const createAuditAction = async (
    serviceClient: AdminContext['serviceClient'],
    payload: Record<string, unknown>
): Promise<{ id: string; error: string }> => {
    const { data, error } = await serviceClient
        .from('moderation_actions')
        .insert([payload])
        .select('id')
        .single();

    if (error) return { id: '', error: getErrorMessage(error, 'Audit write failed.') };

    const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const id = normalizeUuid(record.id);
    if (!id) return { id: '', error: 'Audit write did not return an id.' };
    return { id, error: '' };
};

const updateAuditStatus = async (
    serviceClient: AdminContext['serviceClient'],
    auditId: string,
    metadata: Record<string, unknown>,
    status: string,
    errorMessage?: string
): Promise<string> => {
    if (!auditId) return '';

    const { error } = await serviceClient
        .from('moderation_actions')
        .update({
            metadata: {
                ...metadata,
                status,
                ...(errorMessage ? { error: errorMessage } : {})
            }
        })
        .eq('id', auditId);

    return getErrorMessage(error, 'Audit update failed.');
};

const loadGiftRedemptions = async (
    serviceClient: AdminContext['serviceClient'],
    codes: string[]
): Promise<{ rows: GiftRedemptionRow[]; warning: string }> => {
    if (!codes.length) return { rows: [], warning: '' };

    const primary = await serviceClient
        .from('gift_code_redemptions')
        .select(GIFT_REDEMPTION_SELECT)
        .in('code', codes)
        .order('redeemed_at', { ascending: false })
        .limit(500);

    if (!primary.error) {
        return {
            rows: (primary.data || []).flatMap((row) => normalizeGiftRedemption(row) || []),
            warning: ''
        };
    }

    if (!isSupabaseCapabilityError(primary.error)) {
        return { rows: [], warning: getErrorMessage(primary.error, 'Redemption read failed.') };
    }

    const fallback = await serviceClient
        .from('gift_code_redemptions')
        .select(GIFT_REDEMPTION_FALLBACK_SELECT)
        .in('code', codes)
        .order('redeemed_at', { ascending: false })
        .limit(500);

    return {
        rows: (fallback.data || []).flatMap((row) => normalizeGiftRedemption(row) || []),
        warning: getErrorMessage(fallback.error, '')
    };
};

const attachGiftRedemptions = async (
    serviceClient: AdminContext['serviceClient'],
    codes: GiftCodeRow[]
): Promise<{ rows: GiftCodeRow[]; warning: string }> => {
    const codeValues = Array.from(new Set(codes.map((code) => code.code).filter(Boolean)));
    const { rows: redemptions, warning } = await loadGiftRedemptions(serviceClient, codeValues);
    const redemptionsByCode = new Map<string, GiftRedemptionRow[]>();

    for (const redemption of redemptions) {
        const existing = redemptionsByCode.get(redemption.code) || [];
        existing.push(redemption);
        redemptionsByCode.set(redemption.code, existing);
    }

    return {
        rows: codes.map((code) => {
            const codeRedemptions = redemptionsByCode.get(code.code) || [];
            return {
                ...code,
                redemption_count: codeRedemptions.length || code.use_count,
                redemptions: codeRedemptions.slice(0, 8)
            };
        }),
        warning
    };
};

const createUniqueCode = async (
    serviceClient: AdminContext['serviceClient']
): Promise<{ code: string; error: string }> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = generateGiftCode();
        const { data, error } = await serviceClient
            .from('gift_codes')
            .select('id')
            .eq('code', candidate)
            .maybeSingle();

        if (error) return { code: '', error: getErrorMessage(error, 'Code lookup failed.') };
        if (!data) return { code: candidate, error: '' };
    }

    return { code: '', error: 'Could not generate a unique gift code.' };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const access = await requireAdminAccess(req, res, 'PATCH,POST,GET,OPTIONS');
    if (!access.ok) return access.response;

    const { corsHeaders, serviceClient, authUser } = access.context;
    const method = toText(req.method, 20).toUpperCase() || 'GET';

    if (method === 'GET') {
        const { data, error } = await serviceClient
            .from('gift_codes')
            .select(GIFT_CODE_SELECT)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: error.message },
                corsHeaders
            );
        }

        const normalizedCodes = (data || []).flatMap((row) => normalizeGiftCode(row) || []);
        const { rows, warning } = await attachGiftRedemptions(serviceClient, normalizedCodes);
        return sendJson(res, 200, { ok: true, data: rows, warning: warning || undefined }, corsHeaders);
    }

    const body = toObject(await parseBody(req));

    if (method === 'PATCH') {
        const codeId = normalizeUuid(body?.codeId ?? body?.id);
        if (!codeId || typeof body?.isRevoked !== 'boolean') {
            return sendJson(
                res,
                400,
                {
                    ok: false,
                    errorCode: 'INVALID_ID',
                    message: 'codeId and isRevoked are required.'
                },
                corsHeaders
            );
        }

        const { data: existing, error: existingError } = await serviceClient
            .from('gift_codes')
            .select(GIFT_CODE_SELECT)
            .eq('id', codeId)
            .maybeSingle();
        const existingGiftCode = normalizeGiftCode(existing);

        if (existingError) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: existingError.message },
                corsHeaders
            );
        }

        if (!existingGiftCode) {
            return sendJson(
                res,
                404,
                { ok: false, errorCode: 'NOT_FOUND', message: 'Gift code was not found.' },
                corsHeaders
            );
        }

        const nextRevoked = body.isRevoked === true;
        const note = toText(body?.note, 320);
        const auditMetadata = {
            status: 'requested',
            requestedAt: new Date().toISOString(),
            code: existingGiftCode.code,
            codeId,
            previousRevoked: existingGiftCode.is_revoked,
            nextRevoked
        };
        const audit = await createAuditAction(serviceClient, {
            actor_user_id: authUser.id,
            target_user_id: null,
            action: nextRevoked ? 'gift_code_revoke' : 'gift_code_restore',
            reason_code: nextRevoked ? 'admin_revoke' : 'admin_restore',
            note,
            metadata: auditMetadata
        });

        if (audit.error) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: audit.error },
                corsHeaders
            );
        }

        const { data: updated, error: updateError } = await serviceClient
            .from('gift_codes')
            .update({
                is_revoked: nextRevoked,
                ...(note ? { note } : {})
            })
            .eq('id', codeId)
            .select(GIFT_CODE_SELECT)
            .single();

        if (updateError || !updated) {
            const message = getErrorMessage(updateError, 'Gift code update failed.');
            await updateAuditStatus(serviceClient, audit.id, auditMetadata, 'failed', message);
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message },
                corsHeaders
            );
        }

        const normalizedUpdated = normalizeGiftCode(updated);
        const { rows } = normalizedUpdated
            ? await attachGiftRedemptions(serviceClient, [normalizedUpdated])
            : { rows: [] };
        const auditWarning = await updateAuditStatus(
            serviceClient,
            audit.id,
            auditMetadata,
            'fulfilled'
        );

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: rows[0]
                    ? { ...rows[0], auditWarning: auditWarning || undefined }
                    : normalizedUpdated
                      ? { ...normalizedUpdated, auditWarning: auditWarning || undefined }
                      : null
            },
            corsHeaders
        );
    }

    if (method !== 'POST') {
        return sendJson(
            res,
            405,
            { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
            corsHeaders
        );
    }

    const giftType = toText(body?.giftType ?? body?.gift_type, 20).toLowerCase() as GiftType;
    const value = clampInteger(body?.value, 1, 5000, 100);
    const maxUses = clampInteger(body?.maxUses ?? body?.max_uses, 1, 10000, 1);
    const note = toText(body?.note, 320);
    const expiresInDays = clampInteger(body?.expiresInDays ?? body?.expires_in_days, 0, 365, 30);

    if (!VALID_GIFT_TYPES.has(giftType)) {
        return sendJson(
            res,
            400,
            {
                ok: false,
                errorCode: 'INVALID_ACTION',
                message: 'giftType must be "tickets" or "premium".'
            },
            corsHeaders
        );
    }

    const uniqueCode = await createUniqueCode(serviceClient);
    if (uniqueCode.error) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: uniqueCode.error },
            corsHeaders
        );
    }

    const expiresAt =
        expiresInDays > 0
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : null;
    const auditMetadata = {
        status: 'requested',
        requestedAt: new Date().toISOString(),
        code: uniqueCode.code,
        giftType,
        value,
        maxUses,
        expiresAt
    };
    const audit = await createAuditAction(serviceClient, {
        actor_user_id: authUser.id,
        target_user_id: null,
        action: 'gift_code_create',
        reason_code: 'admin_gift_code_create',
        note,
        metadata: auditMetadata
    });

    if (audit.error) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: audit.error },
            corsHeaders
        );
    }

    const { data: inserted, error: insertError } = await serviceClient
        .from('gift_codes')
        .insert({
            code: uniqueCode.code,
            gift_type: giftType,
            value,
            max_uses: maxUses,
            note: note || null,
            expires_at: expiresAt,
            created_by: authUser.id
        })
        .select(GIFT_CODE_SELECT)
        .single();

    if (insertError || !inserted) {
        const message = getErrorMessage(insertError, 'Gift code insert failed.');
        await updateAuditStatus(serviceClient, audit.id, auditMetadata, 'failed', message);
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message },
            corsHeaders
        );
    }

    const normalizedInserted = normalizeGiftCode(inserted);
    const auditWarning = await updateAuditStatus(
        serviceClient,
        audit.id,
        auditMetadata,
        'fulfilled'
    );

    return sendJson(
        res,
        200,
        {
            ok: true,
            data: normalizedInserted
                ? { ...normalizedInserted, auditWarning: auditWarning || undefined }
                : null
        },
        corsHeaders
    );
}
