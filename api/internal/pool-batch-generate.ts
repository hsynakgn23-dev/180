import { runBatchGenerate } from '../lib/questionPool.js';
import { getBearerToken, getQueryParam, parseBody, sendJson, toObject } from '../lib/httpHelpers.js';

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

const resolveSecret = (): string =>
    String(process.env.DAILY_QUIZ_IMPORT_SECRET || process.env.DAILY_SOURCE_SECRET || process.env.CRON_SECRET || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const expectedSecret = resolveSecret();
    const providedSecret = getBearerToken(req) || getQueryParam(req, 'secret') || '';
    if (!expectedSecret || providedSecret !== expectedSecret) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }

    const body = toObject(await parseBody(req)) || {};

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
