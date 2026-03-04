import { createCorsHeaders } from '../lib/cors.js';
import {
    getSupabasePushConfig,
    readAuthUserFromAccessToken,
    readUserPushTokens,
    sendExpoPushMessages
} from '../lib/push.js';

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

type EngagementKind = 'comment' | 'like' | 'follow';

type RitualRow = {
    user_id?: unknown;
    movie_title?: unknown;
};

const MOBILE_DAILY_DEEP_LINK = 'absolutecinema://open?target=daily';

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

const normalizeText = (value: unknown, maxLength: number): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
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

const readRitualTarget = async (
    configValue: NonNullable<ReturnType<typeof getSupabasePushConfig>>,
    ritualId: string
): Promise<{ ok: true; targetUserId: string; movieTitle: string } | { ok: false; error: string }> => {
    const endpoint = `${configValue.url}/rest/v1/rituals?select=user_id,movie_title&id=eq.${encodeURIComponent(ritualId)}&limit=1`;
    try {
        const response = await fetch(endpoint, {
            headers: {
                apikey: configValue.serviceRoleKey,
                Authorization: `Bearer ${configValue.serviceRoleKey}`
            }
        });
        if (!response.ok) {
            return {
                ok: false,
                error: normalizeText(await response.text(), 320) || `HTTP ${response.status}`
            };
        }

        const payload = (await response.json()) as unknown;
        const firstRow =
            Array.isArray(payload) && payload.length > 0 ? (payload[0] as RitualRow) : null;
        const targetUserId = normalizeText(firstRow?.user_id, 120);
        const movieTitle = normalizeText(firstRow?.movie_title, 120);
        if (!targetUserId) {
            return {
                ok: false,
                error: 'Ritual sahibi bulunamadi.'
            };
        }

        return {
            ok: true,
            targetUserId,
            movieTitle
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Ritual read failed.', 320)
        };
    }
};

const resolveActorLabel = (rawActorLabel: unknown, actorEmail: string): string => {
    const actorLabel = normalizeText(rawActorLabel, 80);
    if (actorLabel) return actorLabel;
    const emailPrefix = normalizeText(actorEmail.split('@')[0], 60);
    return emailPrefix || 'Bir izleyici';
};

const buildNotificationCopy = (input: {
    kind: EngagementKind;
    actorLabel: string;
    movieTitle?: string;
}): { title: string; body: string } => {
    const movieSuffix = input.movieTitle ? ` (${input.movieTitle})` : '';

    if (input.kind === 'comment') {
        return {
            title: 'Yeni yorum',
            body: `${input.actorLabel} yorumuna cevap yazdi${movieSuffix}.`
        };
    }

    if (input.kind === 'like') {
        return {
            title: 'Yeni begeni',
            body: `${input.actorLabel} yorumunu begendi${movieSuffix}.`
        };
    }

    return {
        title: 'Yeni takipci',
        body: `${input.actorLabel} seni takip etmeye basladi.`
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
        return sendJson(
            res,
            405,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Method not allowed.' },
            corsHeaders
        );
    }

    const pushConfig = getSupabasePushConfig();
    if (!pushConfig) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Missing Supabase env config.' },
            corsHeaders
        );
    }

    const accessToken = getBearerToken(req);
    if (!accessToken) {
        return sendJson(
            res,
            401,
            { ok: false, errorCode: 'UNAUTHORIZED', message: 'Missing bearer token.' },
            corsHeaders
        );
    }

    const authUser = await readAuthUserFromAccessToken(pushConfig, accessToken);
    if (!authUser) {
        return sendJson(
            res,
            401,
            { ok: false, errorCode: 'UNAUTHORIZED', message: 'Session is not valid.' },
            corsHeaders
        );
    }

    const body = toObject(await parseBody(req));
    const kind = normalizeText(body?.kind, 32) as EngagementKind;
    if (!['comment', 'like', 'follow'].includes(kind)) {
        return sendJson(
            res,
            400,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Unsupported engagement kind.' },
            corsHeaders
        );
    }

    const actorLabel = resolveActorLabel(body?.actorLabel, authUser.email);
    let targetUserId = '';
    let movieTitle = '';

    if (kind === 'follow') {
        targetUserId = normalizeText(body?.targetUserId, 120);
        if (!targetUserId) {
            return sendJson(
                res,
                400,
                { ok: false, errorCode: 'SERVER_ERROR', message: 'Missing target user id.' },
                corsHeaders
            );
        }
    } else {
        const ritualId = normalizeText(body?.ritualId, 120);
        if (!ritualId) {
            return sendJson(
                res,
                400,
                { ok: false, errorCode: 'SERVER_ERROR', message: 'Missing ritual id.' },
                corsHeaders
            );
        }

        const ritualResult = await readRitualTarget(pushConfig, ritualId);
        if (!ritualResult.ok) {
            const ritualError =
                'error' in ritualResult ? ritualResult.error : 'Ritual target could not be read.';
            return sendJson(
                res,
                404,
                { ok: false, errorCode: 'SERVER_ERROR', message: ritualError },
                corsHeaders
            );
        }

        targetUserId = ritualResult.targetUserId;
        movieTitle = ritualResult.movieTitle;
    }

    if (!targetUserId || targetUserId === authUser.id) {
        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    sentCount: 0,
                    ticketCount: 0,
                    errorCount: 0,
                    skipped: true,
                    targetUserId: targetUserId || null,
                    message: 'Notification skipped for self action.'
                }
            },
            corsHeaders
        );
    }

    const tokenResult = await readUserPushTokens(pushConfig, targetUserId);
    if (!tokenResult.ok) {
        const tokenError =
            'error' in tokenResult ? tokenResult.error : 'Recipient push tokens could not be read.';
        return sendJson(
            res,
            500,
            {
                ok: false,
                errorCode: 'SERVER_ERROR',
                message: tokenError
            },
            corsHeaders
        );
    }

    if (tokenResult.tokens.length === 0) {
        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    sentCount: 0,
                    ticketCount: 0,
                    errorCount: 0,
                    skipped: true,
                    targetUserId,
                    message: 'Recipient has no registered push tokens.'
                }
            },
            corsHeaders
        );
    }

    const copy = buildNotificationCopy({
        kind,
        actorLabel,
        movieTitle
    });

    const pushResult = await sendExpoPushMessages(
        tokenResult.tokens.map((token) => ({
            to: token,
            title: copy.title,
            body: copy.body,
            sound: 'default',
            data: {
                source: 'mobile_engagement_api',
                kind,
                deepLink: MOBILE_DAILY_DEEP_LINK,
                sentAt: new Date().toISOString()
            }
        }))
    );

    if (!pushResult.ok) {
        const pushError =
            'error' in pushResult ? pushResult.error : 'Expo push send failed.';
        return sendJson(
            res,
            502,
            {
                ok: false,
                errorCode: 'EXPO_PUSH_FAILED',
                message: pushError
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
                sentCount: tokenResult.tokens.length,
                ticketCount: pushResult.ticketCount,
                errorCount: pushResult.errorCount,
                skipped: false,
                targetUserId,
                message: 'Engagement notification sent.'
            }
        },
        corsHeaders
    );
}
