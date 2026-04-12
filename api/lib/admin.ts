import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from './supabaseServiceClient.js';
import { createCorsHeaders, resolveAllowedOrigin } from './cors.js';

export type ApiRequest = {
    method?: string;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
    headers?: Record<string, string | undefined> | Headers;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiJsonResponder = {
    json: (payload: Record<string, unknown>) => unknown;
};

export type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => ApiJsonResponder;
};

type SupabaseAdminConfig = {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
};

type AuthUser = {
    id: string;
    email: string;
};

export type AdminRole = 'admin' | 'moderator';

export type AdminMembership = {
    userId: string;
    role: AdminRole;
    note: string;
    createdAt: string | null;
};

export type AdminContext = {
    corsHeaders: Record<string, string>;
    config: SupabaseAdminConfig;
    serviceClient: SupabaseClient;
    authUser: AuthUser;
    membership: AdminMembership;
    csrfToken: string;
};

type AdminCsrfPayload = {
    version: 1;
    userId: string;
    issuedAt: number;
    nonce: string;
};

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADMIN_CSRF_HEADER = 'x-admin-csrf-token';
const ADMIN_CSRF_TTL_MS = 12 * 60 * 60 * 1000;

export const sendJson = (
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

export const toText = (value: unknown, maxLength = 240): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

export const normalizeUuid = (value: unknown): string => {
    const normalized = toText(value, 80);
    return UUID_REGEX.test(normalized) ? normalized : '';
};

export const clampInteger = (
    value: unknown,
    min: number,
    max: number,
    fallback: number
): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const integer = Math.trunc(parsed);
    if (integer < min) return min;
    if (integer > max) return max;
    return integer;
};

export const readHeader = (
    headers: Record<string, string | undefined> | Headers | undefined,
    key: string
): string => {
    if (!headers) return '';
    if (typeof (headers as Headers).get === 'function') {
        return String((headers as Headers).get(key) || '').trim();
    }

    const objectHeaders = headers as Record<string, string | undefined>;
    return String(objectHeaders[key.toLowerCase()] || objectHeaders[key] || '').trim();
};

export const getHeader = (req: ApiRequest, key: string): string => readHeader(req.headers, key);

export const getBearerToken = (req: ApiRequest): string | null => {
    const authHeader = getHeader(req, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1].trim();
    return token || null;
};

export const getQueryValue = (req: ApiRequest, key: string): string => {
    const rawValue = req.query?.[key];
    if (Array.isArray(rawValue)) {
        return toText(rawValue[0], 240);
    }
    return toText(rawValue, 240);
};

export const parseBody = async (req: ApiRequest): Promise<unknown> => {
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

export const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

export const isSupabaseCapabilityError = (
    error: { code?: string | null; message?: string | null } | null | undefined
): boolean => {
    if (!error) return false;
    const code = toText(error.code, 40).toUpperCase();
    const message = toText(error.message, 220).toLowerCase();
    if (code === 'PGRST205' || code === '42P01' || code === '42501' || code === '42703') {
        return true;
    }

    return (
        message.includes('relation "') ||
        message.includes('does not exist') ||
        message.includes('schema cache') ||
        message.includes('permission') ||
        message.includes('policy') ||
        message.includes('column')
    );
};

const normalizeOriginValue = (value: string): string => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';

    try {
        return new URL(normalized).origin;
    } catch {
        return '';
    }
};

const resolveRequestOrigin = (req: ApiRequest): string => {
    const origin = normalizeOriginValue(getHeader(req, 'origin'));
    if (origin) return origin;
    return normalizeOriginValue(getHeader(req, 'referer'));
};

const base64UrlEncode = (value: string): string =>
    Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const base64UrlDecode = (value: string): string => {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
};

