import { MOBILE_API_BASE_URL_ERROR, resolveMobileApiUrl } from './mobileEnv';
import { fetchWithTimeout } from './network';
import { readSupabaseSessionSafe } from './supabase';

export type PoolLanguageCode = 'tr' | 'en' | 'es' | 'fr';
export type PoolOptionKey = 'a' | 'b' | 'c' | 'd';
export type RushMode = 'rush_15' | 'rush_30' | 'endless';
export type SwipeDirection = 'left' | 'right';
export type JokerSource = 'wallet' | 'bonus';
const POOL_OPTION_KEYS: PoolOptionKey[] = ['a', 'b', 'c', 'd'];

// --- Pool Movies ---

export type PoolMovie = {
  id: string;
  tmdb_id?: number;
  title: string;
  poster_path: string | null;
  genres?: string[];
  release_year: number | null;
  vote_average: number | null;
  question_count: number;
};

export type PoolMoviesResponse =
  | { ok: true; movies: PoolMovie[] }
  | { ok: false; error: string };

// --- Pool Quiz ---

export type PoolQuestion = {
  id: string;
  question: string;
  options: Array<{ key: PoolOptionKey; label: string }>;
};

export type FiftyFiftyJokerResult =
  | { ok: true; removed_options: PoolOptionKey[] }
  | { ok: false; error: string };

export type PoolQuizResponse =
  | { ok: true; movie_id: string; title: string; questions: PoolQuestion[] }
  | { ok: false; error: string };

// --- Pool Answer ---

export type PoolAnswerResult =
  | {
      ok: true;
      question_id: string;
      is_correct: boolean;
      correct_option: PoolOptionKey;
      explanation: string;
      xp_earned: number;
      bonus_xp: number;
      tickets_earned: number;
      arena_score_earned: number;
      progress: { answered: number; correct: number; total: number };
    }
  | { ok: false; error: string };

// --- Rush Session ---

export type RushSession = {
  id: string;
  mode: RushMode;
  expires_at: string | null;
  total_time_seconds: number | null;
  questions: Array<{
    id: string;
    question_id: string;
    movie_title: string;
    movie_poster_path: string | null;
    question: string;
    options: Array<{ key: PoolOptionKey; label: string }>;
  }>;
};

export type RushStartResponse =
  | { ok: true; session: RushSession }
  | {
      ok: false;
      error: string;
      requires_subscription?: boolean;
      limit_reached?: boolean;
      rewarded_ad_available?: boolean;
    };

export type RushAnswerResult =
  | {
      ok: true;
      is_correct: boolean;
      correct_option: PoolOptionKey;
      explanation: string;
      streak: number;
      expires_at: string | null;
      bonus_seconds: number;
      total_time_seconds: number | null;
    }
  | { ok: false; error: string; expired?: boolean };

export type RushCompleteResult =
  | {
      ok: true;
      total_answered: number;
      total_correct: number;
      xp_earned: number;
      tickets_earned: number;
      arena_score_earned: number;
      mode: RushMode;
    }
  | { ok: false; error: string };

export type RushJokerResult =
  | { ok: true; type: 'fifty_fifty'; removed_options: PoolOptionKey[] }
  | { ok: true; type: 'freeze'; expires_at: string | null }
  | { ok: true; type: 'pass' }
  | { ok: false; error: string };

type RushJokerSuccessType = 'fifty_fifty' | 'freeze' | 'pass';

// --- Subscription ---

export type SubscriptionStatus = {
  tier: 'free' | 'premium';
  daily_rush_limit: number | null;
  daily_rush_used: number;
  show_ads: boolean;
};

// --- Helpers ---

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value: unknown, maxLength = 320): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const isPoolOptionKey = (value: string): value is PoolOptionKey =>
  value === 'a' || value === 'b' || value === 'c' || value === 'd';

const parsePoolOptionKey = (value: unknown): PoolOptionKey | null => {
  const key = normalizeText(value, 4).toLowerCase();
  return isPoolOptionKey(key) ? key : null;
};

const parsePoolOptions = (value: unknown): Array<{ key: PoolOptionKey; label: string }> => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((option) => {
      const key = parsePoolOptionKey(option.key);
      const label = normalizeText(option.label, 240);
      return key && label ? { key, label } : null;
    })
    .filter((option): option is { key: PoolOptionKey; label: string } => Boolean(option));
};

