import { checkBatchStatus, fetchAndProcessBatchResults } from '../lib/questionPool.js';
import { getBearerToken, getQueryParam, sendJson } from '../lib/httpHelpers.js';

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

const resolveSecret = (): string =>
    String(process.env.DAILY_QUIZ_IMPORT_SECRET || process.env.DAILY_SOURCE_SECRET || process.env.CRON_SECRET || '').trim();

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
