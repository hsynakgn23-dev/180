import { createCorsHeaders } from './cors.js';

export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | undefined> | Headers;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiJsonResponder = {
    json: (payload: Record<string, unknown>) => unknown;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => ApiJsonResponder;
};

type AuthUser = {
    id: string;
    email: string;
};

type ClaimSuccessData = {
    code: string;
    inviterUserId: string | null;
    inviterRewardXp: number;
    inviteeRewardXp: number;
    claimCount: number;
};

type ClaimFallbackResult =
    | { ok: true; data: ClaimSuccessData }
    | { ok: false; status: number; errorCode: string; message: string };

const INVITE_CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const DEVICE_KEY_REGEX = /^[a-zA-Z0-9:_-]{8,80}$/;

const sendJson = (
    res: ApiResponse,
    status: number,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
        }
    }

    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }

    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            ...headers
        }
    });
};

const getHeader = (req: ApiRequest, key: string): string => {
    const headers = req.headers;
    if (!headers) return '';

    if (typeof (headers as Headers).get === 'function') {
        return ((headers as Headers).get(key) || '').trim();
    }

    const objectHeaders = headers as Record<string, string | undefined>;
    return (objectHeaders[key.toLowerCase()] || objectHeaders[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
    const authHeader = getHeader(req, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1].trim();
    return token || null;
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
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const toText = (value: unknown, maxLength: number): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeEmail = (email: string | null | undefined, userId: string): string => {
    const value = String(email || '').trim().toLowerCase();
    if (value) return value;
    return `${userId}@users.local`;
};

const normalizeInviteCode = (value: unknown): string =>
    toText(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');

const normalizeDeviceKey = (value: unknown): string =>
    toText(value, 80).replace(/[^a-zA-Z0-9:_-]/g, '');

const getSupabaseConfig = (): { url: string; serviceRoleKey: string; anonKey: string } | null => {
    const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anonKey = String(
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        ''
    ).trim();

    if (!url || !serviceRoleKey || !anonKey) return null;
    return {
        url: url.replace(/\/+$/, ''),
        serviceRoleKey,
        anonKey
    };
};

const readAuthUser = async (
    config: { url: string; anonKey: string },
    accessToken: string
): Promise<AuthUser | null> => {
    try {
        const response = await fetch(`${config.url}/auth/v1/user`, {
            headers: {
                apikey: config.anonKey,
                Authorization: `Bearer ${accessToken}`
            }
        });
        if (!response.ok) return null;

        const raw = (await response.json()) as { id?: unknown; email?: unknown };
        const id = toText(raw.id, 80);
        if (!id) return null;

        return {
            id,
            email: normalizeEmail(toText(raw.email, 240), id)
        };
    } catch {
        return null;
    }
};

const parseRpcRow = (value: unknown): Record<string, unknown> | null => {
    if (Array.isArray(value)) {
        const first = value[0];
        return toObject(first);
    }
    return toObject(value);
};

const mapClaimError = (
    rawMessage: string
): { errorCode: string; status: number; message: string } => {
    const message = rawMessage.toUpperCase();
    if (message.includes('INVALID_CODE')) {
        return { errorCode: 'INVALID_CODE', status: 400, message: 'Invite code is invalid.' };
    }
    if (message.includes('INVITE_NOT_FOUND')) {
        return { errorCode: 'INVITE_NOT_FOUND', status: 404, message: 'Invite code was not found.' };
    }
    if (message.includes('SELF_INVITE')) {
        return { errorCode: 'SELF_INVITE', status: 400, message: 'Self invite is not allowed.' };
    }
    if (message.includes('ALREADY_CLAIMED')) {
        return { errorCode: 'ALREADY_CLAIMED', status: 409, message: 'Account already used an invite code.' };
    }
    if (message.includes('DEVICE_DAILY_LIMIT')) {
        return { errorCode: 'DEVICE_DAILY_LIMIT', status: 429, message: 'Device daily invite limit reached.' };
    }
    if (message.includes('DEVICE_CODE_REUSE')) {
        return { errorCode: 'DEVICE_CODE_REUSE', status: 409, message: 'This device already claimed this code today.' };
    }
    if (message.includes('UNAUTHORIZED')) {
        return { errorCode: 'UNAUTHORIZED', status: 401, message: 'Unauthorized.' };
    }
    return { errorCode: 'SERVER_ERROR', status: 500, message: 'Invite claim failed.' };
};

const isAmbiguousClaimCountError = (rawMessage: string): boolean => {
    const text = rawMessage.toLowerCase();
    return text.includes('claim_count') && text.includes('ambiguous');
};

const parseDbError = (value: unknown): { code: string; message: string; details: string } => {
    const objectValue = toObject(value);
    return {
        code: toText(objectValue?.code, 40),
        message: toText(objectValue?.message || objectValue?.error, 320),
        details: toText(objectValue?.details, 320)
    };
};

const serviceHeaders = (config: { serviceRoleKey: string }, extra: Record<string, string> = {}) => ({
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
    ...extra
});

const fallbackClaimReferralInvite = async (
    config: { url: string; serviceRoleKey: string },
    input: {
        inviteCode: string;
        inviteeUserId: string;
        inviteeEmail: string;
        deviceKey: string;
    }
): Promise<ClaimFallbackResult> => {
    const inviteCode = normalizeInviteCode(input.inviteCode);
    const inviteeUserId = toText(input.inviteeUserId, 80);
    const inviteeEmail = normalizeEmail(input.inviteeEmail, inviteeUserId);
    const deviceKey = normalizeDeviceKey(input.deviceKey);
    const today = new Date().toISOString().slice(0, 10);

    const inviteResp = await fetch(
        `${config.url}/rest/v1/referral_invites?code=eq.${encodeURIComponent(inviteCode)}&select=code,inviter_user_id,inviter_email,claim_count&limit=1`,
        {
            method: 'GET',
            headers: serviceHeaders(config)
        }
    );
    if (!inviteResp.ok) {
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    const inviteRows = (await inviteResp.json().catch(() => [])) as unknown;
    const inviteRow = Array.isArray(inviteRows) ? toObject(inviteRows[0]) : null;
    if (!inviteRow) {
        return { ok: false, status: 404, errorCode: 'INVITE_NOT_FOUND', message: 'Invite code was not found.' };
    }

    const inviterUserId = toText(inviteRow.inviter_user_id, 80) || null;
    const inviterEmail = normalizeEmail(toText(inviteRow.inviter_email, 240), inviterUserId || 'unknown');
    const currentClaimCount = Number(inviteRow.claim_count || 0);

    if (inviterUserId && inviterUserId === inviteeUserId) {
        return { ok: false, status: 400, errorCode: 'SELF_INVITE', message: 'Self invite is not allowed.' };
    }

    if (inviterEmail === inviteeEmail) {
        return { ok: false, status: 400, errorCode: 'SELF_INVITE', message: 'Self invite is not allowed.' };
    }

    const alreadyClaimedResp = await fetch(
        `${config.url}/rest/v1/referral_claims?invitee_user_id=eq.${encodeURIComponent(inviteeUserId)}&select=id&limit=1`,
        {
            method: 'GET',
            headers: serviceHeaders(config)
        }
    );
    if (!alreadyClaimedResp.ok) {
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }
    const alreadyClaimedRows = (await alreadyClaimedResp.json().catch(() => [])) as unknown;
    if (Array.isArray(alreadyClaimedRows) && alreadyClaimedRows.length > 0) {
        return {
            ok: false,
            status: 409,
            errorCode: 'ALREADY_CLAIMED',
            message: 'Account already used an invite code.'
        };
    }

    const deviceRowsResp = await fetch(
        `${config.url}/rest/v1/referral_device_claims?device_key=eq.${encodeURIComponent(deviceKey)}&claim_date=eq.${encodeURIComponent(today)}&select=code,id&limit=10`,
        {
            method: 'GET',
            headers: serviceHeaders(config)
        }
    );
    if (!deviceRowsResp.ok) {
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    const deviceRows = (await deviceRowsResp.json().catch(() => [])) as unknown;
    const normalizedDeviceRows = Array.isArray(deviceRows)
        ? deviceRows.map((row) => toObject(row)).filter(Boolean) as Record<string, unknown>[]
        : [];

    if (normalizedDeviceRows.length >= 3) {
        return {
            ok: false,
            status: 429,
            errorCode: 'DEVICE_DAILY_LIMIT',
            message: 'Device daily invite limit reached.'
        };
    }

    const codeAlreadyUsedOnDevice = normalizedDeviceRows.some((row) => normalizeInviteCode(row.code) === inviteCode);
    if (codeAlreadyUsedOnDevice) {
        return {
            ok: false,
            status: 409,
            errorCode: 'DEVICE_CODE_REUSE',
            message: 'This device already claimed this code today.'
        };
    }

    const insertClaimResp = await fetch(`${config.url}/rest/v1/referral_claims`, {
        method: 'POST',
        headers: serviceHeaders(config, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
            code: inviteCode,
            invitee_user_id: inviteeUserId,
            invitee_email: inviteeEmail,
            inviter_reward_xp: 40,
            invitee_reward_xp: 24
        })
    });

    if (!insertClaimResp.ok) {
        const claimDbError = parseDbError(await insertClaimResp.json().catch(() => ({})));
        const upper = `${claimDbError.code} ${claimDbError.message} ${claimDbError.details}`.toUpperCase();
        if (upper.includes('23505') || upper.includes('UNIQUE') || upper.includes('INVITEE_USER_ID')) {
            return {
                ok: false,
                status: 409,
                errorCode: 'ALREADY_CLAIMED',
                message: 'Account already used an invite code.'
            };
        }
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    const insertDeviceResp = await fetch(`${config.url}/rest/v1/referral_device_claims`, {
        method: 'POST',
        headers: serviceHeaders(config, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
            device_key: deviceKey,
            claim_date: today,
            code: inviteCode,
            invitee_user_id: inviteeUserId
        })
    });

    if (!insertDeviceResp.ok) {
        await fetch(
            `${config.url}/rest/v1/referral_claims?invitee_user_id=eq.${encodeURIComponent(inviteeUserId)}&code=eq.${encodeURIComponent(inviteCode)}`,
            {
                method: 'DELETE',
                headers: serviceHeaders(config)
            }
        ).catch(() => undefined);

        const deviceDbError = parseDbError(await insertDeviceResp.json().catch(() => ({})));
        const upper = `${deviceDbError.code} ${deviceDbError.message} ${deviceDbError.details}`.toUpperCase();
        if (upper.includes('DEVICE_DAILY_LIMIT')) {
            return {
                ok: false,
                status: 429,
                errorCode: 'DEVICE_DAILY_LIMIT',
                message: 'Device daily invite limit reached.'
            };
        }
        if (upper.includes('23505') || upper.includes('UNIQUE') || upper.includes('DEVICE_KEY')) {
            return {
                ok: false,
                status: 409,
                errorCode: 'DEVICE_CODE_REUSE',
                message: 'This device already claimed this code today.'
            };
        }
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    const nextClaimCount = (Number.isFinite(currentClaimCount) ? Math.max(0, currentClaimCount) : 0) + 1;
    const patchInviteResp = await fetch(
        `${config.url}/rest/v1/referral_invites?code=eq.${encodeURIComponent(inviteCode)}&select=claim_count`,
        {
            method: 'PATCH',
            headers: serviceHeaders(config, { Prefer: 'return=representation' }),
            body: JSON.stringify({
                claim_count: nextClaimCount,
                updated_at: new Date().toISOString()
            })
        }
    );

    let finalClaimCount = nextClaimCount;
    if (patchInviteResp.ok) {
        const patchedRows = (await patchInviteResp.json().catch(() => [])) as unknown;
        const patchedRow = Array.isArray(patchedRows) ? toObject(patchedRows[0]) : null;
        const patchedClaimCount = Number(patchedRow?.claim_count);
        if (Number.isFinite(patchedClaimCount)) {
            finalClaimCount = Math.max(0, patchedClaimCount);
        }
    }

    return {
        ok: true,
        data: {
            code: inviteCode,
            inviterUserId,
            inviterRewardXp: 40,
            inviteeRewardXp: 24,
            claimCount: finalClaimCount
        }
    };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const corsHeaders = createCorsHeaders(req, {
        methods: 'POST,OPTIONS',
        headers: 'content-type,authorization'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, { ok: true }, corsHeaders);
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, errorCode: 'SERVER_ERROR', message: 'Method not allowed' }, corsHeaders);
    }

    const config = getSupabaseConfig();
    if (!config) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Missing Supabase env config.' },
            corsHeaders
        );
    }

    const token = getBearerToken(req);
    if (!token) {
        return sendJson(
            res,
            401,
            { ok: false, errorCode: 'UNAUTHORIZED', message: 'Missing bearer token.' },
            corsHeaders
        );
    }

    const authUser = await readAuthUser(config, token);
    if (!authUser) {
        return sendJson(
            res,
            401,
            { ok: false, errorCode: 'UNAUTHORIZED', message: 'Session is not valid.' },
            corsHeaders
        );
    }

    const body = await parseBody(req);
    const objectBody = toObject(body);
    const inviteCode = normalizeInviteCode(objectBody?.code);
    const deviceKey = normalizeDeviceKey(objectBody?.deviceKey);

    if (!INVITE_CODE_REGEX.test(inviteCode)) {
        return sendJson(
            res,
            400,
            { ok: false, errorCode: 'INVALID_CODE', message: 'Invite code is invalid.' },
            corsHeaders
        );
    }

    if (!DEVICE_KEY_REGEX.test(deviceKey)) {
        return sendJson(
            res,
            400,
            { ok: false, errorCode: 'DEVICE_CODE_REUSE', message: 'Device key is invalid.' },
            corsHeaders
        );
    }

    const rpcResponse = await fetch(`${config.url}/rest/v1/rpc/claim_referral_invite`, {
        method: 'POST',
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            p_code: inviteCode,
            p_invitee_user_id: authUser.id,
            p_invitee_email: authUser.email,
            p_device_key: deviceKey
        })
    });

    const rawPayload = (await rpcResponse.json().catch(() => ({}))) as unknown;
    if (!rpcResponse.ok) {
        const rpcError = toObject(rawPayload);
        const rawMessage = toText(rpcError?.message || rpcError?.error || '', 320);

        if (isAmbiguousClaimCountError(rawMessage)) {
            const fallback = await fallbackClaimReferralInvite(config, {
                inviteCode,
                inviteeUserId: authUser.id,
                inviteeEmail: authUser.email,
                deviceKey
            });

            if (fallback.ok === false) {
                return sendJson(
                    res,
                    fallback.status,
                    {
                        ok: false,
                        errorCode: fallback.errorCode,
                        message: fallback.message
                    },
                    corsHeaders
                );
            }

            return sendJson(
                res,
                200,
                {
                    ok: true,
                    data: fallback.data
                },
                corsHeaders
            );
        }

        const mapped = mapClaimError(rawMessage);
        return sendJson(
            res,
            mapped.status,
            {
                ok: false,
                errorCode: mapped.errorCode,
                message: mapped.message
            },
            corsHeaders
        );
    }

    const row = parseRpcRow(rawPayload);
    const responseCode = normalizeInviteCode(row?.code);
    const inviterUserId = toText(row?.inviter_user_id ?? row?.inviterUserId, 80) || null;
    const inviterRewardXp = Number(row?.inviter_reward_xp ?? row?.inviterRewardXp ?? 40);
    const inviteeRewardXp = Number(row?.invitee_reward_xp ?? row?.inviteeRewardXp ?? 24);
    const claimCount = Number(row?.claim_count ?? row?.claimCount ?? 0);

    if (!INVITE_CODE_REGEX.test(responseCode)) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'RPC did not return a valid claim payload.' },
            corsHeaders
        );
    }

    return sendJson(
        res,
        200,
        {
            ok: true,
            data: {
                code: responseCode,
                inviterUserId,
                inviterRewardXp: Number.isFinite(inviterRewardXp) ? Math.max(0, inviterRewardXp) : 40,
                inviteeRewardXp: Number.isFinite(inviteeRewardXp) ? Math.max(0, inviteeRewardXp) : 24,
                claimCount: Number.isFinite(claimCount) ? Math.max(0, claimCount) : 0
            }
        },
        corsHeaders
    );
}
