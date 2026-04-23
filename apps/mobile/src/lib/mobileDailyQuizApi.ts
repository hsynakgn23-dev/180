import { buildQuizAuthHeaders, quizRequest } from './quizTransport';

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
        tickets: number;
        arenaScore: number;
      };
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };

const normalizeText = (value: unknown, maxLength = 320): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toNonNegativeInteger = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const toNullableInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
};

const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

const normalizeLanguage = (value: unknown): MobileDailyQuizLanguageCode => {
  const text = normalizeText(value, 16).toLowerCase();
  if (text === 'tr' || text === 'en' || text === 'es' || text === 'fr') return text;
  return 'en';
};

const normalizeOptionKey = (value: unknown): MobileDailyQuizOptionKey | null => {
  const text = normalizeText(value, 4).toLowerCase();
  if (text === 'a' || text === 'b' || text === 'c' || text === 'd') return text;
  return null;
};

const normalizeBundleProgress = (
  value: unknown
): NonNullable<MobileDailyQuizBundle['progress']> | null => {
  if (!isRecord(value)) return null;

  return {
    answeredCount: toNonNegativeInteger(value.answeredCount),
    correctCount: toNonNegativeInteger(value.correctCount),
    completedMovieIds: Array.isArray(value.completedMovieIds)
      ? value.completedMovieIds
          .map((entry) => toNullableInteger(entry))
          .filter((entry): entry is number => entry !== null && entry > 0)
      : [],
    streakProtected: toBoolean(value.streakProtected),
    streakProtectedAt: normalizeText(value.streakProtectedAt, 80) || null,
    xpAwarded: toNonNegativeInteger(value.xpAwarded),
    lastAnsweredAt: normalizeText(value.lastAnsweredAt, 80) || null,
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
};

const normalizeBundle = (value: unknown): MobileDailyQuizBundle | null => {
  if (!isRecord(value) || value.ok !== true) return null;

  const questionsByMovie = Array.isArray(value.questionsByMovie)
    ? value.questionsByMovie
        .map((movieBlock, movieIndex) => {
          if (!isRecord(movieBlock)) return null;

          const movieId = toNullableInteger(movieBlock.movieId);
          const questions = Array.isArray(movieBlock.questions)
            ? movieBlock.questions
                .map((question, questionIndex) => {
                  if (!isRecord(question)) return null;

                  const questionId = normalizeText(question.id, 120);
                  const options = Array.isArray(question.options)
                    ? question.options
                        .map((option) => {
                          if (!isRecord(option)) return null;
                          const key = normalizeOptionKey(option.key);
                          const label = normalizeText(option.label, 240);
                          if (!key || !label) return null;
                          return { key, label };
                        })
                        .filter(
                          (
                            option
                          ): option is { key: MobileDailyQuizOptionKey; label: string } => Boolean(option)
                        )
                    : [];

                  if (!questionId || options.length === 0) return null;

                  const attempt = isRecord(question.attempt)
                    ? (() => {
                        const selectedOption = normalizeOptionKey(question.attempt.selectedOption);
                        if (!selectedOption) return null;
                        return {
                          selectedOption,
                          isCorrect: toBoolean(question.attempt.isCorrect),
                          answeredAt:
                            normalizeText(question.attempt.answeredAt, 80) || new Date().toISOString(),
                          explanation: normalizeText(question.attempt.explanation, 400),
                        };
                      })()
                    : null;

                  return {
                    id: questionId,
                    questionKey:
                      normalizeText(question.questionKey, 120) || `question-${movieIndex}-${questionIndex}`,
                    questionOrder: toNonNegativeInteger(question.questionOrder, questionIndex + 1),
                    question:
                      normalizeText(question.question, 400) ||
                      `Question ${String(questionIndex + 1).padStart(2, '0')}`,
                    options,
                    attempt,
                  };
                })
                .filter(
                  (
                    question
                  ): question is MobileDailyQuizBundle['questionsByMovie'][number]['questions'][number] =>
                    Boolean(question)
                )
            : [];

          if (!movieId || questions.length === 0) return null;

          return {
            movieId,
            movieTitle: normalizeText(movieBlock.movieTitle, 180) || `Movie ${movieId}`,
            movieOrder: toNonNegativeInteger(movieBlock.movieOrder, movieIndex),
            requiredCorrectCount: Math.min(
              questions.length,
              Math.max(0, toNonNegativeInteger(movieBlock.requiredCorrectCount, 0))
            ),
            questions,
          };
        })
        .filter(
          (
            movieBlock
          ): movieBlock is MobileDailyQuizBundle['questionsByMovie'][number] => Boolean(movieBlock)
        )
    : [];

  const date = normalizeText(value.date, 40);
  if (!date) return null;

  return {
    ok: true,
    date,
    status: normalizeText(value.status, 40) || 'published',
    language: normalizeLanguage(value.language),
    questionCount: toNonNegativeInteger(
      value.questionCount,
      questionsByMovie.reduce((sum, movieBlock) => sum + movieBlock.questions.length, 0)
    ),
    questionsByMovie,
    progress: normalizeBundleProgress(value.progress),
  };
};

const normalizeAnswerResult = (
  value: unknown
): Extract<MobileDailyQuizAnswerResult, { ok: true }> | null => {
  if (!isRecord(value) || value.ok !== true) return null;

  const questionId = normalizeText(value.questionId, 120);
  const selectedOption = normalizeOptionKey(value.selectedOption);
  const progress = normalizeBundleProgress(value.progress);
  const xp = isRecord(value.xp)
    ? {
        delta: toNonNegativeInteger(value.xp.delta),
        total: toNullableInteger(value.xp.total),
        streak: toNullableInteger(value.xp.streak),
        streakProtectedNow: toBoolean(value.xp.streakProtectedNow),
        tickets: toNonNegativeInteger(value.xp.tickets),
        arenaScore: toNonNegativeInteger(value.xp.arenaScore),
      }
    : null;

  if (!questionId || !selectedOption || !progress || !xp) return null;

  return {
    ok: true,
    questionId,
    selectedOption,
    isCorrect: toBoolean(value.isCorrect),
    alreadyAnswered: toBoolean(value.alreadyAnswered),
    explanation: normalizeText(value.explanation, 400),
    progress,
    xp,
  };
};

// Auth header'i paylasilan transport katmanindan aliyoruz. quizTransport hem
// session okuma timeout'u, hem 401'de otomatik token refresh yoneterek bu
// islevi zaten tam olarak karsiliyor — burada yeniden tanimlamiyoruz.
const buildAuthHeaders = buildQuizAuthHeaders;

// quizTransport; timeout, exponential backoff retry, 401'de tek seferlik token
// refresh ve yazma isteklerinde idempotency key'i otomatik ekler.
const requestMobileDailyQuizApi = (
  path: string,
  init: RequestInit,
  timeoutMessage: string,
): Promise<Response> => quizRequest(path, init, { timeoutMessage });

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

    const response = await requestMobileDailyQuizApi(
      `/api/daily-bundle?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          ...(await buildAuthHeaders()),
        },
        cache: 'no-store',
      },
      'Gunluk quiz istegi zaman asimina ugradi.',
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const errorPayload = isRecord(payload) ? payload : null;
      return {
        ok: false,
        error:
          normalizeText(errorPayload?.error, 240) ||
          normalizeText(errorPayload?.message, 240) ||
          `HTTP ${response.status}`,
        status: response.status,
      };
    }

    const normalizedPayload = normalizeBundle(payload);
    if (!normalizedPayload) {
      return {
        ok: false,
        error: 'Gunluk quiz verisi gecersiz.',
      };
    }

    return normalizedPayload;
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
    const response = await requestMobileDailyQuizApi(
      '/api/daily-quiz-answer',
      {
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
      },
      'Gunluk quiz cevabi zaman asimina ugradi.',
    );

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const errorPayload = isRecord(payload) ? payload : null;
      return {
        ok: false,
        error:
          normalizeText(errorPayload?.error, 240) ||
          normalizeText(errorPayload?.message, 240) ||
          `HTTP ${response.status}`,
        status: response.status,
      };
    }

    const normalizedPayload = normalizeAnswerResult(payload);
    if (!normalizedPayload) {
      return {
        ok: false,
        error: 'Gunluk quiz cevabi gecersiz.',
      };
    }

    return normalizedPayload;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gunluk quiz cevabi gonderilemedi.',
    };
  }
};
