import { getQuizTargetDateKey, importDailyQuizBatch } from '../lib/dailyQuiz.js';
import { getBearerToken, getQueryParam, parseBody, sendJson, toObject } from '../lib/httpHelpers.js';

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
    const publish =
        body?.publish === false || body?.publish === 'false' || body?.publish === 0 || body?.publish === '0'
            ? false
            : true;

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