const parsePoolOptionKeyList = (value: unknown): PoolOptionKey[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<PoolOptionKey>();
  const parsed: PoolOptionKey[] = [];
  for (const item of value) {
    const key = parsePoolOptionKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    parsed.push(key);
  }
  return parsed;
};

const toNullableNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const sessionResult = await readSupabaseSessionSafe();
  const accessToken = String(sessionResult.session?.access_token || '').trim();
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
};

const MOBILE_QUIZ_REQUEST_TIMEOUT_MS = 10000;

const requestMobileQuizApi = async (
  path: string,
  init: RequestInit,
  timeoutMessage: string,
): Promise<Response> => {
  const url = resolveMobileApiUrl(path);
  if (!url) {
    return new Response(JSON.stringify({ ok: false, error: MOBILE_API_BASE_URL_ERROR }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  return fetchWithTimeout({
    url,
    init,
    timeoutMs: MOBILE_QUIZ_REQUEST_TIMEOUT_MS,
    timeoutMessage,
  });
};

// --- API Functions ---

export const fetchPoolMovies = async (input: {
  language: PoolLanguageCode;
  genre?: string;
  limit?: number;
}): Promise<PoolMoviesResponse> => {
  try {
    const params = new URLSearchParams({ lang: input.language });
    if (input.genre) params.set('genre', input.genre);
    if (input.limit) params.set('limit', String(input.limit));

    const response = await requestMobileQuizApi(
      `/api/pool-movies?${params.toString()}`,
      {
        headers: { Accept: 'application/json', ...(await buildAuthHeaders()) },
        cache: 'no-store',
      },
      'Quiz filmleri zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const movies = Array.isArray(payload.movies)
      ? payload.movies.filter(isRecord).map((m) => ({
          id: normalizeText(m.id, 120),
          tmdb_id: Number(m.tmdb_id) || 0,
          title: normalizeText(m.title, 200),
          poster_path: normalizeText(m.poster_path, 400) || null,
          genres: Array.isArray(m.genres) ? m.genres.map((g: unknown) => String(g)) : [],
          release_year: Number(m.release_year) || null,
          vote_average: Number(m.vote_average) || null,
          question_count: Number(m.question_count) || 0,
        }))
      : [];
    return { ok: true, movies };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to load movies.' };
  }
};

export const submitPoolSwipe = async (input: {
  movie_id: string;
  direction: SwipeDirection;
}): Promise<{ ok: boolean; error?: string }> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/pool-swipe',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify({ movie_id: input.movie_id, direction: input.direction }),
      },
      'Swipe istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Swipe failed.' };
  }
};

