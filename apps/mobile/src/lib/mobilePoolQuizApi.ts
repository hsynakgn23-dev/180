import { resolveMobileDailyApiUrl, resolveMobileReferralApiBase } from './mobileEnv';
import { readSupabaseSessionSafe } from './supabase';

export type PoolLanguageCode = 'tr' | 'en' | 'es' | 'fr';
export type PoolOptionKey = 'a' | 'b' | 'c' | 'd';
export type RushMode = 'rush_15' | 'rush_30' | 'endless';
export type SwipeDirection = 'left' | 'right';

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
      progress: { answered: number; correct: number; total: number };
    }
  | { ok: false; error: string };

// --- Rush Session ---

export type RushSession = {
  id: string;
  mode: RushMode;
  expires_at: string | null;
  questions: Array<{
    id: string;
    question_id: string;
    movie_title: string;
    question: string;
    options: Array<{ key: PoolOptionKey; label: string }>;
  }>;
};

export type RushStartResponse =
  | { ok: true; session: RushSession }
  | { ok: false; error: string };

export type RushAnswerResult =
  | {
      ok: true;
      is_correct: boolean;
      correct_option: PoolOptionKey;
      explanation: string;
      streak: number;
    }
  | { ok: false; error: string; expired?: boolean };

export type RushCompleteResult =
  | {
      ok: true;
      total_answered: number;
      total_correct: number;
      xp_earned: number;
      mode: RushMode;
    }
  | { ok: false; error: string };

// --- Subscription ---

export type SubscriptionStatus = {
  tier: 'free' | 'premium';
  daily_rush_limit: number;
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

const buildMobileApiUrl = (path: string): string => {
  const referralBase = resolveMobileReferralApiBase();
  const dailyApiUrl = resolveMobileDailyApiUrl();
  const dailyBase = dailyApiUrl.replace(/\/api\/daily(?:\/)?$/i, '');
  const apiBase = dailyBase || referralBase;
  if (!apiBase) throw new Error('Mobile API base URL not found.');
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
};

const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const sessionResult = await readSupabaseSessionSafe();
  const accessToken = String(sessionResult.session?.access_token || '').trim();
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
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

    const response = await fetch(buildMobileApiUrl(`/api/pool-movies?${params.toString()}`), {
      headers: { Accept: 'application/json', ...(await buildAuthHeaders()) },
      cache: 'no-store',
    });
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
    const response = await fetch(buildMobileApiUrl('/api/pool-swipe'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
      body: JSON.stringify({ movie_id: input.movie_id, direction: input.direction }),
    });
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
    const response = await fetch(buildMobileApiUrl(`/api/pool-quiz?${params.toString()}`), {
      headers: { Accept: 'application/json', ...(await buildAuthHeaders()) },
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const questions = Array.isArray(payload.questions)
      ? payload.questions.filter(isRecord).map((q) => ({
          id: normalizeText(q.id, 120),
          question: normalizeText(q.question, 400),
          options: Array.isArray(q.options)
            ? q.options
                .filter(isRecord)
                .map((o) => ({ key: normalizeText(o.key, 4) as PoolOptionKey, label: normalizeText(o.label, 240) }))
                .filter((o) => o.key && o.label)
            : [],
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
    const response = await fetch(buildMobileApiUrl('/api/pool-answer'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const progress = isRecord(payload.progress) ? payload.progress : {};
    return {
      ok: true,
      question_id: normalizeText(payload.question_id, 120),
      is_correct: payload.is_correct === true,
      correct_option: normalizeText(payload.correct_option, 4) as PoolOptionKey,
      explanation: normalizeText(payload.explanation, 400),
      xp_earned: Number(payload.xp_earned) || 0,
      bonus_xp: Number(payload.bonus_xp) || 0,
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

export const startRushSession = async (input: {
  mode: RushMode;
  language: PoolLanguageCode;
}): Promise<RushStartResponse> => {
  try {
    const response = await fetch(buildMobileApiUrl('/api/rush-start'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    const session = isRecord(payload.session) ? payload.session : payload;
    const questions = Array.isArray(session.questions)
      ? session.questions.filter(isRecord).map((q) => ({
          id: normalizeText(q.id, 120),
          question_id: normalizeText(q.question_id, 120),
          movie_title: normalizeText(q.movie_title, 200),
          question: normalizeText(q.question, 400),
          options: Array.isArray(q.options)
            ? q.options
                .filter(isRecord)
                .map((o) => ({ key: normalizeText(o.key, 4) as PoolOptionKey, label: normalizeText(o.label, 240) }))
                .filter((o) => o.key && o.label)
            : [],
        }))
      : [];
    return {
      ok: true,
      session: {
        id: normalizeText(session.id, 120),
        mode: input.mode,
        expires_at: normalizeText(session.expires_at, 80) || null,
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
    const response = await fetch(buildMobileApiUrl('/api/rush-answer'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload)) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      const expired = isRecord(payload) ? payload.expired === true : false;
      return { ok: false, error: err || `HTTP ${response.status}`, expired };
    }
    if (payload.ok !== true) {
      return { ok: false, error: normalizeText(payload.error, 240) || 'Answer failed.', expired: payload.expired === true };
    }
    return {
      ok: true,
      is_correct: payload.is_correct === true,
      correct_option: normalizeText(payload.correct_option, 4) as PoolOptionKey,
      explanation: normalizeText(payload.explanation, 400),
      streak: Number(payload.streak) || 0,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Rush answer failed.' };
  }
};

export const completeRushSession = async (input: {
  session_id: string;
}): Promise<RushCompleteResult> => {
  try {
    const response = await fetch(buildMobileApiUrl('/api/rush-complete'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await buildAuthHeaders()) },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }
    return {
      ok: true,
      total_answered: Number(payload.total_answered) || 0,
      total_correct: Number(payload.total_correct) || 0,
      xp_earned: Number(payload.xp_earned) || 0,
      mode: normalizeText(payload.mode, 20) as RushMode,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Rush complete failed.' };
  }
};

export const fetchSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
  try {
    const response = await fetch(buildMobileApiUrl('/api/subscription-status'), {
      headers: { Accept: 'application/json', ...(await buildAuthHeaders()) },
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (response.ok && isRecord(payload)) {
      return {
        tier: payload.tier === 'premium' ? 'premium' : 'free',
        daily_rush_limit: Number(payload.daily_rush_limit) || 3,
        daily_rush_used: Number(payload.daily_rush_used) || 0,
        show_ads: payload.show_ads !== false,
      };
    }
    return { tier: 'free', daily_rush_limit: 3, daily_rush_used: 0, show_ads: true };
  } catch {
    return { tier: 'free', daily_rush_limit: 3, daily_rush_used: 0, show_ads: true };
  }
};