const buildCsrfSignature = (payload: string, secret: string): string =>
    createHmac('sha256', secret)
        .update(payload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const issueAdminCsrfToken = (userId: string, secret: string): string => {
    const payload: AdminCsrfPayload = {
        version: 1,
        userId,
        issuedAt: Date.now(),
        nonce: randomBytes(18).toString('hex')
    };

    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    return `${encodedPayload}.${buildCsrfSignature(encodedPayload, secret)}`;
};

const isCsrfSignatureValid = (expected: string, actual: string): boolean => {
    if (!expected || !actual) return false;
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(actual, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
};

const validateAdminCsrfToken = (
    token: string,
    userId: string,
    secret: string
): boolean => {
    const [encodedPayload, signature] = String(token || '').split('.');
    if (!encodedPayload || !signature) return false;

    const expectedSignature = buildCsrfSignature(encodedPayload, secret);
    if (!isCsrfSignatureValid(expectedSignature, signature)) {
        return false;
    }

    try {
        const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminCsrfPayload>;
        const issuedAt = Number(parsed.issuedAt);
        if (parsed.version !== 1) return false;
        if (normalizeUuid(parsed.userId) !== userId) return false;
        if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;
        if (Date.now() - issuedAt > ADMIN_CSRF_TTL_MS) return false;
        return true;
    } catch {
        return false;
    }
};

const requireAdminCsrf = (
    req: ApiRequest,
    res: ApiResponse,
    corsHeaders: Record<string, string>,
    userId: string,
    secret: string
): { ok: true } | { ok: false; response: unknown } => {
    const requestOrigin = resolveRequestOrigin(req);
    if (!requestOrigin) {
        return {
            ok: false,
            response: sendJson(
                res,
                403,
                {
                    ok: false,
                    errorCode: 'FORBIDDEN',
                    message: 'Missing request origin for admin mutation.'
                },
                corsHeaders
            )
        };
    }

    const allowedOrigin = resolveAllowedOrigin({
        headers: {
            origin: requestOrigin
        }
    });

    if (allowedOrigin !== requestOrigin) {
        return {
            ok: false,
            response: sendJson(
                res,
                403,
                {
                    ok: false,
                    errorCode: 'FORBIDDEN',
                    message: 'Admin mutation origin is not allowed.'
                },
                corsHeaders
            )
        };
    }

    const csrfToken = getHeader(req, ADMIN_CSRF_HEADER);
    if (!validateAdminCsrfToken(csrfToken, userId, secret)) {
        return {
            ok: false,
            response: sendJson(
                res,
                403,
                {
                    ok: false,
                    errorCode: 'FORBIDDEN',
                    message: 'Admin CSRF validation failed.'
                },
                corsHeaders
            )
        };
    }

    return { ok: true };
};

const getSupabaseAdminConfig = (): SupabaseAdminConfig | null => {
    const url = toText(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, 240);
    const serviceRoleKey = toText(process.env.SUPABASE_SERVICE_ROLE_KEY, 2048);
    const anonKey = toText(
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        2048
    );

    if (!url || !serviceRoleKey || !anonKey) return null;
    return {
        url: url.replace(/\/+$/, ''),
        serviceRoleKey,
        anonKey
    };
};

const normalizeEmail = (value: unknown, userId: string): string => {
    const email = toText(value, 240).toLowerCase();
    if (email) return email;
    return `${userId}@users.local`;
};

const readAuthUser = async (
    config: SupabaseAdminConfig,
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
        const payload = (await response.json()) as { id?: unknown; email?: unknown };
        const userId = normalizeUuid(payload.id);
        if (!userId) return null;

        return {
            id: userId,
            email: normalizeEmail(payload.email, userId)
        };
    } catch {
        return null;
    }
};

const createServiceClient = (config: SupabaseAdminConfig): SupabaseClient =>
    createSupabaseServiceClient(config.url, config.serviceRoleKey);

const readAdminMembership = async (
    serviceClient: SupabaseClient,
    userId: string
): Promise<AdminMembership | null> => {
    const { data, error } = await serviceClient
        .from('admin_users')
        .select('user_id,role,note,created_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) return null;

    const role = toText((data as Record<string, unknown>).role, 24);
    if (role !== 'admin' && role !== 'moderator') return null;

    return {
        userId: normalizeUuid((data as Record<string, unknown>).user_id),
        role,
        note: toText((data as Record<string, unknown>).note, 320),
        createdAt: toText((data as Record<string, unknown>).created_at, 80) || null
    };
};

export const requireAdminAccess = async (
    req: ApiRequest,
    res: ApiResponse,
    methods: string
): Promise<{ ok: true; context: AdminContext } | { ok: false; response: unknown }> => {
    const corsHeaders = createCorsHeaders(req, {
        methods,
        headers: `content-type,authorization,${ADMIN_CSRF_HEADER}`
    });

    if (req.method === 'OPTIONS') {
        return {
            ok: false,
            response: sendJson(res, 204, { ok: true }, corsHeaders)
        };
    }

    const allowedMethods = methods
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
    const requestMethod = toText(req.method, 20).toUpperCase() || 'GET';
    if (!allowedMethods.includes(requestMethod)) {
        return {
            ok: false,
            response: sendJson(
                res,
                405,
                { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
                corsHeaders
            )
        };
    }

    const config = getSupabaseAdminConfig();
    if (!config) {
        return {
            ok: false,
            response: sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: 'Missing Supabase env config.' },
                corsHeaders
            )
        };
    }

    const token = getBearerToken(req);
    if (!token) {
        return {
            ok: false,
            response: sendJson(
                res,
                401,
                { ok: false, errorCode: 'UNAUTHORIZED', message: 'Missing bearer token.' },
                corsHeaders
            )
        };
    }

    const authUser = await readAuthUser(config, token);
    if (!authUser) {
        return {
            ok: false,
            response: sendJson(
                res,
                401,
                { ok: false, errorCode: 'UNAUTHORIZED', message: 'Session is not valid.' },
                corsHeaders
            )
        };
    }

    const serviceClient = createServiceClient(config);
    const membership = await readAdminMembership(serviceClient, authUser.id);

    if (!membership?.userId) {
        return {
            ok: false,
            response: sendJson(
                res,
                403,
                { ok: false, errorCode: 'FORBIDDEN', message: 'Admin access required.' },
                corsHeaders
            )
        };
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(requestMethod)) {
        const csrfResult = requireAdminCsrf(
            req,
            res,
            corsHeaders,
            authUser.id,
            config.serviceRoleKey
        );
        if (!csrfResult.ok) {
            return csrfResult;
        }
    }

    return {
        ok: true,
        context: {
            corsHeaders,
            config,
            serviceClient,
            authUser,
            membership,
            csrfToken: issueAdminCsrfToken(authUser.id, config.serviceRoleKey)
        }
    };
};
