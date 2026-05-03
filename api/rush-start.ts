import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
import {
  buildRushSessionMetadata,
  readRushSelectionHistory,
  selectBalancedRushQuestions,
} from './lib/rushVariety.js';
import { resolveSubscriptionEntitlement } from './lib/subscriptionAccess.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

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

const RUSH_CONFIG = {
  rush_15: { questionCount: 15, timeLimitSeconds: 90 },
  rush_30: { questionCount: 30, timeLimitSeconds: 150 },
  endless: { questionCount: 50, timeLimitSeconds: null },
} as const;

const FREE_DAILY_RUSH_LIMIT = 3;
const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const rushPosterCache = new Map<string, string | null>();

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const isLikelyTmdbReadAccessToken = (value: string): boolean =>
  value.length > 40 || value.includes('.');

const getTmdbReadAccessToken = (): string => {
  const credential = String(
    process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.TMDB_API_READ_ACCESS_TOKEN ||
      process.env.TMDB_V4_ACCESS_TOKEN ||
      process.env.TMDB_API_KEY ||
      ''
  ).trim();

  return isLikelyTmdbReadAccessToken(credential) ? credential : '';
};

const buildPosterCacheKey = (tmdbMovieId: unknown, movieTitle: unknown): string => {
  const numericId = Number(tmdbMovieId);
  if (Number.isInteger(numericId) && numericId > 0) return `tmdb:${numericId}`;
  const title = String(movieTitle || '').trim().toLowerCase();
  return `title:${title}`;
};

