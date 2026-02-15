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

const getAppOrigin = (req: ApiRequest): string => {
    const configuredOrigin = String(
        process.env.VITE_PUBLIC_APP_URL ||
        process.env.PUBLIC_APP_URL ||
        ''
    ).trim();
    if (configuredOrigin) {
        return configuredOrigin.replace(/\/+$/, '');
    }

    const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
    const proto = getHeader(req, 'x-forwarded-proto') || 'https';
    if (!host) return '';
    return `${proto}://${host}`.replace(/\/+$/, '');
};

const buildInviteLink = (req: ApiRequest, inviteCode: string): string => {
    if (!INVITE_CODE_REGEX.test(inviteCode)) return '';
    const origin = getAppOrigin(req);
    if (!origin) return '';

    try {
        const url = new URL(origin);
        url.searchParams.set('invite', inviteCode);
        url.searchParams.set('utm_source', 'invite');
        url.searchParams.set('utm_medium', 'referral');
        url.searchParams.set('utm_campaign', 'user_invite');
        return url.toString();
    } catch {
        return '';
    }
};

const parseRpcRow = (value: unknown): Record<string, unknown> | null => {
    if (Array.isArray(value)) {
        const first = value[0];
        return toObject(first);
    }
    return toObject(value);
};

const mapRpcErrorMessage = (message: string): string => {
    if (!message) return 'Invite code create failed.';
    if (message.toUpperCase().includes('UNAUTHORIZED')) {
        return 'Unauthorized.';
    }
    return 'Invite code create failed.';
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
    const seed = toText(objectBody?.seed, 120);

    const rpcResponse = await fetch(`${config.url}/rest/v1/rpc/get_or_create_referral_invite`, {
        method: 'POST',
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            p_inviter_user_id: authUser.id,
            p_inviter_email: authUser.email,
            p_seed: seed || authUser.email
        })
    });

    const rawPayload = (await rpcResponse.json().catch(() => ({}))) as unknown;
    if (!rpcResponse.ok) {
        const rpcError = toObject(rawPayload);
        const message = toText(rpcError?.message || rpcError?.error || '', 300);
        return sendJson(
            res,
            rpcResponse.status >= 500 ? 500 : 400,
            {
                ok: false,
                errorCode: message.toUpperCase().includes('UNAUTHORIZED') ? 'UNAUTHORIZED' : 'SERVER_ERROR',
                message: mapRpcErrorMessage(message)
            },
            corsHeaders
        );
    }

    const row = parseRpcRow(rawPayload);
    const inviteCode = toText(row?.code, 12).toUpperCase();
    const created = Boolean(row?.created);
    const claimCount = Number(row?.claim_count ?? row?.claimCount ?? 0);

    if (!INVITE_CODE_REGEX.test(inviteCode)) {
        return sendJson(
            res,
            500,
            {
                ok: false,
                errorCode: 'SERVER_ERROR',
                message: 'RPC did not return a valid invite code.'
            },
            corsHeaders
        );
    }

    return sendJson(
        res,
        200,
        {
            ok: true,
            data: {
                code: inviteCode,
                created,
                claimCount: Number.isFinite(claimCount) ? Math.max(0, claimCount) : 0,
                inviteLink: buildInviteLink(req, inviteCode)
            }
        },
        corsHeaders
    );
}