export const fetchPoolQuiz = async (input: {
  movie_id: string;
  language: PoolLanguageCode;
}): Promise<PoolQuizResponse> => {
  try {
    const params = new URLSearchParams({ movie_id: input.movie_id, lang: input.language });
    const response = await requestMobileQuizApi(
      `/api/pool-quiz?${params.toString()}`,
      {
        headers: { Accept: 'application/json', ...(await buildAuthHeaders()) },
        cache: 'no-store',
      },
      'Quiz sorulari zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const questions = Array.isArray(payload.questions)
      ? payload.questions.filter(isRecord).map((q) => ({
          id: normalizeText(q.id, 120),
          question: normalizeText(q.question, 400),
          options: parsePoolOptions(q.options),
        }))
      : [];
    return {
      ok: true,
      movie_id: normalizeText(payload.movie_id, 120),
      title: normalizeText(payload.title, 200),
      questions,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to load quiz.' };
  }
};

export const submitPoolAnswer = async (input: {
  movie_id: string;
  question_id: string;
  selected_option: PoolOptionKey;
  language: PoolLanguageCode;
}): Promise<PoolAnswerResult> => {
  try {
    const selectedOption = parsePoolOptionKey(input.selected_option);
    if (!selectedOption) {
      return { ok: false, error: 'Gecersiz cevap secenegi.' };
    }
    const response = await requestMobileQuizApi(
      '/api/pool-answer',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify({ ...input, selected_option: selectedOption }),
      },
      'Quiz cevabi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const progress = isRecord(payload.progress) ? payload.progress : {};
    const correctOption = parsePoolOptionKey(payload.correct_option);
    if (!correctOption) {
      return { ok: false, error: 'Gecersiz quiz cevabi dondu.' };
    }
    return {
      ok: true,
      question_id: normalizeText(payload.question_id, 120),
      is_correct: payload.is_correct === true,
      correct_option: correctOption,
      explanation: normalizeText(payload.explanation, 400),
      xp_earned: Number(payload.xp_earned) || 0,
      bonus_xp: Number(payload.bonus_xp) || 0,
      tickets_earned: Number(payload.tickets_earned) || 0,
      arena_score_earned: Number(payload.arena_score_earned) || 0,
      progress: {
        answered: Number(progress.answered) || 0,
        correct: Number(progress.correct) || 0,
        total: Number(progress.total) || 0,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Answer failed.' };
  }
};

export const requestPoolFiftyFifty = async (input: {
  question_id: string;
  source?: JokerSource;
}): Promise<FiftyFiftyJokerResult> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/pool-joker',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify({
          question_id: input.question_id,
          type: 'fifty_fifty',
          source: input.source || 'wallet',
        }),
      },
      'Joker istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const removedOptions = parsePoolOptionKeyList(payload.removed_options);
    return { ok: true, removed_options: removedOptions };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to use joker.' };
  }
};

export const startRushSession = async (input: {
  mode: RushMode;
  language: PoolLanguageCode;
  reward_unlock?: boolean;
}): Promise<RushStartResponse> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/rush-start',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify(input),
      },
      'Rush baslatma istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return {
        ok: false,
        error: err || `HTTP ${response.status}`,
        requires_subscription: isRecord(payload) ? payload.requiresSubscription === true : false,
        limit_reached: response.status === 429 || (isRecord(payload) && payload.limitReached === true),
        rewarded_ad_available: response.status === 429 && isRecord(payload) ? payload.rewardedAdAvailable !== false : false,
      };
    }
    const session = isRecord(payload.session) ? payload.session : payload;
    const questions = Array.isArray(session.questions)
      ? session.questions.filter(isRecord).map((q) => ({
          id: normalizeText(q.id, 120),
          question_id: normalizeText(q.question_id ?? q.id, 120),
          movie_title: normalizeText(q.movie_title ?? q.movieTitle, 200),
          movie_poster_path: normalizeText(q.movie_poster_path ?? q.moviePosterPath ?? q.poster_path, 400) || null,
          question: normalizeText(q.question, 400),
          options: parsePoolOptions(q.options),
        }))
      : [];
    const mode = (normalizeText(session.mode ?? payload.mode, 20) as RushMode) || input.mode;
    return {
      ok: true,
      session: {
        id: normalizeText(session.id ?? payload.sessionId, 120),
        mode,
        expires_at: normalizeText(session.expires_at ?? session.expiresAt ?? payload.expiresAt, 80) || null,
        total_time_seconds: toNullableNumber(
          session.total_time_seconds ??
            session.time_limit_seconds ??
            payload.total_time_seconds ??
            payload.time_limit_seconds ??
            payload.totalTimeSeconds ??
            payload.timeLimitSeconds,
        ),
        questions,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to start rush.' };
  }
};

