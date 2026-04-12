/**
 * Server-side mark unlock utility.
 *
 * Reads the user's current xp_state from the profiles table, computes newly
 * earned marks based on accumulated quiz/rush stats, and writes back the
 * updated marks list.  Returns the IDs of any newly unlocked marks so the API
 * response can surface them to the client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { mutateWalletProfile } from './progressionWallet.js';

type XpState = Record<string, unknown>;

const toSafeInt = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};

const sanitizeStringList = (value: unknown, max = 160): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        (value as unknown[])
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
    )).slice(0, max);
};

/**
 * Unlock a mark if it hasn't been earned yet.
 * Returns the updated marks array and whether the mark was newly added.
 */
const tryUnlock = (
    markId: string,
    marks: string[]
): { marks: string[]; unlocked: boolean } => {
    if (marks.includes(markId)) return { marks, unlocked: false };
    return { marks: [...marks, markId], unlocked: true };
};

/**
 * Compute marks to unlock based on cumulative quiz stats stored in xp_state.
 *
 * Stats tracked in xp_state:
 *   - totalPoolAnswered   : total pool questions answered (any result)
 *   - totalPoolCorrect    : total pool questions answered correctly
 *   - perfectFilmCount    : number of films where all 5 answers were correct
 *   - consecutivePerfect  : current run of films with all-5 correct
 *   - genresAnswered      : array of genre strings answered correctly
 *   - rushSessions        : number of rush sessions completed
 *   - rushBestScore10     : best correct count in a Rush-10 session
 *   - rushBestScore20     : best correct count in a Rush-20 session
 *   - rushEndlessBest     : best correct count in Endless session
 *   - swipeCount          : total rightward swipes
 */
const computeQuizMarks = (state: XpState, currentMarks: string[]): string[] => {
    let marks = [...currentMarks];
    const newUnlocked: string[] = [];

    const apply = (markId: string) => {
        const r = tryUnlock(markId, marks);
        if (r.unlocked) {
            marks = r.marks;
            newUnlocked.push(markId);
        }
    };

    const totalAnswered = toSafeInt(state.totalPoolAnswered);
    const totalCorrect = toSafeInt(state.totalPoolCorrect);
    const perfectFilms = toSafeInt(state.perfectFilmCount);
    const consecutivePerfect = toSafeInt(state.consecutivePerfect);
    const genresAnswered = sanitizeStringList(state.genresAnswered, 50);
    const rushSessions = toSafeInt(state.rushSessions);
    const rushBest10 = toSafeInt(state.rushBestScore10);
    const rushBest20 = toSafeInt(state.rushBestScore20);
    const rushEndlessBest = toSafeInt(state.rushEndlessBest);
    const swipeCount = toSafeInt(state.swipeCount);

    if (totalAnswered >= 1)   apply('first_answer');
    if (totalAnswered >= 25)  apply('quiz_curious');
    if (totalAnswered >= 100) apply('quiz_scholar');
    if (totalCorrect >= 500)  apply('quiz_master');
    if (perfectFilms >= 1)    apply('perfect_film');
    if (consecutivePerfect >= 3) apply('perfect_streak');
    if (rushSessions >= 1)    apply('rush_survivor');
    if (rushBest10 >= 7)      apply('rush_ace');
    if (rushBest20 >= 14)     apply('rush_legend');
    if (rushEndlessBest >= 10) apply('rush_endless_10');
    if (swipeCount >= 20)     apply('swipe_explorer');
    if (genresAnswered.length >= 5) apply('genre_brain');

    return marks;
};

const persistQuizMarkState = async (
    supabase: SupabaseClient,
    userId: string,
    updatedState: XpState,
    updatedMarks: string[]
): Promise<void> => {
    const mutation = await mutateWalletProfile<boolean, never>({
        supabase,
        userId,
        mutate: (loaded) => ({
            ok: true,
            wallet: loaded.wallet,
            xpState: {
                ...loaded.xpState,
                totalPoolAnswered: updatedState.totalPoolAnswered,
                totalPoolCorrect: updatedState.totalPoolCorrect,
                perfectFilmCount: updatedState.perfectFilmCount,
                consecutivePerfect: updatedState.consecutivePerfect,
                genresAnswered: updatedState.genresAnswered,
                rushSessions: updatedState.rushSessions,
                rushBestScore10: updatedState.rushBestScore10,
                rushBestScore20: updatedState.rushBestScore20,
                rushEndlessBest: updatedState.rushEndlessBest,
                marks: updatedMarks,
            },
            result: true,
        }),
    });
    if (!mutation.ok) {
        throw new Error('Mark state update failed.');
    }
};

