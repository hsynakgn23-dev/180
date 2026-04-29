import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, getHeader, parseBody, sendJson } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import { applyPoolAnswerMarks } from './lib/markUnlock.js';
import {
    DAILY_QUIZ_CORRECT_XP
} from '../src/domain/dailyQuizRewards.js';
import { getPoolQuizReward } from '../src/domain/progressionRewards.js';
import { applyProgressionReward } from './lib/progressionProfile.js';

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

/**
 * Hata yaniti sablonu. Frontend quizTransport + UI bu alanlari kullaniyor:
 *  - error_code: makine-okunur kimlik ("invalid_option", "server_error" ...)
 *  - retriable: transport katmani bunu gorunce otomatik retry yapacak mi?
 *    (yalnizca network / 5xx gibi gecici hatalar true olmali.)
 */
const errorPayload = (
    error: string,
    error_code: string,
    retriable: boolean,
    extra: Record<string, unknown> = {}
): Record<string, unknown> => ({ ok: false, error, error_code, retriable, ...extra });

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
        return sendJson(res, 405, errorPayload('Method not allowed.', 'method_not_allowed', false), cors);
    }

    // quizTransport'un gonderdigi idempotency key. Suanda gozlenebilirlik icin
    // logluyoruz; record_pool_answer RPC'si zaten (user_id, question_id) uzerinden
    // duplicate koruma yapiyor.
    const idempotencyKey = getHeader(req, 'x-idempotency-key');

    const accessToken = getBearerToken(req);
    if (!accessToken) {
        return sendJson(res, 401, errorPayload('Oturum bulunamadi. Lutfen yeniden giris yapin.', 'not_authenticated', false), cors);
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !supabaseServiceKey) {
        return sendJson(res, 500, errorPayload('Sunucu yapilandirma hatasi.', 'server_config_error', false), cors);
    }

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
        return sendJson(res, 401, errorPayload('Oturum gecersiz. Lutfen yeniden giris yapin.', 'invalid_token', false), cors);
    }

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const questionId = String(bodyObj.question_id || bodyObj.questionId || '').trim();
    const selectedOption = String(bodyObj.selected_option || bodyObj.selectedOption || '').trim().toLowerCase();
    const lang = String(bodyObj.language || bodyObj.lang || 'tr').trim();

    if (!questionId) {
        return sendJson(res, 400, errorPayload('Soru kimligi eksik.', 'missing_question_id', false), cors);
    }
    if (!['a', 'b', 'c', 'd'].includes(selectedOption)) {
        return sendJson(res, 400, errorPayload('Gecersiz cevap secenegi.', 'invalid_option', false), cors);
    }

    const { data: question, error: questionError } = await supabase
        .from('question_pool_questions')
        .select('id, movie_id, tmdb_movie_id, correct_option, explanation_translations, question_order')
        .eq('id', questionId)
        .single();

    if (questionError || !question) {
        return sendJson(res, 404, errorPayload('Soru bulunamadi.', 'question_not_found', false), cors);
    }

    const isCorrect = selectedOption === question.correct_option;
    const validLang = ['tr', 'en', 'es', 'fr'].includes(lang) ? lang : 'tr';
    const explanations = (question.explanation_translations || {}) as Record<string, string>;
    const explanation = explanations[validLang] || explanations.tr || explanations.en || '';

    const fallbackDisplayName = user.email ? String(user.email).split('@')[0] : null;
    // NOT: Production DB'deki record_pool_answer RPC 9 parametre aliyor (icinde
    // p_selected_option var). Repo'daki migration 20260411 ise 8 parametreli
    // eski versiyonu tanimliyor — prod elden guncellenmis, aradaki fark hicbir
    // cevabin kaydedilememesine yol aciyordu. Simdi selected_option gecirildigi
    // icin RPC bulunuyor ve cagri basarili oluyor.
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_pool_answer', {
        p_user_id: user.id,
        p_question_id: questionId,
        p_movie_id: question.movie_id,
        p_is_correct: isCorrect,
        p_selected_option: selectedOption,
        p_correct_xp: POOL_CORRECT_XP,
        p_perfect_bonus_xp: POOL_PERFECT_BONUS_XP,
        p_email: user.email || null,
        p_display_name: fallbackDisplayName,
    });

    if (rpcError) {
        console.error('pool-answer: record_pool_answer failed', {
            code: rpcError.code,
            message: rpcError.message,
            userId: user.id,
            questionId,
            idempotencyKey: idempotencyKey || null,
        });
        // DB gecici arizalarinda transport tekrar denesin diye retriable:true.
        return sendJson(res, 500, errorPayload('Cevap kaydedilemedi, tekrar denenecek.', 'rpc_error', true), cors);
    }

    const rpcRow =
        Array.isArray(rpcData)
            ? (rpcData[0] as Record<string, unknown> | undefined)
            : (rpcData as Record<string, unknown> | null | undefined);

    if (!rpcRow) {
        console.error('pool-answer: record_pool_answer returned no data', {
            userId: user.id,
            questionId,
            idempotencyKey: idempotencyKey || null,
        });
        return sendJson(res, 500, errorPayload('Cevap kaydedilemedi, tekrar denenecek.', 'rpc_empty', true), cors);
    }

    const duplicate = rpcRow.duplicate === true;
    const recordedIsCorrect = rpcRow.recorded_is_correct === true;
    const answered = Number(rpcRow.questions_answered || 0);
    const correct = Number(rpcRow.correct_count || 0);
    const total = Number(rpcRow.total_questions || 5) || 5;
    const completed = rpcRow.completed === true;
    const isPerfect = rpcRow.is_perfect === true;
    const xpEarned = Number(rpcRow.xp_earned || 0);
    const bonusXp = Number(rpcRow.bonus_xp || 0);

    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

    const isFreeUser = !profile?.subscription_tier || profile.subscription_tier === 'free';
    const shouldShowAd = !duplicate && isFreeUser && completed;

    const newlyUnlockedMarks = duplicate
        ? []
        : await applyPoolAnswerMarks(
            supabase,
            user.id,
            isCorrect,
            isPerfect,
            null
        );

    // Calculate pool quiz reward (tickets + arena score) and persist to profile.
    // XP is already handled by the RPC, so we pass xp: 0 to avoid double-counting.
    let ticketsEarned = 0;
    let arenaScoreEarned = 0;
    if (!duplicate && completed) {
        try {
            const poolReward = getPoolQuizReward({ isCompleted: true, isPerfect });
            ticketsEarned = poolReward.tickets;
            arenaScoreEarned = poolReward.arenaScore;

            await applyProgressionReward({
                supabase,
                userId: user.id,
                fallbackEmail: user.email || null,
                fallbackDisplayName: fallbackDisplayName,
                reward: {
                    xp: 0,
                    tickets: poolReward.tickets,
                    arenaScore: poolReward.arenaScore,
                    arenaActivity: poolReward.arenaActivity,
                },
                ledger: {
                    source: 'pool_quiz',
                    sourceId: String(question.movie_id || ''),
                    reason: 'pool_quiz_complete',
                },
            });
        } catch (rewardError) {
            console.error('pool-answer: applyProgressionReward failed', {
                userId: user.id,
                error: rewardError instanceof Error ? rewardError.message : 'unknown',
            });
        }
    }

    return sendJson(res, 200, {
        ok: true,
        question_id: questionId,
        selected_option: selectedOption,
        correct_option: question.correct_option,
        is_correct: recordedIsCorrect,
        explanation,
        xp_earned: xpEarned,
        bonus_xp: bonusXp,
        tickets_earned: ticketsEarned,
        arena_score_earned: arenaScoreEarned,
        duplicate,
        progress: {
            answered,
            correct,
            total,
            completed,
            is_perfect: isPerfect
        },
        should_show_ad: shouldShowAd,
        new_marks: newlyUnlockedMarks,
    }, cors);
}