export const submitRushAnswer = async (input: {
  session_id: string;
  attempt_id: string;
  selected_option: PoolOptionKey;
}): Promise<RushAnswerResult> => {
  try {
    const selectedOption = parsePoolOptionKey(input.selected_option);
    if (!selectedOption) {
      return { ok: false, error: 'Gecersiz rush secenegi.' };
    }
    const response = await requestMobileQuizApi(
      '/api/rush-answer',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify({
          session_id: input.session_id,
          sessionId: input.session_id,
          attempt_id: input.attempt_id,
          questionId: input.attempt_id,
          selected_option: selectedOption,
          selectedOption: selectedOption,
        }),
      },
      'Rush cevabi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload)) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      const expired = isRecord(payload)
        ? payload.expired === true || normalizeText(payload.status, 40) === 'expired'
        : false;
      return { ok: false, error: err || `HTTP ${response.status}`, expired };
    }
    if (payload.ok !== true) {
      return {
        ok: false,
        error: normalizeText(payload.error, 240) || 'Answer failed.',
        expired: payload.expired === true || normalizeText(payload.status, 40) === 'expired',
      };
    }
    const correctOption = parsePoolOptionKey(payload.correct_option ?? payload.correctOption);
    if (!correctOption) {
      return { ok: false, error: 'Gecersiz rush cevabi dondu.' };
    }
    return {
      ok: true,
      is_correct: payload.is_correct === true || payload.isCorrect === true,
      correct_option: correctOption,
      explanation: normalizeText(payload.explanation, 400),
      streak: Number(payload.streak) || 0,
      expires_at: normalizeText(payload.expires_at ?? payload.expiresAt, 120) || null,
      bonus_seconds: Number(payload.bonus_seconds ?? payload.bonusSeconds) || 0,
      total_time_seconds: toNullableNumber(payload.total_time_seconds ?? payload.totalTimeSeconds),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Rush answer failed.' };
  }
};

export const completeRushSession = async (input: {
  session_id: string;
}): Promise<RushCompleteResult> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/rush-complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify({
          session_id: input.session_id,
          sessionId: input.session_id,
        }),
      },
      'Rush tamamlama istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const totalCorrect = Number(payload.total_correct ?? payload.correctCount) || 0;
    const totalAnswered =
      Number(payload.total_answered) ||
      Number(payload.totalAnswered) ||
      totalCorrect + (Number(payload.wrongCount) || 0);
    return {
      ok: true,
      total_answered: totalAnswered,
      total_correct: totalCorrect,
      xp_earned: Number(payload.xp_earned ?? payload.xpEarned) || 0,
      tickets_earned: Number(payload.tickets_earned ?? payload.ticketsEarned) || 0,
      arena_score_earned: Number(payload.arena_score_earned ?? payload.arenaScoreEarned) || 0,
      mode: normalizeText(payload.mode, 20) as RushMode,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Rush complete failed.' };
  }
};

export const requestRushJoker = async (input: {
  session_id: string;
  attempt_id: string;
  type: 'fifty_fifty' | 'freeze' | 'pass';
  seconds?: number;
  source?: JokerSource;
}): Promise<RushJokerResult> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/rush-joker',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify({
          session_id: input.session_id,
          sessionId: input.session_id,
          attempt_id: input.attempt_id,
          questionId: input.attempt_id,
          type: input.type,
          seconds: input.seconds,
          source: input.source || 'wallet',
        }),
      },
      'Rush joker istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const responseType = normalizeText(payload.type, 40) as RushJokerSuccessType | '';
    if (responseType === 'fifty_fifty') {
      const removedOptions = parsePoolOptionKeyList(payload.removed_options);
      return { ok: true, type: 'fifty_fifty', removed_options: removedOptions };
    }
    if (responseType === 'pass') {
      return { ok: true, type: 'pass' };
    }
    if (responseType !== 'freeze') {
      return { ok: false, error: 'Unexpected joker response.' };
    }
    return {
      ok: true,
      type: 'freeze',
      expires_at: normalizeText(payload.expires_at, 120) || null,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to use joker.' };
  }
};

export const fetchSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/subscription-status',
      {
        headers: { Accept: 'application/json', ...(await buildAuthHeaders()) },
        cache: 'no-store',
      },
      'Abonelik durumu istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (response.ok && isRecord(payload)) {
      const limits = isRecord(payload.limits) ? payload.limits : {};
      const dailyRushLimit = toNullableNumber(payload.daily_rush_limit ?? limits.dailyRushLimit);
      const dailyRushUsed = Number(payload.daily_rush_used ?? limits.dailyRushUsed) || 0;
      const tier = payload.tier === 'premium' ? 'premium' : 'free';
      const showAds = payload.show_ads === false
        ? false
        : limits.adsEnabled === false
          ? false
          : tier !== 'premium';
      return {
        tier,
        daily_rush_limit: dailyRushLimit,
        daily_rush_used: dailyRushUsed,
        show_ads: showAds,
      };
    }
    return { tier: 'free', daily_rush_limit: 3, daily_rush_used: 0, show_ads: true };
  } catch {
    return { tier: 'free', daily_rush_limit: 3, daily_rush_used: 0, show_ads: true };
  }
};

