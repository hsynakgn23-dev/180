import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveMobileDailyApiUrl, resolveMobileWebBaseUrl } from './mobileEnv';
import { fetchWithTimeout, runWithAbortTimeout } from './network';
import { isSupabaseLive, supabase } from './supabase';

type DailyMovie = {
  id: number;
  title: string;
  voteAverage: number | null;
  genre: string | null;
  year: number | null;
  director: string | null;
  overview: string | null;
  posterPath: string | null;
  cast: string[];
  originalLanguage: string | null;
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

type DailyShowcaseRow = {
  date?: string | null;
  source?: string | null;
  movies?: unknown;
};

const DAILY_CACHE_KEY = '180_mobile_daily_cache_v3';
const DAILY_CACHE_MAX_AGE_MS = 18 * 60 * 60 * 1000;
const DAILY_ROLLOVER_TIMEZONE = 'Europe/Istanbul';
const DAILY_SUPABASE_TIMEOUT_MS = 10000;
const PUBLIC_SUPABASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const PUBLIC_SUPABASE_ANON_KEY = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const normalizeText = (value: unknown, maxLength = 200): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeStringList = (value: unknown, maxItems = 8, maxLength = 80): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeText(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
};

const getDateKeyFromParts = (value = new Date(), timeZone?: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value || '';
    const month = parts.find((part) => part.type === 'month')?.value || '';
    const day = parts.find((part) => part.type === 'day')?.value || '';
    if (!year || !month || !day) return '';
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

const getLocalDateKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDailyDateKey = (): string =>
  getDateKeyFromParts(new Date(), DAILY_ROLLOVER_TIMEZONE) || getLocalDateKey();

const isBrowserLoopbackOrigin = (): boolean => {
  const maybeLocation = (globalThis as { location?: { hostname?: string } }).location;
  const hostname = String(maybeLocation?.hostname || '').trim().toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

const normalizeEndpointForComparison = (value: unknown): string => {
  const text = normalizeText(value, 1200);
  if (!text) return '';
  try {
    const parsed = new URL(text);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    const [withoutQuery] = text.split(/[?#]/, 1);
    return String(withoutQuery || '').trim().replace(/\/+$/, '');
  }
};

const buildDailyRequestUrl = (endpoint: string, dateKey: string): string => {
  const normalizedEndpoint = normalizeText(endpoint, 1200);
  if (!normalizedEndpoint) return '';
  const normalizedDateKey = normalizeText(dateKey, 40);
  if (!normalizedDateKey) return normalizedEndpoint;

  try {
    const parsed = new URL(normalizedEndpoint);
    parsed.searchParams.set('date', normalizedDateKey);
    parsed.searchParams.set('_', String(Date.now()));
    return parsed.toString();
  } catch {
    const separator = normalizedEndpoint.includes('?') ? '&' : '?';
    return `${normalizedEndpoint}${separator}date=${encodeURIComponent(normalizedDateKey)}&_=${Date.now()}`;
  }
};

const summarizeUnexpectedBody = (rawBody: string): string => {
  const compact = String(rawBody || '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'bos cevap';
  return compact.slice(0, 72);
};

const readDailyResponsePayload = async (
  response: Response
): Promise<{ payload: DailyResponse | null; error: string | null }> => {
  const rawBody = await response.text();
  const trimmedBody = String(rawBody || '').trim();
  if (!trimmedBody) {
    return {
      payload: null,
      error: 'Daily servisi bos cevap dondurdu.',
    };
  }

  try {
    return {
      payload: JSON.parse(trimmedBody) as DailyResponse,
      error: null,
    };
  } catch {
    const contentType = normalizeText(response.headers.get('content-type'), 160).toLowerCase();
    const looksLikeHtml =
      trimmedBody.startsWith('<!doctype') || trimmedBody.startsWith('<html') || contentType.includes('text/html');
    const looksLikeJavascript =
      trimmedBody.startsWith('import ') ||
      trimmedBody.startsWith('export ') ||
      contentType.includes('javascript');
    const responseKind = looksLikeHtml ? 'HTML' : looksLikeJavascript ? 'JavaScript' : 'JSON disi veri';
    const preview = summarizeUnexpectedBody(trimmedBody);

    return {
      payload: null,
      error: `Daily servisi JSON yerine ${responseKind} dondurdu. Onizleme: ${preview}`,
    };
  }
};

const resolveMatchingCachedDaily = (
  cached: (DailyCacheRecord & { ageSeconds: number; stale: boolean }) | null,
  expectedDateKey: string
): (DailyCacheRecord & { ageSeconds: number; stale: boolean }) | null => {
  if (!cached) return null;
  const normalizedExpectedDate = normalizeText(expectedDateKey, 40);
  const normalizedCachedDate = normalizeText(cached.date, 40);
  if (!normalizedExpectedDate || !normalizedCachedDate) return null;
  return normalizedCachedDate === normalizedExpectedDate ? cached : null;
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
    year: normalizeNumber(movie.year),
    director: normalizeText(movie.director, 120) || null,
    overview: normalizeText(movie.overview, 600) || null,
    posterPath:
      normalizeText(
        movie.posterPath ??
          movie.poster_path ??
          movie.posterStoragePath ??
          movie.poster_storage_path ??
          movie.posterThumbPath ??
          movie.poster_thumb_path ??
          movie.posterURL ??
          movie.poster_url,
        400
      ) || null,
    cast: normalizeStringList(movie.cast, 8, 80),
    originalLanguage: normalizeText(movie.originalLanguage ?? movie.original_language, 24) || null,
  };
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

const readDailyFromSupabase = async (
  preferredDateKey?: string | null
): Promise<{
  ok: boolean;
  date: string | null;
  source: string | null;
  movies: DailyMovie[];
  warning: string | null;
}> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      date: null,
      source: null,
      movies: [],
      warning: null,
    };
  }

  const targetDate = normalizeText(preferredDateKey, 40) || getDailyDateKey();
  const fetchPublicRows = async (query: string): Promise<DailyShowcaseRow[] | null> => {
    if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) return null;
    try {
      const response = await fetchWithTimeout({
        url: `${PUBLIC_SUPABASE_URL}/rest/v1/daily_showcase?${query}`,
        timeoutMs: 8000,
        timeoutMessage: 'Daily public Supabase timeout',
        init: {
          headers: {
            apikey: PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
          },
        },
      });
      if (!response.ok) return null;
      const rows = (await response.json().catch(() => [])) as unknown;
      return Array.isArray(rows) ? (rows as DailyShowcaseRow[]) : null;
    } catch {
      return null;
    }
  };
  const parseRow = (
    row: DailyShowcaseRow | null | undefined
  ): { date: string | null; source: string | null; movies: DailyMovie[] } | null => {
    if (!row) return null;
    const rawMovies = Array.isArray(row.movies) ? row.movies : [];
    const movies = rawMovies
      .map((movie, index) => normalizeMovie(movie, index))
      .filter((movie): movie is DailyMovie => Boolean(movie))
      .slice(0, 20);
    if (movies.length === 0) return null;
    return {
      date: normalizeText(row.date, 40) || targetDate || null,
      source: normalizeText(row.source, 40) || 'supabase_daily_showcase',
      movies,
    };
  };

  const publicByDateRows = await fetchPublicRows(
    `select=date,movies&date=eq.${encodeURIComponent(targetDate)}&limit=1`
  );
  const publicByDate = parseRow(Array.isArray(publicByDateRows) ? publicByDateRows[0] || null : null);
  if (publicByDate) {
    return {
      ok: true,
      date: publicByDate.date,
      source: publicByDate.source,
      movies: publicByDate.movies,
      warning: null,
    };
  }

  const publicLatestRows = await fetchPublicRows('select=date,movies&order=date.desc&limit=1');
  const publicLatest = parseRow(Array.isArray(publicLatestRows) ? publicLatestRows[0] || null : null);
  if (publicLatest) {
    return {
      ok: true,
      date: publicLatest.date,
      source: publicLatest.source,
      movies: publicLatest.movies,
      warning: publicLatest.date && publicLatest.date !== targetDate ? 'Supabase latest daily used.' : null,
    };
  }

  const supabaseClient = isSupabaseLive() ? supabase : null;
  if (supabaseClient) {
    try {
      const byDateResult = await runWithAbortTimeout({
        timeoutMs: DAILY_SUPABASE_TIMEOUT_MS,
        timeoutMessage: 'Daily Supabase timeout',
        task: async (signal) =>
          await supabaseClient
            .from('daily_showcase')
            .select('date,movies')
            .abortSignal(signal)
            .eq('date', targetDate)
            .maybeSingle(),
      });
      const parsed = parseRow((byDateResult.data || null) as DailyShowcaseRow | null);
      if (parsed) {
        return {
          ok: true,
          date: parsed.date,
          source: parsed.source,
          movies: parsed.movies,
          warning: null,
        };
      }
    } catch {
      // continue to latest fallback
    }

    try {
      const latestResult = await runWithAbortTimeout({
        timeoutMs: DAILY_SUPABASE_TIMEOUT_MS,
        timeoutMessage: 'Daily Supabase timeout',
        task: async (signal) =>
          await supabaseClient
            .from('daily_showcase')
            .select('date,movies')
            .abortSignal(signal)
            .order('date', { ascending: false })
            .limit(1),
      });
      const latestRow =
        Array.isArray(latestResult.data) && latestResult.data.length > 0
          ? ((latestResult.data[0] || null) as DailyShowcaseRow | null)
          : null;
      const latest = parseRow(latestRow);
      if (latest) {
        return {
          ok: true,
          date: latest.date,
          source: latest.source,
          movies: latest.movies,
          warning: latest.date && latest.date !== targetDate ? 'Supabase latest daily used.' : null,
        };
      }
    } catch {
      // no-op
    }
  }

  return {
    ok: false,
    date: null,
    source: null,
    movies: [],
    warning: null,
  };
};

const readDailyFromWebApi = async (
  preferredDateKey?: string | null,
  excludeEndpoint?: string | null
): Promise<{
  ok: boolean;
  endpoint: string;
  date: string | null;
  source: string | null;
  movies: DailyMovie[];
}> => {
  const webBase = resolveMobileWebBaseUrl();
  if (!webBase) {
    return {
      ok: false,
      endpoint: '',
      date: null,
      source: null,
      movies: [],
    };
  }

  const normalizedExclude = normalizeEndpointForComparison(excludeEndpoint);
  const dateKey = normalizeText(preferredDateKey, 40) || getDailyDateKey();
  const webEndpoint = `${webBase}/api/daily?date=${encodeURIComponent(dateKey)}&_=${Date.now()}`;
  if (normalizeEndpointForComparison(webEndpoint) === normalizedExclude) {
    return {
      ok: false,
      endpoint: webEndpoint,
      date: null,
      source: null,
      movies: [],
    };
  }

  try {
    const response = await fetchWithTimeout({
      url: webEndpoint,
      timeoutMs: 8000,
      timeoutMessage: 'Daily web API timeout',
    });
    const parsed = await readDailyResponsePayload(response);
    if (!parsed.payload) {
      return {
        ok: false,
        endpoint: webEndpoint,
        date: null,
        source: null,
        movies: [],
      };
    }
    const payload = parsed.payload;
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        endpoint: webEndpoint,
        date: normalizeText(payload.date, 40) || null,
        source: normalizeText(payload.source, 40) || null,
        movies: [],
      };
    }

    const rawMovies = Array.isArray(payload.movies) ? payload.movies : [];
    const movies = rawMovies
      .map((movie, index) => normalizeMovie(movie, index))
      .filter((movie): movie is DailyMovie => Boolean(movie))
      .slice(0, 20);
    if (movies.length === 0) {
      return {
        ok: false,
        endpoint: webEndpoint,
        date: normalizeText(payload.date, 40) || null,
        source: normalizeText(payload.source, 40) || null,
        movies: [],
      };
    }

    return {
      ok: true,
      endpoint: webEndpoint,
      date: normalizeText(payload.date, 40) || null,
      source: normalizeText(payload.source, 40) || null,
      movies,
    };
  } catch {
    return {
      ok: false,
      endpoint: webEndpoint,
      date: null,
      source: null,
      movies: [],
    };
  }
};

