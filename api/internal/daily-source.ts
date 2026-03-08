import { readPreparedDailyQuizMovies, getQuizTargetDateKey } from '../lib/dailyQuiz.js';

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

const isValidDateKey = (value: string | null | undefined): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const resolveSourceSecret = (): string =>
    String(process.env.DAILY_SOURCE_SECRET || process.env.CRON_SECRET || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'GET') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const expectedSecret = resolveSourceSecret();
    const providedSecret =
        getBearerToken(req) ||
        String(getQueryParam(req, 'secret') || '').trim() ||
        '';

    if (!expectedSecret || providedSecret !== expectedSecret) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }

    const target = String(getQueryParam(req, 'target') || 'next').trim().toLowerCase();
    const requestedDate = getQueryParam(req, 'date');
    const dateKey = isValidDateKey(requestedDate)
        ? requestedDate
        : target === 'current'
            ? getQuizTargetDateKey(0)
            : getQuizTargetDateKey(1);

    const result = await readPreparedDailyQuizMovies(dateKey);
    if (!result.ok) {
        return sendJson(res, result.status || 500, {
            ok: false,
            target,
            date: dateKey,
            error: result.error
        });
    }

    return sendJson(res, 200, {
        ok: true,
        target,
        date: result.date,
        batchStatus: result.status,
        questionCount: result.questionCount,
        movies: result.movies
    });
}
