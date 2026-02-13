import { getCachedDailyMovies, setCachedDailyMovies } from './lib/dailyCache.js';

export const config = {
    runtime: 'nodejs'
};

type Movie = {
    id?: number;
    title?: string;
    movieTitle?: string;
    voteAverage?: number;
    genre?: string;
};

type ApiRequest = {
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined>;
};

type ApiJsonResponder = {
    json: (payload: Record<string, unknown>) => unknown;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => ApiJsonResponder;
};

const DEFAULT_DAILY_ROLLOVER_TIMEZONE = 'Europe/Istanbul';
const DAILY_ROLLOVER_TIMEZONE = (
    process.env.DAILY_ROLLOVER_TIMEZONE || DEFAULT_DAILY_ROLLOVER_TIMEZONE
).trim() || DEFAULT_DAILY_ROLLOVER_TIMEZONE;

const createDateFormatter = (timeZone: string): Intl.DateTimeFormat => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
};

const DAILY_DATE_FORMATTER = createDateFormatter(DAILY_ROLLOVER_TIMEZONE);
const DAILY_ROLLOVER_TIMEZONE_RESOLVED = DAILY_DATE_FORMATTER.resolvedOptions().timeZone || 'UTC';

const getDateKeyFromFormatter = (date: Date, formatter: Intl.DateTimeFormat): string => {
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
        return date.toISOString().split('T')[0];
    }

    return `${year}-${month}-${day}`;
};

const getDailyDateKey = (): string => getDateKeyFromFormatter(new Date(), DAILY_DATE_FORMATTER);

const getSupabaseUrl = (): string => {
    return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
};

const getSupabaseReadKey = (): string => {
    return (
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        ''
    );
};

const getQueryParam = (req: ApiRequest, key: string): string | null => {
    const rawQueryValue = req?.query?.[key];
    if (typeof rawQueryValue === 'string') return rawQueryValue;
    if (Array.isArray(rawQueryValue) && typeof rawQueryValue[0] === 'string') return rawQueryValue[0];

    const rawUrl = typeof req?.url === 'string' ? req.url : '';
    if (!rawUrl) return null;

    try {
        const host = req?.headers?.host || 'localhost';
        const url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : `https://${host}`);
        return url.searchParams.get(key);
    } catch {
        return null;
    }
};

const sendJson = (
    res: ApiResponse,
    status: number,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
        }
    }

    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }

    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            ...headers
        }
    });
};

const isValidDateKey = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const isMovieEligibleForDaily = (movie: Movie): boolean => {
    const voteAverage = Number(movie.voteAverage);
    if (!Number.isFinite(voteAverage) || voteAverage < 6.5) return false;
    const normalizedGenre = String(movie.genre || '').toLowerCase();
    if (normalizedGenre.includes('documentary') || normalizedGenre.includes('belgesel')) return false;
    return true;
};

const normalizeMovie = (input: unknown): Movie => {
    const movie = (input || {}) as Movie & { movie_title?: string; vote_average?: number };
    return {
        ...movie,
        title: movie.title || movie.movieTitle || movie.movie_title,
        voteAverage: movie.voteAverage ?? movie.vote_average
    };
};

const readDailyShowcaseFromSupabase = async (dateKey: string): Promise<Movie[] | null> => {
    const supabaseUrl = getSupabaseUrl().trim();
    const readKey = getSupabaseReadKey().trim();
    if (!supabaseUrl || !readKey) return null;

    try {
        const endpoint = `${supabaseUrl}/rest/v1/daily_showcase?select=movies&date=eq.${encodeURIComponent(dateKey)}&limit=1`;
        const response = await fetch(endpoint, {
            headers: {
                apikey: readKey,
                Authorization: `Bearer ${readKey}`,
                Accept: 'application/json'
            }
        });
        if (!response.ok) return null;

        const rows = (await response.json()) as Array<{ movies?: unknown[] }>;
        if (!Array.isArray(rows) || rows.length === 0) return null;

        const rawMovies = Array.isArray(rows[0]?.movies) ? rows[0].movies : [];
        const normalized = rawMovies
            .map((movie) => normalizeMovie(movie))
            .filter(isMovieEligibleForDaily);

        return normalized.length ? normalized : null;
    } catch {
        return null;
    }
};

const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Unexpected error';
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    try {
        const ping = getQueryParam(req, 'ping');
        const dateQuery = getQueryParam(req, 'date');
        const dateKey = dateQuery && isValidDateKey(dateQuery) ? dateQuery : getDailyDateKey();

        if (ping === '1') {
            return sendJson(res, 200, {
                ok: true,
                date: dateKey,
                timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
                runtime: 'node'
            });
        }

        const cacheHeaders = {
            'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
        };

        const cacheHit = await getCachedDailyMovies(dateKey);
        if (cacheHit && Array.isArray(cacheHit.movies) && cacheHit.movies.length > 0) {
            return sendJson(
                res,
                200,
                {
                    ok: true,
                    date: dateKey,
                    source: cacheHit.source,
                    movies: cacheHit.movies
                },
                cacheHeaders
            );
        }

        const movies = await readDailyShowcaseFromSupabase(dateKey);
        if (!movies || movies.length === 0) {
            return sendJson(res, 404, { ok: false, date: dateKey, error: 'No daily showcase entry.' }, cacheHeaders);
        }

        await setCachedDailyMovies(dateKey, movies);
        return sendJson(
            res,
            200,
            {
                ok: true,
                date: dateKey,
                source: 'supabase',
                movies
            },
            cacheHeaders
        );
    } catch (error: unknown) {
        return sendJson(res, 500, {
            ok: false,
            error: toErrorMessage(error)
        });
    }
}
