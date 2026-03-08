import { getQuizTargetDateKey, importDailyQuizBatch } from '../lib/dailyQuiz.js';

export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    method?: string;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
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

const resolveImportSecret = (): string =>
    String(process.env.DAILY_QUIZ_IMPORT_SECRET || process.env.DAILY_SOURCE_SECRET || process.env.CRON_SECRET || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const expectedSecret = resolveImportSecret();
    const providedSecret =
        getBearerToken(req) ||
        String(getQueryParam(req, 'secret') || '').trim() ||
        '';

    if (!expectedSecret || providedSecret !== expectedSecret) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }

    const body = toObject(await parseBody(req));
    const dateKey = isValidDateKey(String(body?.dateKey || body?.date || body?.batchDate || '').trim())
        ? String(body?.dateKey || body?.date || body?.batchDate).trim()
        : getQuizTargetDateKey(1);
    const payload = toObject(body?.payload) && Array.isArray((body?.payload as Record<string, unknown>).movies)
        ? body?.payload
        : body;
    const publish = body?.publish === true || body?.publish === 'true' || body?.publish === 1 || body?.publish === '1';

    const result = await importDailyQuizBatch({
        dateKey,
        payload,
        publish,
        source: String(body?.source || '').trim() || 'external_codex',
        sourceModel: String(body?.sourceModel || body?.model || '').trim() || 'external_codex'
    });

    if (!result.ok) {
        return sendJson(res, result.status || 500, result);
    }

    return sendJson(res, 200, {
        ok: true,
        date: result.date,
        questionCount: result.questionCount,
        batchStatus: result.batchStatus
    });
}
