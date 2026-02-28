import { createCorsHeaders } from '../lib/cors.js';

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

type SupabaseConfig = {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
};

type PushTicket = {
    id?: unknown;
    status?: unknown;
    message?: unknown;
    details?: unknown;
};

type PushReceiptErrorSample = {
    id: string;
    message: string;
    details: string;
};

type PushReceiptSummary = {
    status: 'ok' | 'unavailable';
    checkedCount: number;
    okCount: number;
    errorCount: number;
    pendingCount: number;
    message: string;
    errors: PushReceiptErrorSample[];
};

const MAX_TOKENS_PER_CALL = 25;
const EXPO_PUSH_TOKEN_REGEX = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const EXPO_PUSH_RECEIPT_POLL_DELAY_MS = 1200;

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

const getSupabaseConfig = (): SupabaseConfig | null => {
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
    config: SupabaseConfig,
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

const extractPushTokens = (mobilePushState: unknown): string[] => {
    const state = toObject(mobilePushState);
    if (!state) return [];
    const rawDevices = state.devices;
    if (!rawDevices || typeof rawDevices !== 'object' || Array.isArray(rawDevices)) return [];

    const tokens = Object.values(rawDevices as Record<string, unknown>)
        .map((device) => {
            const parsedDevice = toObject(device);
            return toText(parsedDevice?.expoPushToken, 320);
        })
        .filter((token) => EXPO_PUSH_TOKEN_REGEX.test(token));

    return Array.from(new Set(tokens)).slice(0, MAX_TOKENS_PER_CALL);
};

const readUserPushTokens = async (
    config: SupabaseConfig,
    userId: string
): Promise<{ ok: boolean; tokens: string[]; error?: string }> => {
    const endpoint = `${config.url}/rest/v1/profiles?select=mobile_push_state&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
    try {
        const response = await fetch(endpoint, {
            headers: {
                apikey: config.serviceRoleKey,
                Authorization: `Bearer ${config.serviceRoleKey}`
            }
        });
        if (!response.ok) {
            const text = (await response.text()) || `HTTP ${response.status}`;
            return { ok: false, tokens: [], error: text.slice(0, 320) };
        }

        const payload = (await response.json()) as unknown;
        const firstRow =
            Array.isArray(payload) && payload.length > 0
                ? toObject(payload[0])
                : null;
        const tokens = extractPushTokens(firstRow?.mobile_push_state);
        return { ok: true, tokens };
    } catch (error) {
        return {
            ok: false,
            tokens: [],
            error: toText(error instanceof Error ? error.message : 'Unknown read error', 320)
        };
    }
};

const sendExpoPush = async (input: {
    tokens: string[];
    title: string;
    body: string;
    deepLink: string;
}): Promise<{ ok: boolean; tickets: PushTicket[]; errorCount: number; error?: string }> => {
    const messages = input.tokens.map((token) => ({
        to: token,
        title: input.title,
        body: input.body,
        sound: 'default',
        data: {
            source: 'mobile_push_test_api',
            deepLink: input.deepLink,
            sentAt: new Date().toISOString()
        }
    }));

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(messages)
        });

        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const tickets = Array.isArray(payload.data)
            ? (payload.data as PushTicket[])
            : [];
        if (!response.ok) {
            const text = toText(payload.errors || payload.error || `HTTP ${response.status}`, 320);
            return { ok: false, tickets, errorCount: tickets.length, error: text || 'Expo push send failed.' };
        }

        const errorCount = tickets.reduce((count, ticket) => {
            const status = toText(ticket.status, 24).toLowerCase();
            return status === 'error' ? count + 1 : count;
        }, 0);

        return { ok: true, tickets, errorCount };
    } catch (error) {
        return {
            ok: false,
            tickets: [],
            errorCount: 0,
            error: toText(error instanceof Error ? error.message : 'Expo request failed.', 320)
        };
    }
};

const sleep = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

const extractExpoTicketIds = (tickets: PushTicket[]): string[] =>
    Array.from(
        new Set(
            tickets
                .map((ticket) => toText(ticket.id, 120))
                .filter(Boolean)
        )
    );

const readExpoReceipts = async (ticketIds: string[]): Promise<PushReceiptSummary> => {
    if (ticketIds.length === 0) {
        return {
            status: 'unavailable',
            checkedCount: 0,
            okCount: 0,
            errorCount: 0,
            pendingCount: 0,
            message: 'Expo push ticket id donmedi.',
            errors: []
        };
    }

    await sleep(EXPO_PUSH_RECEIPT_POLL_DELAY_MS);

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({ ids: ticketIds })
        });

        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
            const message = toText(
                payload.error || payload.errors || `Expo receipt HTTP ${response.status}`,
                320
            );
            return {
                status: 'unavailable',
                checkedCount: ticketIds.length,
                okCount: 0,
                errorCount: 0,
                pendingCount: ticketIds.length,
                message: message || 'Expo receipt read failed.',
                errors: []
            };
        }

        const receipts = toObject(payload.data) || {};
        let okCount = 0;
        let errorCount = 0;
        let pendingCount = 0;
        const errors: PushReceiptErrorSample[] = [];

        for (const ticketId of ticketIds) {
            const rawReceipt = toObject((receipts as Record<string, unknown>)[ticketId]);
            if (!rawReceipt) {
                pendingCount += 1;
                continue;
            }

            const status = toText(rawReceipt.status, 24).toLowerCase();
            if (status === 'ok') {
                okCount += 1;
                continue;
            }

            if (status === 'error') {
                errorCount += 1;
                if (errors.length < 3) {
                    const detailsRaw = rawReceipt.details;
                    const details =
                        detailsRaw && typeof detailsRaw === 'object'
                            ? toText(JSON.stringify(detailsRaw), 320)
                            : toText(detailsRaw, 320);
                    errors.push({
                        id: ticketId,
                        message: toText(rawReceipt.message, 220) || 'Expo receipt error.',
                        details
                    });
                }
                continue;
            }

            pendingCount += 1;
        }

        if (okCount === 0 && errorCount === 0 && pendingCount === ticketIds.length) {
            return {
                status: 'unavailable',
                checkedCount: ticketIds.length,
                okCount,
                errorCount,
                pendingCount,
                message: 'Expo receipt henuz hazir degil.',
                errors
            };
        }

        return {
            status: 'ok',
            checkedCount: ticketIds.length,
            okCount,
            errorCount,
            pendingCount,
            message: 'Expo receipts checked.',
            errors
        };
    } catch (error) {
        return {
            status: 'unavailable',
            checkedCount: ticketIds.length,
            okCount: 0,
            errorCount: 0,
            pendingCount: ticketIds.length,
            message: toText(error instanceof Error ? error.message : 'Expo receipt request failed.', 320),
            errors: []
        };
    }
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
        return sendJson(
            res,
            405,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Method not allowed' },
            corsHeaders
        );
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
    const title = toText(objectBody?.title, 120) || '180 Absolute Cinema';
    const messageBody = toText(objectBody?.body, 220) || 'Push test successful.';
    const deepLink = toText(objectBody?.deepLink, 500) || 'absolutecinema://open?target=daily&screen=daily_home';

    const tokenResult = await readUserPushTokens(config, authUser.id);
    if (!tokenResult.ok) {
        return sendJson(
            res,
            500,
            {
                ok: false,
                errorCode: 'SERVER_ERROR',
                message: tokenResult.error || 'Push tokens could not be read.'
            },
            corsHeaders
        );
    }

    if (tokenResult.tokens.length === 0) {
        return sendJson(
            res,
            404,
            {
                ok: false,
                errorCode: 'PUSH_TOKEN_NOT_FOUND',
                message: 'No registered Expo push token found for this user.'
            },
            corsHeaders
        );
    }

    const pushResult = await sendExpoPush({
        tokens: tokenResult.tokens,
        title,
        body: messageBody,
        deepLink
    });

    if (!pushResult.ok) {
        return sendJson(
            res,
            502,
            {
                ok: false,
                errorCode: 'EXPO_PUSH_FAILED',
                message: pushResult.error || 'Expo push send failed.'
            },
            corsHeaders
        );
    }

    const ticketIds = extractExpoTicketIds(pushResult.tickets);
    const receiptSummary = await readExpoReceipts(ticketIds);

    return sendJson(
        res,
        200,
        {
            ok: true,
            data: {
                sentCount: tokenResult.tokens.length,
                ticketCount: pushResult.tickets.length,
                errorCount: pushResult.errorCount,
                ticketIdCount: ticketIds.length,
                receiptStatus: receiptSummary.status,
                receiptCheckedCount: receiptSummary.checkedCount,
                receiptOkCount: receiptSummary.okCount,
                receiptErrorCount: receiptSummary.errorCount,
                receiptPendingCount: receiptSummary.pendingCount,
                receiptMessage: receiptSummary.message,
                receiptErrors: receiptSummary.errors
            }
        },
        corsHeaders
    );
}
