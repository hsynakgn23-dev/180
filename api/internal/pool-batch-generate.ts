import { runBatchGenerate } from '../lib/questionPool.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined> | Headers;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
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
    return null;
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
    try { return JSON.parse(raw); } catch { return null; }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const expectedSecret = resolveSecret();
    const providedSecret = getBearerToken(req) || getQueryParam(req, 'secret') || '';
    if (!expectedSecret || providedSecret !== expectedSecret) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }

    const body = (typeof (await parseBody(req)) === 'object' && (await parseBody(req)) !== null)
        ? (await parseBody(req)) as Record<string, unknown>
        : {};

    const targetCount = Math.min(
        Math.max(1, Math.floor(Number(body?.targetCount || body?.count || 400))),
        1000
    );

    const result = await runBatchGenerate(targetCount);

    if (!result.ok) {
        return sendJson(res, 500, { ok: false, error: result.error || 'Batch generation failed.' });
    }

    return sendJson(res, 200, {
        ok: true,
        batchId: result.batchId,
        totalMovies: result.totalMovies,
        totalBatches: result.totalBatches,
        message: `Batch submitted. Use /api/internal/pool-batch-status?batchId=${result.batchId} to check progress.`
    });
}
