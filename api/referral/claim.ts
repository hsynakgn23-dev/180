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
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization'
    };

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
