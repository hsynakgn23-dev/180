import { buildApiUrl } from './apiBase';
import { supabase } from './supabase';

export type PoolOptionKey = 'a' | 'b' | 'c' | 'd';
export type PoolLanguageCode = 'tr' | 'en' | 'es' | 'fr';
export type RushMode = 'rush_15' | 'rush_30' | 'endless';
export type SwipeDirection = 'left' | 'right';
export type JokerSource = 'wallet' | 'bonus';
export type RushJokerKey = 'fifty_fifty' | 'pass' | 'freeze';

export type PoolMovie = {
    id: string;
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    genres: string[];
    release_year: number | null;
    vote_average: number | null;
    question_count: number;
};

export type PoolQuestion = {
    id: string;
    question: string;
    options: Array<{ key: PoolOptionKey; label: string }>;
};

export type RushSessionQuestion = {
    id: string;
    question_id: string;
    movie_title: string;
    movie_poster_path: string | null;
    question: string;
    options: Array<{ key: PoolOptionKey; label: string }>;
};

export type RushSession = {
    id: string;
    mode: RushMode;
    expires_at: string | null;
    questions: RushSessionQuestion[];
};

export type FiftyFiftyJokerResult =
    | { ok: true; removed_options: PoolOptionKey[] }
    | { ok: false; error: string };

export type RushJokerResult =
    | { ok: true; type: 'fifty_fifty'; removed_options: PoolOptionKey[] }
    | { ok: true; type: 'freeze'; expires_at: string | null }
    | { ok: true; type: 'pass' }
    | { ok: false; error: string };

const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
};