// --- Blur Quiz ---

export type BlurQuizHints = {
  director: string;
  release_year: number | null;
  cast: string[];
  genre: string;
};

export type BlurQuizJokerKey = 'director' | 'year' | 'cast' | 'genre';

export type BlurQuizMovie = {
  movie_id: string;
  session_id: string;
  poster_path: string;
  hints: BlurQuizHints;
};

export type BlurQuizMovieResponse =
  | ({ ok: true } & BlurQuizMovie)
  | { ok: false; error: string };

export type BlurQuizVerifyResponse =
  | {
      ok: true;
      correct: boolean;
      xp_earned: number;
      tickets_earned: number;
      arena_score_earned: number;
      needs_retry?: boolean;
      retry_reason?: string;
      needs_confirmation?: boolean;
      suggested_title?: string;
      match_score?: number;
      matched_title?: string | null;
    }
  | { ok: false; error: string };

export type BlurQuizJokerResponse =
  | { ok: true; jokers_used: number; used_jokers: BlurQuizJokerKey[] }
  | { ok: false; error: string };

export const fetchBlurMovie = async (options?: {
  excludeIds?: string[];
  excludeGenres?: string[];
}): Promise<BlurQuizMovieResponse> => {
  try {
    const params = new URLSearchParams();
    if (options?.excludeIds?.length) {
      params.set('exclude', options.excludeIds.join(','));
    }
    if (options?.excludeGenres?.length) {
      params.set('excludeGenres', options.excludeGenres.join(','));
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await requestMobileQuizApi(
      `/api/blur-quiz${qs}`,
      {
        headers: { Accept: 'application/json', ...(await buildAuthHeaders()) },
        cache: 'no-store',
      },
      'Blur quiz istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const hints = isRecord(payload.hints) ? payload.hints : {};
    return {
      ok: true,
      movie_id: normalizeText(payload.movie_id, 120),
      session_id: normalizeText(payload.session_id, 120),
      poster_path: normalizeText(payload.poster_path, 400),
      hints: {
        director: normalizeText(hints.director, 200),
        release_year: Number(hints.release_year) || null,
        cast: Array.isArray(hints.cast) ? hints.cast.map((c: unknown) => String(c)) : [],
        genre: normalizeText(hints.genre, 200),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
};

export const verifyBlurGuess = async (input: {
  session_id: string;
  guess: string;
  confirm_guess?: boolean;
}): Promise<BlurQuizVerifyResponse> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/blur-quiz',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify(input),
      },
      'Blur quiz cevabi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    return {
      ok: true,
      correct: Boolean(payload.correct),
      xp_earned: Number(payload.xp_earned) || 0,
      tickets_earned: Number(payload.tickets_earned) || 0,
      arena_score_earned: Number(payload.arena_score_earned) || 0,
      needs_retry: payload.needs_retry === true,
      retry_reason: normalizeText(payload.retry_reason, 80) || undefined,
      needs_confirmation: payload.needs_confirmation === true,
      suggested_title: normalizeText(payload.suggested_title, 200) || undefined,
      match_score: toNullableNumber(payload.match_score) ?? undefined,
      matched_title: normalizeText(payload.matched_title, 200) || null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
};

export const useBlurQuizJoker = async (input: {
  session_id: string;
  joker_key: BlurQuizJokerKey;
}): Promise<BlurQuizJokerResponse> => {
  try {
    const response = await requestMobileQuizApi(
      '/api/blur-quiz',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
        body: JSON.stringify({
          action: 'joker_use',
          session_id: input.session_id,
          joker_key: input.joker_key,
        }),
      },
      'Blur joker istegi zaman asimina ugradi.',
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    return {
      ok: true,
      jokers_used: Number(payload.jokers_used) || 0,
      used_jokers: Array.isArray(payload.used_jokers)
        ? payload.used_jokers
            .map((value) => normalizeText(value, 20) as BlurQuizJokerKey)
            .filter((value) => ['director', 'year', 'cast', 'genre'].includes(value))
        : [],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
};
