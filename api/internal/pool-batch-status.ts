import { checkBatchStatus, fetchAndProcessBatchResults } from '../lib/questionPool.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined> | Headers;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' }
    });
};

const resolveSecret = (): string =>
    String(process.env.DAILY_QUIZ_IMPORT_SECRET || process.env.DAILY_SOURCE_SECRET || process.env.CRON_SECRET || '').trim();

const getHeader = (req: ApiRequest, key: string): string => {
    const headers = req.headers;
    if (!headers) return '';
    if (typeof (headers as Headers).get === 'function') {
        return ((headers as Headers).get(key) || '').trim();
    }
    const obj = headers as Record<string, string | undefined>;
    return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
    const authHeader = getHeader(req, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() || null : null;
};

const getQueryParam = (req: ApiRequest, key: string): string | null => {
    const raw = req?.query?.[key];
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];

    const rawUrl = typeof req?.url === 'string' ? req.url : '';
    if (!rawUrl) return null;
    try {
        const url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : 'https://localhost');
        return url.searchParams.get(key);
    } catch { return null; }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'GET') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const expectedSecret = resolveSecret();
    const providedSecret = getBearerToken(req) || getQueryParam(req, 'secret') || '';
    if (!expectedSecret || providedSecret !== expectedSecret) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }

    const batchId = getQueryParam(req, 'batchId') || '';
    if (!batchId) {
        return sendJson(res, 400, { ok: false, error: 'Missing batchId parameter.' });
    }

    const status = await checkBatchStatus(batchId);

    // If batch is complete, process results automatically
    if (status.status === 'ended') {
        const processResult = await fetchAndProcessBatchResults(batchId);
        return sendJson(res, 200, {
            ok: true,
            batchId,
            status: 'ended',
            processed: true,
            moviesProcessed: processResult.moviesProcessed,
            questionsInserted: processResult.questionsInserted,
            processError: processResult.ok ? undefined : processResult.error
        });
    }

    return sendJson(res, 200, {
        ok: true,
        batchId,
        status: status.status,
        processed: false,
        message: status.status === 'in_progress'
            ? 'Batch is still processing. Check again later.'
            : `Batch status: ${status.status}`
    });
}