const readDailyFromWebApiLatest = async (
  excludeEndpoint?: string | null
): Promise<{
  ok: boolean;
  endpoint: string;
  date: string | null;
  source: string | null;
  movies: DailyMovie[];
}> => {
  const webBase = resolveMobileWebBaseUrl();
  if (!webBase) {
    return {
      ok: false,
      endpoint: '',
      date: null,
      source: null,
      movies: [],
    };
  }

  const normalizedExclude = normalizeEndpointForComparison(excludeEndpoint);
  const webEndpoint = `${webBase}/api/daily?_=${Date.now()}`;
  if (normalizeEndpointForComparison(webEndpoint) === normalizedExclude) {
    return {
      ok: false,
      endpoint: webEndpoint,
      date: null,
      source: null,
      movies: [],
    };
  }

  try {
    const response = await fetchWithTimeout({
      url: webEndpoint,
      timeoutMs: 8000,
      timeoutMessage: 'Daily web API timeout',
    });
    const parsed = await readDailyResponsePayload(response);
    if (!parsed.payload) {
      return {
        ok: false,
        endpoint: webEndpoint,
        date: null,
        source: null,
        movies: [],
      };
    }
    const payload = parsed.payload;
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        endpoint: webEndpoint,
        date: normalizeText(payload.date, 40) || null,
        source: normalizeText(payload.source, 40) || null,
        movies: [],
      };
    }

    const rawMovies = Array.isArray(payload.movies) ? payload.movies : [];
    const movies = rawMovies
      .map((movie, index) => normalizeMovie(movie, index))
      .filter((movie): movie is DailyMovie => Boolean(movie))
      .slice(0, 20);
    if (movies.length === 0) {
      return {
        ok: false,
        endpoint: webEndpoint,
        date: normalizeText(payload.date, 40) || null,
        source: normalizeText(payload.source, 40) || null,
        movies: [],
      };
    }

    return {
      ok: true,
      endpoint: webEndpoint,
      date: normalizeText(payload.date, 40) || null,
      source: normalizeText(payload.source, 40) || null,
      movies,
    };
  } catch {
    return {
      ok: false,
      endpoint: webEndpoint,
      date: null,
      source: null,
      movies: [],
    };
  }
};