export const fetchPoolMovies = async (input: {
    language: PoolLanguageCode;
    genre?: string;
    limit?: number;
}): Promise<{ ok: true; movies: PoolMovie[] } | { ok: false; error: string }> => {
    try {
        const params = new URLSearchParams({ lang: input.language });
        if (input.genre) params.set('genre', input.genre);
        if (input.limit) params.set('limit', String(input.limit));
        const res = await fetch(buildApiUrl(`/api/pool-movies?${params.toString()}`), {
            headers: { Accept: 'application/json', ...(await getAuthHeaders()) },
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        return { ok: true, movies: json.movies ?? [] };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const submitPoolSwipe = async (movieId: string, direction: SwipeDirection): Promise<void> => {
    await fetch(buildApiUrl('/api/pool-swipe'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ movie_id: movieId, direction }),
    }).catch(() => {});
};

export const fetchPoolQuiz = async (
    movieId: string,
    language: PoolLanguageCode
): Promise<{ ok: true; movie_id: string; title: string; questions: PoolQuestion[] } | { ok: false; error: string }> => {
    try {
        const params = new URLSearchParams({ movie_id: movieId, lang: language });
        const res = await fetch(buildApiUrl(`/api/pool-quiz?${params.toString()}`), {
            headers: { Accept: 'application/json', ...(await getAuthHeaders()) },
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        return { ok: true, movie_id: json.movie_id, title: json.title, questions: json.questions ?? [] };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const submitPoolAnswer = async (input: {
    movie_id: string;
    question_id: string;
    selected_option: PoolOptionKey;
    language: PoolLanguageCode;
}): Promise<{
    ok: true; is_correct: boolean; correct_option: PoolOptionKey; explanation: string;
    xp_earned: number; bonus_xp: number; progress: { answered: number; correct: number; total: number };
} | { ok: false; error: string }> => {
    try {
        const res = await fetch(buildApiUrl('/api/pool-answer'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify(input),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        return {
            ok: true,
            is_correct: json.is_correct,
            correct_option: json.correct_option,
            explanation: json.explanation ?? '',
            xp_earned: json.xp_earned ?? 0,
            bonus_xp: json.bonus_xp ?? 0,
            progress: json.progress ?? { answered: 0, correct: 0, total: 0 },
        };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const requestPoolFiftyFifty = async (input: {
    question_id: string;
    source?: JokerSource;
}): Promise<FiftyFiftyJokerResult> => {
    try {
        const res = await fetch(buildApiUrl('/api/pool-joker'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({
                question_id: input.question_id,
                questionId: input.question_id,
                type: 'fifty_fifty',
                source: input.source ?? 'wallet',
            }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        const removedOptions = Array.isArray(json.removed_options)
            ? json.removed_options.filter((value: unknown): value is PoolOptionKey =>
                value === 'a' || value === 'b' || value === 'c' || value === 'd'
            )
            : [];
        return { ok: true, removed_options: removedOptions };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const startRushSession = async (
    mode: RushMode,
    language: PoolLanguageCode
): Promise<{
    ok: true; session: RushSession;
} | {
    ok: false; error: string; auth_required?: boolean; requires_subscription?: boolean; limit_reached?: boolean; rewarded_ad_available?: boolean;
}> => {
    try {
        const res = await fetch(buildApiUrl('/api/rush-start'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({ mode, language }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
            return {
                ok: false,
                error: json?.error || `HTTP ${res.status}`,
                auth_required: res.status === 401 || json?.auth_required === true || json?.authRequired === true,
                requires_subscription: json?.requiresSubscription === true || json?.requires_subscription === true,
                limit_reached: res.status === 429 || json?.limitReached === true || json?.limit_reached === true,
                rewarded_ad_available: res.status === 429
                    ? json?.rewardedAdAvailable !== false && json?.rewarded_ad_available !== false
                    : false,
            };
        }
        const s = json.session ?? json;
        const rawQuestions = Array.isArray(s.questions) ? s.questions : Array.isArray(json.questions) ? json.questions : [];
        const questions = rawQuestions.length
            ? rawQuestions.map((q: Record<string, unknown>) => ({
                id: String(q.id || ''),
                question_id: String(q.question_id || q.id || ''),
                movie_title: String(q.movie_title || q.movieTitle || ''),
                movie_poster_path: String(q.movie_poster_path || q.moviePosterPath || q.poster_path || '') || null,
                question: String(q.question || ''),
                options: Array.isArray(q.options) ? q.options as Array<{ key: PoolOptionKey; label: string }> : [],
            }))
            : [];
        const nextMode = (s.mode ?? json.mode ?? mode) as RushMode;
        return {
            ok: true,
            session: {
                id: s.id ?? json.sessionId,
                mode: nextMode,
                expires_at: s.expires_at ?? s.expiresAt ?? json.expiresAt ?? null,
                questions,
            },
        };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const submitRushAnswer = async (input: {
    session_id: string;
    attempt_id: string;
    selected_option: PoolOptionKey;
}): Promise<{
    ok: true; is_correct: boolean; correct_option: PoolOptionKey; explanation: string; streak: number; expires_at?: string | null; total_time_seconds?: number;
} | { ok: false; error: string; expired?: boolean }> => {
    try {
        const res = await fetch(buildApiUrl('/api/rush-answer'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({
                session_id: input.session_id,
                sessionId: input.session_id,
                attempt_id: input.attempt_id,
                questionId: input.attempt_id,
                selected_option: input.selected_option,
                selectedOption: input.selected_option,
            }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
            return {
                ok: false,
                error: json?.error || `HTTP ${res.status}`,
                expired: json?.expired === true || String(json?.status || '').trim() === 'expired',
            };
        }
        return {
            ok: true,
            is_correct: json.is_correct === true || json?.isCorrect === true,
            correct_option: (json.correct_option ?? json.correctOption) as PoolOptionKey,
            explanation: json.explanation ?? '',
            streak: json.streak ?? 0,
            expires_at: json.expires_at ?? json.expiresAt ?? null,
            total_time_seconds: Number.isFinite(Number(json.total_time_seconds ?? json.totalTimeSeconds))
                ? Number(json.total_time_seconds ?? json.totalTimeSeconds)
                : undefined,
        };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const requestRushJoker = async (input: {
    session_id: string;
    attempt_id: string;
    type: RushJokerKey;
    seconds?: number;
    source?: JokerSource;
}): Promise<RushJokerResult> => {
    try {
        const res = await fetch(buildApiUrl('/api/rush-joker'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({
                session_id: input.session_id,
                sessionId: input.session_id,
                attempt_id: input.attempt_id,
                question_id: input.attempt_id,
                questionId: input.attempt_id,
                type: input.type,
                seconds: input.seconds,
                source: input.source ?? 'wallet',
            }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        const type = (json.type ?? input.type) as RushJokerKey;
        if (type === 'freeze') {
            return { ok: true, type: 'freeze', expires_at: json.expires_at ?? json.expiresAt ?? null };
        }
        if (type === 'pass') {
            return { ok: true, type: 'pass' };
        }
        const removedOptions = Array.isArray(json.removed_options)
            ? json.removed_options.filter((value: unknown): value is PoolOptionKey =>
                value === 'a' || value === 'b' || value === 'c' || value === 'd'
            )
            : [];
        return { ok: true, type: 'fifty_fifty', removed_options: removedOptions };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const completeRushSession = async (
    sessionId: string
): Promise<{ ok: true; total_answered: number; total_correct: number; xp_earned: number; mode: RushMode } | { ok: false; error: string }> => {
    try {
        const res = await fetch(buildApiUrl('/api/rush-complete'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({ session_id: sessionId, sessionId }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        const totalCorrect = Number(json.total_correct ?? json.correctCount) || 0;
        const totalAnswered =
            Number(json.total_answered) ||
            Number(json.totalAnswered) ||
            totalCorrect + (Number(json.wrongCount) || 0);
        return {
            ok: true,
            total_answered: totalAnswered,
            total_correct: totalCorrect,
            xp_earned: json.xp_earned ?? json.xpEarned ?? 0,
            mode: json.mode,
        };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const fetchSubscriptionStatus = async (): Promise<{
    tier: 'free' | 'premium';
    daily_rush_limit: number | null;
    daily_rush_used: number;
    show_ads: boolean;
}> => {
    try {
        const res = await fetch(buildApiUrl('/api/subscription-status'), {
            headers: { Accept: 'application/json', ...(await getAuthHeaders()) },
        });
        const json = await res.json();
        if (res.ok && json) {
            const limits = json.limits ?? {};
            const tier = json.tier === 'premium' ? 'premium' : 'free';
            return {
                tier,
                daily_rush_limit: json.daily_rush_limit ?? limits.dailyRushLimit ?? 3,
                daily_rush_used: json.daily_rush_used ?? limits.dailyRushUsed ?? 0,
                show_ads: json.show_ads === false ? false : limits.adsEnabled === false ? false : tier !== 'premium',
            };
        }
    } catch { /* fallback */ }
    return { tier: 'free', daily_rush_limit: 3, daily_rush_used: 0, show_ads: true };
};
