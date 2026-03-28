import { createCorsHeaders } from './lib/cors.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import {
    DAILY_QUIZ_CORRECT_XP
} from '../src/domain/dailyQuizRewards.js';

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

const POOL_CORRECT_XP = DAILY_QUIZ_CORRECT_XP || 10;
const POOL_PERFECT_BONUS_XP = 25;

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
        headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
    });
};

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

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type, apikey, x-client-info',
        methods: 'POST, OPTIONS'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, {}, cors);
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);
    }

    const accessToken = getBearerToken(req);
    if (!accessToken) {
        return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !supabaseServiceKey) {
        return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);
    }

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
        return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);
    }

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const questionId = String(bodyObj.question_id || bodyObj.questionId || '').trim();
    const selectedOption = String(bodyObj.selected_option || bodyObj.selectedOption || '').trim().toLowerCase();
    const lang = String(bodyObj.language || bodyObj.lang || 'tr').trim();

    if (!questionId) {
        return sendJson(res, 400, { ok: false, error: 'Missing question_id.' }, cors);
    }
    if (!['a', 'b', 'c', 'd'].includes(selectedOption)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid selected_option.' }, cors);
    }

    // Get question with correct answer
    const { data: question, error: questionError } = await supabase
        .from('question_pool_questions')
        .select('id, movie_id, tmdb_movie_id, correct_option, explanation_translations, question_order')
        .eq('id', questionId)
        .single();

    if (questionError || !question) {
        return sendJson(res, 404, { ok: false, error: 'Question not found.' }, cors);
    }

    const isCorrect = selectedOption === question.correct_option;
    const validLang = ['tr', 'en', 'es', 'fr'].includes(lang) ? lang : 'tr';
    const explanations = (question.explanation_translations || {}) as Record<string, string>;
    const explanation = explanations[validLang] || explanations.tr || explanations.en || '';

    // Upsert user progress for this movie
    const { data: existingProgress } = await supabase
        .from('movie_pool_user_progress')
        .select('id, questions_answered, correct_count, xp_earned, completed')
        .eq('user_id', user.id)
        .eq('movie_id', question.movie_id)
        .single();

    const newAnswered = (existingProgress?.questions_answered || 0) + 1;
    const newCorrect = (existingProgress?.correct_count || 0) + (isCorrect ? 1 : 0);
    const xpDelta = isCorrect ? POOL_CORRECT_XP : 0;
    const newXp = (existingProgress?.xp_earned || 0) + xpDelta;

    // Get total question count for this movie
    const { count: totalQuestions } = await supabase
        .from('question_pool_questions')
        .select('*', { count: 'exact', head: true })
        .eq('movie_id', question.movie_id);

    const isCompleted = newAnswered >= (totalQuestions || 5);
    const isPerfect = isCompleted && newCorrect === (totalQuestions || 5);
    const totalXp = isPerfect ? newXp + POOL_PERFECT_BONUS_XP : newXp;

    if (existingProgress?.id) {
        await supabase
            .from('movie_pool_user_progress')
            .update({
                questions_answered: newAnswered,
                correct_count: newCorrect,
                xp_earned: totalXp,
                completed: isCompleted,
                updated_at: new Date().toISOString()
            })
            .eq('id', existingProgress.id);
    } else {
        await supabase
            .from('movie_pool_user_progress')
            .insert({
                user_id: user.id,
                movie_id: question.movie_id,
                questions_answered: newAnswered,
                correct_count: newCorrect,
                xp_earned: totalXp,
                completed: isCompleted
            });
    }

    // Update profile XP
    if (xpDelta > 0 || (isPerfect && POOL_PERFECT_BONUS_XP > 0)) {
        const finalXpDelta = isPerfect ? xpDelta + POOL_PERFECT_BONUS_XP : xpDelta;
        const { data: profile } = await supabase
            .from('profiles')
            .select('xp_state')
            .eq('user_id', user.id)
            .single();

        if (profile) {
            const xpState = (profile.xp_state || {}) as Record<string, unknown>;
            const currentXp = Number(xpState.xp || 0);
            await supabase
                .from('profiles')
                .update({
                    xp_state: { ...xpState, xp: currentXp + finalXpDelta },
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id);
        }
    }

    // Check subscription for ad trigger
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

    const isFreeUser = !profile?.subscription_tier || profile.subscription_tier === 'free';
    const shouldShowAd = isFreeUser && isCompleted;

    const xpEarned = isPerfect ? (xpDelta + POOL_PERFECT_BONUS_XP) : xpDelta;
    const bonusXp = isPerfect ? POOL_PERFECT_BONUS_XP : 0;

    return sendJson(res, 200, {
        ok: true,
        question_id: questionId,
        selected_option: selectedOption,
        correct_option: question.correct_option,
        is_correct: isCorrect,
        explanation,
        xp_earned: xpEarned,
        bonus_xp: bonusXp,
        progress: {
            answered: newAnswered,
            correct: newCorrect,
            total: totalQuestions || 5,
            completed: isCompleted,
            is_perfect: isPerfect
        },
        should_show_ad: shouldShowAd
    }, cors);
}