export const fetchDailyMovies = async (): Promise<{
  ok: boolean;
  endpoint: string;
  date: string | null;
  source: string | null;
  movies: DailyMovie[];
  error: string | null;
  dataSource: 'live' | 'cache' | 'fallback';
  cacheAgeSeconds: number | null;
  stale: boolean;
  warning: string | null;
}> => {
  const endpoint = resolveMobileDailyApiUrl();
  const targetDateKey = getDailyDateKey();
  const shouldBypassWebDailyApi = isBrowserLoopbackOrigin();

  if (shouldBypassWebDailyApi) {
    const supabaseDaily = await readDailyFromSupabase(targetDateKey);
    if (supabaseDaily.ok) {
      return {
        ok: true,
        endpoint: 'supabase://daily_showcase',
        date: supabaseDaily.date,
        source: supabaseDaily.source,
        movies: supabaseDaily.movies,
        error: null,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: false,
        warning: supabaseDaily.warning,
      };
    }

    const cached = await readDailyCache();
    const matchingCached = resolveMatchingCachedDaily(cached, targetDateKey);
    if (matchingCached) {
      return {
        ok: true,
        endpoint: matchingCached.endpoint,
        date: matchingCached.date,
        source: matchingCached.source,
        movies: matchingCached.movies,
        error: null,
        dataSource: 'cache',
        cacheAgeSeconds: matchingCached.ageSeconds >= 0 ? matchingCached.ageSeconds : null,
        stale: matchingCached.stale,
        warning: 'Canli gunluk veri okunamadi; tarih eslesen onbellek gosteriliyor.',
      };
    }
  }

  if (!endpoint) {
    const supabaseDaily = await readDailyFromSupabase();
    if (supabaseDaily.ok) {
      return {
        ok: true,
        endpoint: 'supabase://daily_showcase',
        date: supabaseDaily.date,
        source: supabaseDaily.source,
        movies: supabaseDaily.movies,
        error: null,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: false,
        warning: supabaseDaily.warning || 'Daily API endpoint missing; Supabase source used.',
      };
    }

    const webDaily = await readDailyFromWebApi();
    if (webDaily.ok) {
      return {
        ok: true,
        endpoint: webDaily.endpoint,
        date: webDaily.date,
        source: webDaily.source,
        movies: webDaily.movies,
        error: null,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: false,
        warning: 'Daily API endpoint missing; web API source used.',
      };
    }

    const webLatestDaily = await readDailyFromWebApiLatest();
    if (webLatestDaily.ok) {
      return {
        ok: true,
        endpoint: webLatestDaily.endpoint,
        date: webLatestDaily.date,
        source: webLatestDaily.source,
        movies: webLatestDaily.movies,
        error: null,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: false,
        warning: 'Daily API endpoint missing; web latest source used.',
      };
    }

    const cached = await readDailyCache();
    const matchingCached = resolveMatchingCachedDaily(cached, targetDateKey);
    if (matchingCached) {
      return {
        ok: true,
        endpoint: matchingCached.endpoint,
        date: matchingCached.date,
        source: matchingCached.source,
        movies: matchingCached.movies,
        error: null,
        dataSource: 'cache',
        cacheAgeSeconds: matchingCached.ageSeconds >= 0 ? matchingCached.ageSeconds : null,
        stale: true,
        warning: 'Missing EXPO_PUBLIC_DAILY_API_URL (or derivable analytics endpoint).',
      };
    }
    return {
      ok: false,
      endpoint: '',
      date: targetDateKey,
      source: null,
      movies: [],
      error: 'Gunluk filmler su an yuklenemedi. Tekrar dene.',
      dataSource: 'live',
      cacheAgeSeconds: null,
      stale: true,
      warning: null,
    };
  }

  const requestEndpoint = buildDailyRequestUrl(endpoint, targetDateKey);

  try {
    const response = await fetchWithTimeout({
      url: requestEndpoint || endpoint,
      timeoutMs: 8000,
      timeoutMessage: 'Daily API timeout',
    });
    const parsed = await readDailyResponsePayload(response);
    if (!parsed.payload) {
      const liveError = parsed.error || 'Daily servisi gecersiz cevap dondurdu.';
      const supabaseDaily = await readDailyFromSupabase(targetDateKey);
      if (supabaseDaily.ok) {
        return {
          ok: true,
          endpoint: requestEndpoint || endpoint,
          date: supabaseDaily.date,
          source: supabaseDaily.source,
          movies: supabaseDaily.movies,
          error: null,
          dataSource: 'live',
          cacheAgeSeconds: null,
          stale: false,
          warning: liveError,
        };
      }

      const webDaily = await readDailyFromWebApi(undefined, endpoint);
      if (webDaily.ok) {
        return {
          ok: true,
          endpoint: webDaily.endpoint,
          date: webDaily.date,
          source: webDaily.source,
          movies: webDaily.movies,
          error: null,
          dataSource: 'live',
          cacheAgeSeconds: null,
          stale: false,
          warning: liveError,
        };
      }

      const webLatestDaily = await readDailyFromWebApiLatest(endpoint);
      if (webLatestDaily.ok) {
        return {
          ok: true,
          endpoint: webLatestDaily.endpoint,
          date: webLatestDaily.date,
          source: webLatestDaily.source,
          movies: webLatestDaily.movies,
          error: null,
          dataSource: 'live',
          cacheAgeSeconds: null,
          stale: false,
          warning: liveError,
        };
      }

      const cached = await readDailyCache();
      const matchingCached = resolveMatchingCachedDaily(cached, targetDateKey);
      if (matchingCached) {
        return {
          ok: true,
          endpoint: requestEndpoint || endpoint,
          date: matchingCached.date,
          source: matchingCached.source,
          movies: matchingCached.movies,
          error: null,
          dataSource: 'cache',
          cacheAgeSeconds: matchingCached.ageSeconds >= 0 ? matchingCached.ageSeconds : null,
          stale: matchingCached.stale,
          warning: liveError,
        };
      }
      return {
        ok: false,
        endpoint: requestEndpoint || endpoint,
        date: targetDateKey,
        source: null,
        movies: [],
        error: liveError,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: true,
        warning: null,
      };
    }
    const payload = parsed.payload;
    const rawMovies = Array.isArray(payload.movies) ? payload.movies : [];
    const movies = rawMovies
      .map((movie, index) => normalizeMovie(movie, index))
      .filter((movie): movie is DailyMovie => Boolean(movie));

    if (!response.ok || !payload.ok) {
      const expectedDateKey = normalizeText(payload.date, 40) || targetDateKey;
      const liveError = normalizeText(payload.error, 200) || `HTTP ${response.status}`;
      const supabaseDaily = await readDailyFromSupabase(expectedDateKey || null);
      if (supabaseDaily.ok) {
        return {
          ok: true,
          endpoint: requestEndpoint || endpoint,
          date: supabaseDaily.date,
          source: supabaseDaily.source,
          movies: supabaseDaily.movies,
          error: null,
          dataSource: 'live',
          cacheAgeSeconds: null,
          stale: false,
          warning: liveError,
        };
      }

      const webDaily = await readDailyFromWebApi(expectedDateKey || null, endpoint);
      if (webDaily.ok) {
        return {
          ok: true,
          endpoint: webDaily.endpoint,
          date: webDaily.date,
          source: webDaily.source,
          movies: webDaily.movies,
          error: null,
          dataSource: 'live',
          cacheAgeSeconds: null,
          stale: false,
          warning: liveError,
        };
      }

      const webLatestDaily = await readDailyFromWebApiLatest(endpoint);
      if (webLatestDaily.ok) {
        return {
          ok: true,
          endpoint: webLatestDaily.endpoint,
          date: webLatestDaily.date,
          source: webLatestDaily.source,
          movies: webLatestDaily.movies,
          error: null,
          dataSource: 'live',
          cacheAgeSeconds: null,
          stale: false,
          warning: liveError,
        };
      }

      const cached = await readDailyCache();
      const matchingCached = resolveMatchingCachedDaily(cached, expectedDateKey);
      if (matchingCached) {
        return {
          ok: true,
          endpoint: requestEndpoint || endpoint,
          date: matchingCached.date,
          source: matchingCached.source,
          movies: matchingCached.movies,
          error: null,
          dataSource: 'cache',
          cacheAgeSeconds: matchingCached.ageSeconds >= 0 ? matchingCached.ageSeconds : null,
          stale: matchingCached.stale,
          warning: liveError,
        };
      }

      return {
        ok: false,
        endpoint: requestEndpoint || endpoint,
        date: expectedDateKey || targetDateKey,
        source: normalizeText(payload.source, 40) || null,
        movies: [],
        error: liveError,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: true,
        warning: null,
      };
    }

    if (movies.length === 0) {
      const liveError = 'Daily API returned empty movies payload';
      const expectedDateKey = normalizeText(payload.date, 40) || targetDateKey;
      const supabaseDaily = await readDailyFromSupabase(expectedDateKey || null);
      if (supabaseDaily.ok) {
        return {
          ok: true,
          endpoint: requestEndpoint || endpoint,
          date: supabaseDaily.date,
          source: supabaseDaily.source,
          movies: supabaseDaily.movies,
          error: null,
          dataSource: 'live',
          cacheAgeSeconds: null,
          stale: false,
          warning: liveError,
        };
      }

      const cached = await readDailyCache();
      const matchingCached = resolveMatchingCachedDaily(cached, expectedDateKey);
      if (matchingCached) {
        return {
          ok: true,
          endpoint: requestEndpoint || endpoint,
          date: matchingCached.date,
          source: matchingCached.source,
          movies: matchingCached.movies,
          error: null,
          dataSource: 'cache',
          cacheAgeSeconds: matchingCached.ageSeconds >= 0 ? matchingCached.ageSeconds : null,
          stale: matchingCached.stale,
          warning: liveError,
        };
      }
      return {
        ok: false,
        endpoint: requestEndpoint || endpoint,
        date: expectedDateKey || targetDateKey,
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
      endpoint: requestEndpoint || endpoint,
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
    const supabaseDaily = await readDailyFromSupabase(targetDateKey);
    if (supabaseDaily.ok) {
      return {
        ok: true,
        endpoint: requestEndpoint || endpoint,
        date: supabaseDaily.date,
        source: supabaseDaily.source,
        movies: supabaseDaily.movies,
        error: null,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: false,
        warning: liveError,
      };
    }

    const webDaily = await readDailyFromWebApi(undefined, endpoint);
    if (webDaily.ok) {
      return {
        ok: true,
        endpoint: webDaily.endpoint,
        date: webDaily.date,
        source: webDaily.source,
        movies: webDaily.movies,
        error: null,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: false,
        warning: liveError,
      };
    }

    const webLatestDaily = await readDailyFromWebApiLatest(endpoint);
    if (webLatestDaily.ok) {
      return {
        ok: true,
        endpoint: webLatestDaily.endpoint,
        date: webLatestDaily.date,
        source: webLatestDaily.source,
        movies: webLatestDaily.movies,
        error: null,
        dataSource: 'live',
        cacheAgeSeconds: null,
        stale: false,
        warning: liveError,
      };
    }

    const cached = await readDailyCache();
    const matchingCached = resolveMatchingCachedDaily(cached, targetDateKey);
    if (matchingCached) {
      return {
        ok: true,
        endpoint: requestEndpoint || endpoint,
        date: matchingCached.date,
        source: matchingCached.source,
        movies: matchingCached.movies,
        error: null,
        dataSource: 'cache',
        cacheAgeSeconds: matchingCached.ageSeconds >= 0 ? matchingCached.ageSeconds : null,
        stale: matchingCached.stale,
        warning: liveError,
      };
    }
    return {
      ok: false,
      endpoint: requestEndpoint || endpoint,
      date: targetDateKey,
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
