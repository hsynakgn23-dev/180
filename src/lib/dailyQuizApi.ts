import { buildApiUrl } from './apiBase';
import { fetchWithTimeout } from './network';
import { isSupabaseLive, supabase } from './supabase';

export type DailyQuizOptionKey = 'a' | 'b' | 'c' | 'd';
export type DailyQuizLanguageCode = 'tr' | 'en' | 'es' | 'fr';

export type DailyQuizBundle = {
    ok: true;
    date: string;
    status: string;
    language: DailyQuizLanguageCode;
    questionCount: number;
    questionsByMovie: Array<{
        movieId: number;
        movieTitle: string;
        movieOrder: number;
        requiredCorrectCount: number;
        questions: Array<{
            id: string;
            questionKey: string;
            questionOrder: number;
            question: string;
            options: Array<{ key: DailyQuizOptionKey; label: string }>;
            attempt: null | {
                selectedOption: DailyQuizOptionKey;
                isCorrect: boolean;
                answeredAt: string;
                explanation: string;
            };
        }>;
    }>;
    progress: null | {
        answeredCount: number;
        correctCount: number;
        completedMovieIds: number[];
        streakProtected: boolean;
        streakProtectedAt: string | null;
        xpAwarded: number;
        lastAnsweredAt: string | null;
        metadata: Record<string, unknown>;
    };
};

export type DailyQuizBundleError = {
    ok: false;
    error: string;
    status?: number;
};

export type DailyQuizAnswerResult = {
    ok: true;
    questionId: string;
    selectedOption: DailyQuizOptionKey;
    isCorrect: boolean;
    alreadyAnswered: boolean;
    explanation: string;
    progress: NonNullable<DailyQuizBundle['progress']>;
    xp: {
        delta: number;
        total: number | null;
        streak: number | null;
        streakProtectedNow: boolean;
    };
} | {
    ok: false;
    error: string;
    status?: number;
};

const DAILY_QUIZ_REQUEST_TIMEOUT_MS = 10000;
const DAILY_QUIZ_TIMEOUT_ERROR = 'Quiz request timed out. Please try again.';

const getAccessToken = async (): Promise<string | null> => {
    if (!isSupabaseLive() || !supabase) return null;
    try {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
    } catch {
        return null;
    }
};

const buildAuthHeaders = async (): Promise<Record<string, string>> => {
    const accessToken = await getAccessToken();
    if (!accessToken) return {};
    return {
        Authorization: `Bearer ${accessToken}`
    };
};

export const readDailyQuizBundle = async (input: {
    dateKey?: string;
    language: DailyQuizLanguageCode;
}): Promise<DailyQuizBundle | DailyQuizBundleError> => {
    try {
        const params = new URLSearchParams({
            lang: input.language
        });
        if (input.dateKey) {
            params.set('date', input.dateKey);
        }

        const response = await fetchWithTimeout({
            url: buildApiUrl(`/api/daily-bundle?${params.toString()}`),
            timeoutMs: DAILY_QUIZ_REQUEST_TIMEOUT_MS,
            timeoutMessage: DAILY_QUIZ_TIMEOUT_ERROR,
            init: {
                headers: {
                    Accept: 'application/json',
                    ...(await buildAuthHeaders())
                },
                cache: 'no-store'
            }
        });

        const payload = (await response.json().catch(() => ({}))) as DailyQuizBundle | DailyQuizBundleError;
        if (!response.ok) {
            const errorPayload = payload as Partial<DailyQuizBundleError>;
            return {
                ok: false,
                error: typeof errorPayload.error === 'string' ? errorPayload.error : `HTTP ${response.status}`,
                status: response.status
            };
        }

        return payload;
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : DAILY_QUIZ_TIMEOUT_ERROR
        };
    }
};

export const submitDailyQuizAnswer = async (input: {
    dateKey: string;
    questionId: string;
    selectedOption: DailyQuizOptionKey;
    language: DailyQuizLanguageCode;
}): Promise<DailyQuizAnswerResult> => {
    try {
        const response = await fetchWithTimeout({
            url: buildApiUrl('/api/daily-quiz-answer'),
            timeoutMs: DAILY_QUIZ_REQUEST_TIMEOUT_MS,
            timeoutMessage: DAILY_QUIZ_TIMEOUT_ERROR,
            init: {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    ...(await buildAuthHeaders())
                },
                body: JSON.stringify({
                    dateKey: input.dateKey,
                    questionId: input.questionId,
                    selectedOption: input.selectedOption,
                    language: input.language
                })
            }
        });

        const payload = (await response.json().catch(() => ({}))) as DailyQuizAnswerResult;
        if (!response.ok) {
            const errorPayload = payload as Partial<Extract<DailyQuizAnswerResult, { ok: false }>>;
            return {
                ok: false,
                error: typeof errorPayload.error === 'string' ? errorPayload.error : `HTTP ${response.status}`,
                status: response.status
            };
        }

        return payload;
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : DAILY_QUIZ_TIMEOUT_ERROR
        };
    }
};
