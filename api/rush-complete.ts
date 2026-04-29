import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import { applyRushCompleteMarks } from './lib/markUnlock.js';
import { applyProgressionReward } from './lib/progressionProfile.js';
import { getRushCompletionReward } from '../src/domain/progressionRewards.js';

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

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

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

    if (!sessionId) {
        return sendJson(res, 400, { ok: false, error: 'Missing sessionId.' }, cors);
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
        .from('quiz_rush_sessions')
        .select('id, user_id, mode, status, correct_count, wrong_count, total_questions, time_limit_seconds, started_at, expires_at')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (sessionError || !session) {
        return sendJson(res, 404, { ok: false, error: 'Session not found.' }, cors);
    }

    if (session.status !== 'in_progress') {
        return sendJson(res, 409, { ok: false, error: 'Session already completed.', status: session.status }, cors);
    }

    const now = new Date();
    const isExpired = session.expires_at && now > new Date(session.expires_at);
    const finalStatus = isExpired ? 'expired' : 'completed';

    // Calculate XP, tickets and arena score using the shared reward function
    const mode = session.mode as 'rush_15' | 'rush_30' | 'endless';
    const isExpiredFlag = Boolean(isExpired);
    const rushReward = getRushCompletionReward({
        mode,
        correctCount: session.correct_count || 0,
        wrongCount: session.wrong_count || 0,
        totalQuestions: session.total_questions || 0,
        expired: isExpiredFlag,
    });
    const xpEarned = rushReward.xp;
    const ticketsEarned = rushReward.tickets;
    const arenaScoreEarned = rushReward.arenaScore;

    // Update session
    const { error: sessionUpdateError } = await supabase
        .from('quiz_rush_sessions')
        .update({
            status: finalStatus,
            xp_earned: xpEarned,
            completed_at: now.toISOString()
        })
        .eq('id', sessionId);
    if (sessionUpdateError) {
        console.error('rush-complete: session update failed', { code: sessionUpdateError.code });
        return sendJson(res, 500, { ok: false, error: 'Failed to complete session.' }, cors);
    }

    // Update profile XP, tickets, and arena score through the shared progression writer
    // so wallet/ticket state is preserved and `xp` / `totalXP` stay in sync.
    if (xpEarned > 0 || ticketsEarned > 0 || arenaScoreEarned > 0) {
        try {
            await applyProgressionReward({
                supabase,
                userId: user.id,
                fallbackEmail: user.email || null,
                fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
                reward: {
                    xp: xpEarned,
                    tickets: ticketsEarned,
                    arenaScore: arenaScoreEarned,
                    arenaActivity: rushReward.arenaActivity,
                },
                isQuizReward: true,
                ledger: {
                    source: 'rush_quiz',
                    sourceId: sessionId,
                    reason: 'rush_complete',
                    metadata: {
                        mode,
                        finalStatus,
                        correctCount: session.correct_count || 0,
                        totalQuestions: session.total_questions || 0,
                        xpEarned,
                    },
                    eventKey: `rush_quiz:${sessionId}`,
                },
            });
        } catch (xpError) {
            // Session was already marked completed — log for manual reconciliation
            console.error('rush-complete: XP grant failed after session completion', {
                userId: user.id,
                sessionId,
                xpEarned,
                error: xpError instanceof Error ? xpError.message : String(xpError),
            });
        }
    }

    // Check ad trigger
    const { data: profileSub } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

    const isFreeUser = !profileSub?.subscription_tier || profileSub.subscription_tier === 'free';
    const shouldShowAd = isFreeUser;

    // Record ad impression if needed
    if (shouldShowAd) {
        await supabase
            .from('ad_impressions')
            .insert({
                user_id: user.id,
                trigger_type: 'rush',
                shown_at: now.toISOString()
            });
    }

    const threshold = rushReward.threshold;
    const passedThreshold = rushReward.passedThreshold;

    // Unlock rush/knowledge marks and return newly earned ones
    const newlyUnlockedMarks = await applyRushCompleteMarks(
        supabase,
        user.id,
        mode,
        session.correct_count || 0
    );

    return sendJson(res, 200, {
        ok: true,
        sessionId,
        mode: session.mode,
        status: finalStatus,
        correctCount: session.correct_count,
        wrongCount: session.wrong_count,
        totalQuestions: session.total_questions,
        xpEarned,
        xp_earned: xpEarned,
        tickets_earned: ticketsEarned,
        arena_score_earned: arenaScoreEarned,
        passedThreshold,
        threshold,
        shouldShowAd,
        new_marks: newlyUnlockedMarks,
        summary: {
            accuracy: session.total_questions > 0
                ? Math.round(((session.correct_count || 0) / session.total_questions) * 100)
                : 0,
            timeUsed: session.started_at
                ? Math.round((now.getTime() - new Date(session.started_at).getTime()) / 1000)
                : 0
        }
    }, cors);
}
