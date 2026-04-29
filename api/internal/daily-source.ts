import { readPreparedDailyQuizMovies, getQuizTargetDateKey } from '../lib/dailyQuiz.js';
import { getBearerToken, getQueryParam, sendJson } from '../lib/httpHelpers.js';

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

const isValidDateKey = (value: string | null | undefined): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const resolveSourceSecret = (): string =>
    String(process.env.DAILY_SOURCE_SECRET || process.env.CRON_SECRET || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'GET') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const expectedSecret = resolveSourceSecret();
    // Accept secret only via Authorization Bearer header — NOT as a query param,
    // since query params are logged in server logs, CDN logs, and browser history.
    const providedSecret = getBearerToken(req) || '';

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
