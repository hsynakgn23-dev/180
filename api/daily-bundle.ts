import { createCorsHeaders } from './lib/cors.js';
import { readDailyQuizBundle } from './lib/dailyQuiz.js';
import { getQueryParam, sendJson } from './lib/httpHelpers.js';

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
