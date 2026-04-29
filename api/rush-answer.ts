import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | undefined> | Headers;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

const ENDLESS_PER_QUESTION_SECONDS = 10;
const CORRECT_TIME_BONUS_SECONDS = 3;
const ANSWER_SETTLE_GRACE_SECONDS = 1;

type SupabaseErrorLike = {
    code?: string | null;
    message?: string | null;
    details?: string | null;
};

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const sanitizeServerErrorMessage = (fallback: string): string => fallback;

const isRushAttemptDuplicateError = (error: SupabaseErrorLike | null | undefined): boolean => {
    if (!error) return false;
    const code = String(error.code || '').trim();
    const message = String(error.message || '').toLowerCase();
    const details = String(error.details || '').toLowerCase();
    return (
        code === '23505' ||
        message.includes('duplicate key') ||
        message.includes('unique constraint') ||
        details.includes('(session_id, question_id)')
    );
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type, apikey, x-client-info',
        methods: 'POST, OPTIONS'
    });

    if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

    const accessToken = getBearerToken(req);
    if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !supabaseServiceKey) return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const sessionId = String(bodyObj.sessionId || '').trim();
    const questionId = String(bodyObj.questionId || '').trim();
    const selectedOption = String(bodyObj.selectedOption || '').trim().toLowerCase();

    if (!sessionId || !questionId) {
        return sendJson(res, 400, { ok: false, error: 'Missing sessionId or questionId.' }, cors);
    }
    if (!['a', 'b', 'c', 'd'].includes(selectedOption)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid selectedOption.' }, cors);
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
        .from('quiz_rush_sessions')
        .select('id, user_id, mode, status, expires_at, correct_count, wrong_count, time_limit_seconds')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (sessionError || !session) {
        return sendJson(res, 404, { ok: false, error: 'Session not found.' }, cors);
    }

    if (session.status !== 'in_progress') {
        return sendJson(res, 409, { ok: false, error: 'Session is no longer active.', status: session.status }, cors);
    }

    // Check time limit
    const now = new Date();
    if (session.expires_at && now > new Date(session.expires_at)) {
        // Mark session as expired
        await supabase
            .from('quiz_rush_sessions')
            .update({ status: 'expired', completed_at: now.toISOString() })
            .eq('id', sessionId);

        return sendJson(res, 410, {
            ok: false,
            error: 'Time expired.',
            status: 'expired',
            correctCount: session.correct_count,
            wrongCount: session.wrong_count
        }, cors);
    }

    // For endless mode, check per-question time (10 seconds grace)
    if (session.mode === 'endless') {
        const { data: lastAttempt } = await supabase
            .from('quiz_rush_attempts')
            .select('answered_at')
            .eq('session_id', sessionId)
            .order('answered_at', { ascending: false })
            .limit(1)
            .single();

        const lastTime = lastAttempt?.answered_at
            ? new Date(lastAttempt.answered_at)
            : new Date(session.expires_at || now.toISOString()); // fallback to session start

        const elapsed = (now.getTime() - lastTime.getTime()) / 1000;
        if (elapsed > ENDLESS_PER_QUESTION_SECONDS + 2) { // 2 second grace for network
            await supabase
                .from('quiz_rush_sessions')
                .update({ status: 'expired', completed_at: now.toISOString() })
                .eq('id', sessionId);

            return sendJson(res, 410, {
                ok: false,
                error: 'Question time expired (endless mode).',
                status: 'expired'
            }, cors);
        }
    }

    // Get question
    const { data: question, error: questionError } = await supabase
        .from('question_pool_questions')
        .select('id, correct_option, explanation_translations')
        .eq('id', questionId)
        .single();

    if (questionError || !question) {
        return sendJson(res, 404, { ok: false, error: 'Question not found.' }, cors);
    }

    const isCorrect = selectedOption === question.correct_option;

    // Record attempt atomically. A unique DB constraint on (session_id, question_id)
    // ensures only the first concurrent request wins.
    const { error: attemptInsertError } = await supabase
        .from('quiz_rush_attempts')
        .insert({
            session_id: sessionId,
            question_id: questionId,
            selected_option: selectedOption,
            is_correct: isCorrect,
            answered_at: now.toISOString()
        });

    if (attemptInsertError) {
        if (isRushAttemptDuplicateError(attemptInsertError)) {
            return sendJson(res, 409, { ok: false, error: 'Question already answered in this session.' }, cors);
        }
        console.error('rush-answer attempt insert failed', {
            code: attemptInsertError.code || null,
            details: attemptInsertError.details || null,
        });
        return sendJson(
            res,
            500,
            { ok: false, error: sanitizeServerErrorMessage('Failed to record rush answer.') },
            cors
        );
    }

    // Update session counts
    const newCorrect = (session.correct_count || 0) + (isCorrect ? 1 : 0);
    const newWrong = (session.wrong_count || 0) + (isCorrect ? 0 : 1);
    const answerBonusSeconds = (isCorrect ? CORRECT_TIME_BONUS_SECONDS : 0) + ANSWER_SETTLE_GRACE_SECONDS;
    const nextExpiresAt =
        session.expires_at
            ? new Date(new Date(session.expires_at).getTime() + answerBonusSeconds * 1000).toISOString()
            : null;
    const totalTimeSeconds = Number(session.time_limit_seconds) > 0
        ? Number(session.time_limit_seconds) +
            newCorrect * CORRECT_TIME_BONUS_SECONDS +
            (newCorrect + newWrong) * ANSWER_SETTLE_GRACE_SECONDS
        : null;

    const { error: sessionUpdateError } = await supabase
        .from('quiz_rush_sessions')
        .update({
            correct_count: newCorrect,
            wrong_count: newWrong,
            expires_at: nextExpiresAt
        })
        .eq('id', sessionId);
    if (sessionUpdateError) {
        console.error('rush-answer: session update failed', { code: sessionUpdateError.code });
        return sendJson(res, 500, { ok: false, error: 'Failed to update session.' }, cors);
    }

    const lang = String(bodyObj.lang || 'tr').trim();
    const validLang = ['tr', 'en', 'es', 'fr'].includes(lang) ? lang : 'tr';
    const explanations = (question.explanation_translations || {}) as Record<string, string>;

    return sendJson(res, 200, {
        ok: true,
        questionId,
        selectedOption,
        correctOption: question.correct_option,
        isCorrect,
        explanation: explanations[validLang] || explanations.tr || explanations.en || '',
        expires_at: nextExpiresAt,
        bonus_seconds: isCorrect && session.expires_at ? CORRECT_TIME_BONUS_SECONDS : 0,
        total_time_seconds: totalTimeSeconds,
        sessionProgress: {
            correctCount: newCorrect,
            wrongCount: newWrong,
            totalAnswered: newCorrect + newWrong
        }
    }, cors);
}