/**
 * Call after a pool question is answered.
 *
 * @param supabase   Service-role client
 * @param userId     Authenticated user ID
 * @param isCorrect  Whether this answer was correct
 * @param isPerfect  Whether this answer completed a perfect 5/5 film
 * @param movieGenre Genre of the answered film (for genre_brain tracking)
 * @returns          Array of newly unlocked mark IDs
 */
export const applyPoolAnswerMarks = async (
    supabase: SupabaseClient,
    userId: string,
    isCorrect: boolean,
    isPerfect: boolean,
    movieGenre?: string | null
): Promise<string[]> => {
    const { data: profile } = await supabase
        .from('profiles')
        .select('xp_state')
        .eq('user_id', userId)
        .single();

    if (!profile) return [];

    const xpState = (profile.xp_state || {}) as XpState;
    const prevMarks = sanitizeStringList(xpState.marks, 160);

    // Increment counters
    const totalPoolAnswered = toSafeInt(xpState.totalPoolAnswered) + 1;
    const totalPoolCorrect = toSafeInt(xpState.totalPoolCorrect) + (isCorrect ? 1 : 0);
    const perfectFilmCount = toSafeInt(xpState.perfectFilmCount) + (isPerfect ? 1 : 0);

    // Track genres answered correctly
    const genresAnswered = sanitizeStringList(xpState.genresAnswered, 50);
    if (isCorrect && movieGenre && !genresAnswered.includes(movieGenre)) {
        genresAnswered.push(movieGenre);
    }

    // Consecutive perfect — reset on non-perfect completion, increment on perfect
    const prevConsecutive = toSafeInt(xpState.consecutivePerfect);
    const consecutivePerfect = isPerfect
        ? prevConsecutive + 1
        : toSafeInt(xpState.consecutivePerfect); // only update on completion

    const updatedState: XpState = {
        ...xpState,
        totalPoolAnswered,
        totalPoolCorrect,
        perfectFilmCount,
        genresAnswered,
        consecutivePerfect,
    };

    const updatedMarks = computeQuizMarks(updatedState, prevMarks);
    const newMarks = updatedMarks.filter((m) => !prevMarks.includes(m));

    await persistQuizMarkState(supabase, userId, updatedState, updatedMarks);

    return newMarks;
};

/**
 * Call after a rush session is completed.
 *
 * @param supabase     Service-role client
 * @param userId       Authenticated user ID
 * @param mode         Rush mode: 'rush_10' | 'rush_20' | 'endless'
 * @param correctCount Number of correct answers in this session
 * @returns            Array of newly unlocked mark IDs
 */
export const applyRushCompleteMarks = async (
    supabase: SupabaseClient,
    userId: string,
    mode: string,
    correctCount: number
): Promise<string[]> => {
    const { data: profile } = await supabase
        .from('profiles')
        .select('xp_state')
        .eq('user_id', userId)
        .single();

    if (!profile) return [];

    const xpState = (profile.xp_state || {}) as XpState;
    const prevMarks = sanitizeStringList(xpState.marks, 160);

    const rushSessions = toSafeInt(xpState.rushSessions) + 1;

    const isRush10 = mode === 'rush_10';
    const isRush20 = mode === 'rush_20';
    const isEndless = mode === 'endless';

    const rushBestScore10 = isRush10
        ? Math.max(toSafeInt(xpState.rushBestScore10), correctCount)
        : toSafeInt(xpState.rushBestScore10);
    const rushBestScore20 = isRush20
        ? Math.max(toSafeInt(xpState.rushBestScore20), correctCount)
        : toSafeInt(xpState.rushBestScore20);
    const rushEndlessBest = isEndless
        ? Math.max(toSafeInt(xpState.rushEndlessBest), correctCount)
        : toSafeInt(xpState.rushEndlessBest);

    const updatedState: XpState = {
        ...xpState,
        rushSessions,
        rushBestScore10,
        rushBestScore20,
        rushEndlessBest,
    };

    const updatedMarks = computeQuizMarks(updatedState, prevMarks);
    const newMarks = updatedMarks.filter((m) => !prevMarks.includes(m));

    await persistQuizMarkState(supabase, userId, updatedState, updatedMarks);

    return newMarks;
};
