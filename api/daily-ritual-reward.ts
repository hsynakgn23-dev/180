import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import {
  DAILY_COMMENT_MIN_CHARACTERS,
  DAILY_COMMENT_MIN_WORDS,
  getDailyCommentReward,
  isRewardableDailyCommentText,
  normalizeProgressionMovieKey,
} from '../src/domain/progressionRewards.js';
import {
  applyProgressionReward,
  loadProgressionProfile,
  readDailyCommentRewardTracker,
} from './lib/progressionProfile.js';

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

type DailyShowcaseMovie = {
  title?: unknown;
  movieTitle?: unknown;
  movie_title?: unknown;
};

const DAILY_ROLLOVER_TIMEZONE = 'Europe/Istanbul';

const normalizeText = (value: unknown, maxLength = 400): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const getDateKeyFromFormatter = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_ROLLOVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
};

const readDailyShowcaseTitles = async (
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  dateKey: string
): Promise<string[]> => {
  const { data } = await supabase
    .from('daily_showcase')
    .select('movies')
    .eq('date', dateKey)
    .maybeSingle();

  const rows = Array.isArray((data as { movies?: unknown } | null)?.movies)
    ? (((data as { movies?: unknown }).movies as unknown[]) || [])
    : [];

  return rows
    .map((movie) => {
      const record = (movie || {}) as DailyShowcaseMovie;
      return normalizeText(record.title || record.movieTitle || record.movie_title, 220);
    })
    .filter(Boolean)
    .slice(0, 12);
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
  const bodyObj = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const movieTitle = normalizeText(bodyObj.movieTitle, 220);
  const text = normalizeText(bodyObj.text, 1200);
  const createdAtRaw = normalizeText(bodyObj.createdAt, 80);
  const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date();
  const dateKey = getDateKeyFromFormatter(Number.isNaN(createdAt.getTime()) ? new Date() : createdAt);

  if (!movieTitle || !text) {
    return sendJson(res, 400, { ok: false, error: 'movieTitle and text are required.' }, cors);
  }

  const showcaseTitles = await readDailyShowcaseTitles(supabase, dateKey);
  const matchingTitle =
    showcaseTitles.find((title) => normalizeProgressionMovieKey(title) === normalizeProgressionMovieKey(movieTitle)) ||
    null;

  if (!matchingTitle) {
    return sendJson(res, 200, {
      ok: true,
      rewarded: false,
      reason: 'not_daily_movie',
      message: 'Comment saved, but this title is not part of today\'s five films.',
    }, cors);
  }

  if (!isRewardableDailyCommentText(text)) {
    return sendJson(res, 200, {
      ok: true,
      rewarded: false,
      reason: 'quality_threshold',
      message: `Comment saved. Reward unlocks at ${DAILY_COMMENT_MIN_CHARACTERS}+ chars and ${DAILY_COMMENT_MIN_WORDS}+ words.`,
      thresholds: {
        minCharacters: DAILY_COMMENT_MIN_CHARACTERS,
        minWords: DAILY_COMMENT_MIN_WORDS,
      },
    }, cors);
  }

  const loaded = await loadProgressionProfile({
    supabase,
    userId: user.id,
    fallbackEmail: user.email || null,
    fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
  });
  const rewardTracker = readDailyCommentRewardTracker(loaded.xpState, dateKey);
  const rewardResult = getDailyCommentReward(rewardTracker, matchingTitle);

  if (!rewardResult.ok) {
    return sendJson(res, 200, {
      ok: true,
      rewarded: false,
      reason: rewardResult.reason,
      message: 'The first qualifying comment for this daily film was already rewarded.',
    }, cors);
  }

  const applied = await applyProgressionReward({
    supabase,
    userId: user.id,
    fallbackEmail: user.email || null,
    fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
    loaded,
    reward: rewardResult.reward,
    markActiveDateKey: dateKey,
    dailyCommentRewardState: rewardResult.nextState,
    dailyRitualEntry: {
      date: dateKey,
      movieTitle: matchingTitle,
      text,
    },
    isCommentReward: true,
    ledger: {
      source: 'daily_comment_reward',
      sourceId: `${dateKey}:${normalizeProgressionMovieKey(matchingTitle)}`,
      reason: 'daily_ritual_reward',
      metadata: {
        dateKey,
        movieTitle: matchingTitle,
        completionBonusAwarded: rewardResult.completionBonusAwarded,
      },
    },
  });

  return sendJson(res, 200, {
    ok: true,
    rewarded: true,
    completionBonusAwarded: rewardResult.completionBonusAwarded,
    xpEarned: rewardResult.reward.xp,
    ticketsEarned: rewardResult.reward.tickets,
    arenaScoreEarned: rewardResult.reward.arenaScore,
    streak: applied.streak,
    totalXP: applied.totalXP,
    weeklyArenaScore: applied.weeklyArena.score,
  }, cors);
}
