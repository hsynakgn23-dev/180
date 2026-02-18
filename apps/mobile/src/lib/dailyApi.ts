import AsyncStorage from '@react-native-async-storage/async-storage';

type DailyMovie = {
  id: number;
  title: string;
  voteAverage: number | null;
  genre: string | null;
};

type DailyResponse = {
  ok: boolean;
  date?: string;
  source?: string;
  movies?: unknown[];
  error?: string;
};

type DailyCacheRecord = {
  endpoint: string;
  cachedAt: string;
  date: string | null;
  source: string | null;
  movies: DailyMovie[];
};

const ANALYTICS_ENDPOINT = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT || '';
const DAILY_ENDPOINT = process.env.EXPO_PUBLIC_DAILY_API_URL || '';
const DAILY_CACHE_KEY = '180_mobile_daily_cache_v1';
const DAILY_CACHE_MAX_AGE_MS = 18 * 60 * 60 * 1000;

const normalizeText = (value: unknown, maxLength = 200): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeMovie = (raw: unknown, index: number): DailyMovie | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const movie = raw as Record<string, unknown>;
  const title = normalizeText(movie.title || movie.movieTitle || movie.movie_title, 180);
  if (!title) return null;

  const id = normalizeNumber(movie.id);
  return {
    id: id ?? index + 1,
    title,
    voteAverage: normalizeNumber(movie.voteAverage ?? movie.vote_average),
    genre: normalizeText(movie.genre, 120) || null,
  };
};

const resolveDailyEndpoint = (): string => {
  const direct = normalizeText(DAILY_ENDPOINT, 500);
  if (direct) return direct;

  const analytics = normalizeText(ANALYTICS_ENDPOINT, 500);
  if (!analytics) return '';

  if (analytics.endsWith('/api/analytics')) {
    return `${analytics.slice(0, -'/api/analytics'.length)}/api/daily`;
  }
  return '';
};

const withTimeout = async (promise: Promise<Response>, timeoutMs = 8000): Promise<Response> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<Response>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Daily API timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const sanitizeCachedMovies = (value: unknown): DailyMovie[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((movie, index) => normalizeMovie(movie, index))
    .filter((movie): movie is DailyMovie => Boolean(movie))
    .slice(0, 20);
};

const parseDailyCache = (raw: string): DailyCacheRecord | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const endpoint = normalizeText(parsed.endpoint, 500);
    const cachedAt = normalizeText(parsed.cachedAt, 80);
    const date = normalizeText(parsed.date, 40) || null;
    const source = normalizeText(parsed.source, 40) || null;
    const movies = sanitizeCachedMovies(parsed.movies);
    if (!cachedAt || movies.length === 0) return null;

    return {
      endpoint,
      cachedAt,
      date,
      source,
      movies,
    };
  } catch {
    return null;
  }
};

const getCacheAgeMs = (cachedAt: string): number => {
  const timestamp = Date.parse(cachedAt);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - timestamp);
};

const readDailyCache = async (): Promise<(DailyCacheRecord & { ageSeconds: number; stale: boolean }) | null> => {
  try {
    const raw = await AsyncStorage.getItem(DAILY_CACHE_KEY);
    if (!raw) return null;

    const parsed = parseDailyCache(raw);
    if (!parsed) return null;

    const ageMs = getCacheAgeMs(parsed.cachedAt);
    const ageSeconds = Number.isFinite(ageMs) ? Math.floor(ageMs / 1000) : -1;
    return {
      ...parsed,
      ageSeconds,
      stale: !Number.isFinite(ageMs) || ageMs > DAILY_CACHE_MAX_AGE_MS,
    };
  } catch {
    return null;
  }
};

const writeDailyCache = async (record: DailyCacheRecord): Promise<void> => {
  try {
    await AsyncStorage.setItem(DAILY_CACHE_KEY, JSON.stringify(record));
  } catch {
    // best-effort cache write
  }
};

export const fetchDailyMovies = async (): Promise<{
  ok: boolean;
  endpoint: string;
  date: string | null;
  source: string | null;
  movies: DailyMovie[];
  error: string | null;
  dataSource: 'live' | 'cache';
  cacheAgeSeconds: number | null;
  stale: boolean;
  warning: string | null;
}> => {
  const endpoint = resolveDailyEndpoint();
  if (!endpoint) {
    const cached = await readDailyCache();
    if (cached) {
      return {
        ok: true,
        endpoint: cached.endpoint,
        date: cached.date,
        source: cached.source,
        movies: cached.movies,
        error: null,
        dataSource: 'cache',
        cacheAgeSeconds: cached.ageSeconds >= 0 ? cached.ageSeconds : null,
        stale: true,
        warning: 'Missing EXPO_PUBLIC_DAILY_API_URL (or derivable analytics endpoint).',
      };
    }

    return {
      ok: false,
      endpoint: '',
      date: null,
      source: null,
      movies: [],
      error: 'Missing EXPO_PUBLIC_DAILY_API_URL (or derivable analytics endpoint).',
      dataSource: 'live',
      cacheAgeSeconds: null,
      stale: true,
      warning: null,
    };
  }

  try {
    const response = await withTimeout(fetch(endpoint));
    const payload = (await response.json()) as DailyResponse;
    const rawMovies = Array.isArray(payload.movies) ? payload.movies : [];
    const movies = rawMovies
      .map((movie, index) => normalizeMovie(movie, index))
      .filter((movie): movie is DailyMovie => Boolean(movie));

    if (!response.ok || !payload.ok) {
      const liveError = normalizeText(payload.error, 200) || `HTTP ${response.status}`;
      const cached = await readDailyCache();
      if (cached) {
        return {
          ok: true,
          endpoint,
          date: cached.date,
          source: cached.source,
          movies: cached.movies,
          error: null,
          dataSource: 'cache',
          cacheAgeSeconds: cached.ageSeconds >= 0 ? cached.ageSeconds : null,
          stale: cached.stale,
          warning: liveError,
        };
      }

      return {
        ok: false,
        endpoint,
        date: normalizeText(payload.date, 40) || null,
        source: normalizeText(payload.source, 40) || null,
        movies: [],
        error: liveError,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: true,
        warning: null,
      };
    }

    await writeDailyCache({
      endpoint,
      cachedAt: new Date().toISOString(),
      date: normalizeText(payload.date, 40) || null,
      source: normalizeText(payload.source, 40) || null,
      movies,
    });

    return {
      ok: true,
      endpoint,
      date: normalizeText(payload.date, 40) || null,
      source: normalizeText(payload.source, 40) || null,
      movies,
      error: null,
      dataSource: 'live',
      cacheAgeSeconds: null,
      stale: false,
      warning: null,
    };
  } catch (error) {
    const liveError = error instanceof Error ? error.message : 'Daily API request failed';
    const cached = await readDailyCache();
    if (cached) {
      return {
        ok: true,
        endpoint,
        date: cached.date,
        source: cached.source,
        movies: cached.movies,
        error: null,
        dataSource: 'cache',
        cacheAgeSeconds: cached.ageSeconds >= 0 ? cached.ageSeconds : null,
        stale: cached.stale,
        warning: liveError,
      };
    }

    return {
      ok: false,
      endpoint,
      date: null,
      source: null,
      movies: [],
      error: liveError,
      dataSource: 'live',
      cacheAgeSeconds: null,
      stale: true,
      warning: null,
    };
  }
};