const fetchRushPosterPath = async (tmdbMovieId: unknown, movieTitle: unknown): Promise<string | null> => {
  const cacheKey = buildPosterCacheKey(tmdbMovieId, movieTitle);
  if (rushPosterCache.has(cacheKey)) return rushPosterCache.get(cacheKey) || null;

  const readAccessToken = getTmdbReadAccessToken();
  if (!readAccessToken) {
    rushPosterCache.set(cacheKey, null);
    return null;
  }

  const numericId = Number(tmdbMovieId);
  if (Number.isInteger(numericId) && numericId > 0) {
    try {
      const detailUrl = new URL(`${TMDB_API_BASE}/movie/${numericId}`);
      detailUrl.search = new URLSearchParams({
        language: 'en-US',
      }).toString();
      const detailRes = await fetch(detailUrl.toString(), {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${readAccessToken}`,
        },
      });
      if (detailRes.ok) {
        const detail = await detailRes.json();
        if (typeof detail?.poster_path === 'string' && detail.poster_path) {
          rushPosterCache.set(cacheKey, detail.poster_path);
          return detail.poster_path;
        }
      }
    } catch {
      // noop: search fallback below
    }
  }

  const title = String(movieTitle || '').trim();
  if (title) {
    try {
      const searchUrl = new URL(`${TMDB_API_BASE}/search/movie`);
      searchUrl.search = new URLSearchParams({
        query: title,
        include_adult: 'false',
      }).toString();
      const searchRes = await fetch(searchUrl.toString(), {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${readAccessToken}`,
        },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const firstPath = searchData?.results?.[0]?.poster_path;
        if (typeof firstPath === 'string' && firstPath) {
          rushPosterCache.set(cacheKey, firstPath);
          return firstPath;
        }
      }
    } catch {
      // noop
    }
  }

  rushPosterCache.set(cacheKey, null);
  return null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const cors = createCorsHeaders(req, {
    headers: 'authorization, content-type, apikey, x-client-info',
    methods: 'POST, OPTIONS',
  });

  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

  const accessToken = getBearerToken(req);
  if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);
  }

  const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

  const body = await parseBody(req);
  const payload =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const mode = String(payload.mode || '').trim() as keyof typeof RUSH_CONFIG;
  const language = String(payload.language || payload.lang || 'tr').trim();
  const rewardUnlock =
    payload.reward_unlock === true ||
    payload.rewarded_unlock === true ||
    payload.unlock_via_rewarded_ad === true;

  if (!(mode in RUSH_CONFIG)) {
    return sendJson(res, 400, {
      ok: false,
      error: 'Invalid mode. Must be "rush_15", "rush_30", or "endless".',
    }, cors);
  }

  const config = RUSH_CONFIG[mode];

  const parallelStart = Date.now();
  const [subscriptionResult, profileResult, recentSessionsResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('quiz_rush_sessions')
      .select('metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4),
  ]);
  console.log(`[rush-start] parallel-prefetch took ${Date.now() - parallelStart}ms`);
  const subscription = subscriptionResult.data;
  const profile = profileResult.data;
  const recentSessions = recentSessionsResult.data;

  const { isPremium } = resolveSubscriptionEntitlement({
    subscriptionPlan: subscription?.plan,
    subscriptionStatus: subscription?.status,
    profileTier: profile?.subscription_tier,
  });

  if (!isPremium && mode === 'endless') {
    return sendJson(res, 403, {
      ok: false,
      error: 'Endless mode requires a premium subscription.',
      requiresSubscription: true,
    }, cors);
  }

  if (!isPremium && !rewardUnlock) {
    const { data: dailyCount } = await supabase
      .rpc('get_daily_rush_count_by_mode', { p_user_id: user.id, p_mode: mode });

    if ((Number(dailyCount) || 0) >= FREE_DAILY_RUSH_LIMIT) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Daily rush limit reached.',
        limitReached: true,
        requiresSubscription: true,
        rewardedAdAvailable: true,
        dailyLimit: FREE_DAILY_RUSH_LIMIT,
        mode,
      }, cors);
    }
  }

  const { data: allQuestions, error: questionsError } = await supabase
    .from('question_pool_questions')
    .select(`
      id,
      tmdb_movie_id,
      question_order,
      question_translations,
      options_translations,
      difficulty,
      question_pool_movies!inner (id, title, poster_path, genre, release_year)
    `)
    .limit(Math.min(config.questionCount * 18, 480));

  if (questionsError || !allQuestions || allQuestions.length === 0) {
    return sendJson(res, 503, { ok: false, error: 'Not enough questions available.' }, cors);
  }

  const selectedQuestions = selectBalancedRushQuestions(
    allQuestions,
    config.questionCount,
    readRushSelectionHistory(recentSessions || []),
  );
  if (!selectedQuestions.length) {
    return sendJson(res, 503, { ok: false, error: 'Not enough diversified questions available.' }, cors);
  }
  const validLanguage = ['tr', 'en', 'es', 'fr'].includes(language) ? language : 'tr';

  const missingPosterMovies = Array.from(new Map(
    selectedQuestions
      .map((question) => {
        const movie = question.question_pool_movies as unknown as {
          id: string;
          title: string;
          poster_path: string | null;
        };
        if (movie?.poster_path) return null;
        const movieKey = movie?.id || buildPosterCacheKey(question.tmdb_movie_id, movie?.title);
        return {
          movieKey,
          movieId: movie?.id || '',
          tmdbMovieId: question.tmdb_movie_id,
          title: movie?.title || '',
        };
      })
      .filter((entry): entry is { movieKey: string; movieId: string; tmdbMovieId: unknown; title: string } => Boolean(entry))
      .map((entry) => [entry.movieKey, entry]),
  ).values());

  const fallbackPosterMap = new Map<string, string | null>();
  await Promise.all(missingPosterMovies.map(async (entry) => {
    const posterPath = await fetchRushPosterPath(entry.tmdbMovieId, entry.title);
    fallbackPosterMap.set(entry.movieKey, posterPath);
    if (posterPath && entry.movieId) {
      await supabase
        .from('question_pool_movies')
        .update({ poster_path: posterPath })
        .eq('id', entry.movieId);
    }
  }));

  const now = new Date();
  const expiresAt = config.timeLimitSeconds
    ? new Date(now.getTime() + config.timeLimitSeconds * 1000).toISOString()
    : null;

  const { data: session, error: sessionError } = await supabase
    .from('quiz_rush_sessions')
    .insert({
      user_id: user.id,
      mode,
      total_questions: selectedQuestions.length,
      correct_count: 0,
      wrong_count: 0,
      time_limit_seconds: config.timeLimitSeconds,
      xp_earned: 0,
      status: 'in_progress',
      started_at: now.toISOString(),
      expires_at: expiresAt,
      metadata: buildRushSessionMetadata(selectedQuestions),
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    return sendJson(res, 500, { ok: false, error: 'Failed to create session.' }, cors);
  }

  const questions = selectedQuestions.map((question) => {
    const translations = question.question_translations as Record<string, string>;
    const optionsTranslations = question.options_translations as Record<string, Record<string, string>>;
    const movie = question.question_pool_movies as unknown as {
      id: string;
      title: string;
      poster_path: string | null;
      genre: string | null;
    };
    const movieKey = movie?.id || buildPosterCacheKey(question.tmdb_movie_id, movie?.title);
    const posterPath = movie?.poster_path || fallbackPosterMap.get(movieKey) || null;

    const options = ['a', 'b', 'c', 'd'].map((key) => ({
      key,
      label:
        optionsTranslations[key]?.[validLanguage] ||
        optionsTranslations[key]?.tr ||
        optionsTranslations[key]?.en ||
        '',
    }));

    return {
      id: question.id,
      question_id: question.id,
      movie_title: movie?.title || '',
      movieTitle: movie?.title || '',
      movie_poster_path: posterPath,
      moviePosterPath: posterPath,
      movieGenre: movie?.genre || null,
      question:
        translations[validLanguage] ||
        translations.tr ||
        translations.en ||
        '',
      options,
      difficulty: question.difficulty,
    };
  });

  const responseSession = {
    id: session.id,
    mode,
    total_questions: selectedQuestions.length,
    time_limit_seconds: config.timeLimitSeconds,
    total_time_seconds: config.timeLimitSeconds,
    started_at: now.toISOString(),
    expires_at: expiresAt,
    questions,
  };

  return sendJson(res, 200, {
    ok: true,
    sessionId: session.id,
    mode,
    totalQuestions: selectedQuestions.length,
    timeLimitSeconds: config.timeLimitSeconds,
    totalTimeSeconds: config.timeLimitSeconds,
    startedAt: now.toISOString(),
    expiresAt,
    questions,
    session: responseSession,
  }, cors);
}
