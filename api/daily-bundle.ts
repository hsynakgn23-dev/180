import { createCorsHeaders } from './lib/cors.js';
import { readDailyQuizBundle } from './lib/dailyQuiz.js';

export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined> | Headers;
};

type ApiJsonResponder = {
    json: (payload: Record<string, unknown>) => unknown;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => ApiJsonResponder;
};

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

const getQueryParam = (req: ApiRequest, key: string): string | null => {
    const rawQueryValue = req?.query?.[key];
    if (typeof rawQueryValue === 'string') return rawQueryValue;
    if (Array.isArray(rawQueryValue) && typeof rawQueryValue[0] === 'string') return rawQueryValue[0];

    const rawUrl = typeof req?.url === 'string' ? req.url : '';
    if (!rawUrl) return null;

    try {
        const host = typeof req.headers === 'object' && req.headers && 'host' in req.headers
            ? String((req.headers as Record<string, string | undefined>).host || 'localhost')
            : 'localhost';
        const url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : `https://${host}`);
        return url.searchParams.get(key);
    } catch {
        return null;
    }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const corsHeaders = createCorsHeaders(req, {
        methods: 'GET,OPTIONS',
        headers: 'content-type,authorization'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, { ok: true }, corsHeaders);
    }

    if (req.method !== 'GET') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, corsHeaders);
    }

    const result = await readDailyQuizBundle({
        dateKey: getQueryParam(req, 'date'),
        language: getQueryParam(req, 'lang') || getQueryParam(req, 'language'),
        headers: req.headers
    });

    if (!result.ok) {
        return sendJson(res, result.status || 500, result, corsHeaders);
    }

    return sendJson(
        res,
        200,
        result,
        {
            ...corsHeaders,
            'cache-control': 'private, max-age=30, stale-while-revalidate=120'
        }
    );
}
