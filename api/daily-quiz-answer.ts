import { createCorsHeaders } from './lib/cors.js';
import { submitDailyQuizAnswer } from './lib/dailyQuiz.js';
import { parseBody, sendJson, toObject } from './lib/httpHelpers.js';

export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    method?: string;
    body?: unknown;
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const corsHeaders = createCorsHeaders(req, {
        methods: 'POST,OPTIONS',
        headers: 'content-type,authorization'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, { ok: true }, corsHeaders);
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, corsHeaders);
    }

    const body = toObject(await parseBody(req));
    const result = await submitDailyQuizAnswer({
        headers: req.headers,
        dateKey: String(body?.dateKey || body?.date || body?.batchDate || '').trim() || null,
        questionId: body?.questionId || body?.question_id,
        selectedOption: body?.selectedOption || body?.selected_option,
        language: String(body?.language || body?.lang || '').trim() || null
    });

    if (!result.ok) {
        return sendJson(res, result.status || 500, result, corsHeaders);
    }

    return sendJson(res, 200, result, corsHeaders);
}
