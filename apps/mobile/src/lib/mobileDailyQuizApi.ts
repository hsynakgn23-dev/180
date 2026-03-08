import { resolveMobileWebBaseUrl } from './mobileEnv';
import { readSupabaseSessionSafe } from './supabase';

export type MobileDailyQuizOptionKey = 'a' | 'b' | 'c' | 'd';
export type MobileDailyQuizLanguageCode = 'tr' | 'en' | 'es' | 'fr';

export type MobileDailyQuizBundle = {
  ok: true;
  date: string;
  status: string;
  language: MobileDailyQuizLanguageCode;
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
      options: Array<{ key: MobileDailyQuizOptionKey; label: string }>;
      attempt: null | {
        selectedOption: MobileDailyQuizOptionKey;
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

export type MobileDailyQuizBundleError = {
  ok: false;
  error: string;
  status?: number;
};

export type MobileDailyQuizAnswerResult =
  | {
      ok: true;
      questionId: string;
      selectedOption: MobileDailyQuizOptionKey;
      isCorrect: boolean;
      alreadyAnswered: boolean;
      explanation: string;
      progress: NonNullable<MobileDailyQuizBundle['progress']>;
      xp: {
        delta: number;
        total: number | null;
        streak: number | null;
        streakProtectedNow: boolean;
      };
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };

const buildMobileApiUrl = (path: string): string => {
  const webBase = resolveMobileWebBaseUrl();
  if (!webBase) {
    throw new Error('Mobil quiz API base URL bulunamadi.');
  }
  return `${webBase}${path.startsWith('/') ? path : `/${path}`}`;
};

const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const sessionResult = await readSupabaseSessionSafe();
  const accessToken = String(sessionResult.session?.access_token || '').trim();
  if (!accessToken) return {};
  return {
    Authorization: `Bearer ${accessToken}`,
  };
};

export const readMobileDailyQuizBundle = async (input: {
  dateKey?: string | null;
  language: MobileDailyQuizLanguageCode;
}): Promise<MobileDailyQuizBundle | MobileDailyQuizBundleError> => {
  try {
    const params = new URLSearchParams({
      lang: input.language,
    });
    if (input.dateKey) {
      params.set('date', input.dateKey);
    }

    const response = await fetch(buildMobileApiUrl(`/api/daily-bundle?${params.toString()}`), {
      headers: {
        Accept: 'application/json',
        ...(await buildAuthHeaders()),
      },
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as
      | MobileDailyQuizBundle
      | MobileDailyQuizBundleError;

    if (!response.ok) {
      const errorPayload = payload as Partial<MobileDailyQuizBundleError>;
      return {
        ok: false,
        error: typeof errorPayload.error === 'string' ? errorPayload.error : `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return payload;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gunluk quiz okunamadi.',
    };
  }
};

export const submitMobileDailyQuizAnswer = async (input: {
  dateKey: string;
  questionId: string;
  selectedOption: MobileDailyQuizOptionKey;
  language: MobileDailyQuizLanguageCode;
}): Promise<MobileDailyQuizAnswerResult> => {
  try {
    const response = await fetch(buildMobileApiUrl('/api/daily-quiz-answer'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await buildAuthHeaders()),
      },
      body: JSON.stringify({
        dateKey: input.dateKey,
        questionId: input.questionId,
        selectedOption: input.selectedOption,
        language: input.language,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as MobileDailyQuizAnswerResult;
    if (!response.ok) {
      const errorPayload = payload as Partial<Extract<MobileDailyQuizAnswerResult, { ok: false }>>;
      return {
        ok: false,
        error: typeof errorPayload.error === 'string' ? errorPayload.error : `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return payload;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gunluk quiz cevabi gonderilemedi.',
    };
  }
};
