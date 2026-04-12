/* eslint-disable @typescript-eslint/no-explicit-any */
import { setCachedDailyMovies } from '../lib/dailyCache.js';
import {
    hasDailyQuizProviderConfig,
    getQuizTargetDateKey,
    prepareDailyQuizBatch,
    publishDailyQuizBatch,
    readPreparedDailyQuizMovies,
    stageDailyQuizSourceBatch
} from '../lib/dailyQuiz.js';
import { createSupabaseServiceClient } from '../lib/supabaseServiceClient.js';
import { createSupabaseServiceHeaders } from '../lib/supabaseServiceHeaders.js';
import {
    getSupabasePushConfig,
    readAllPushAudiences,
    sendExpoPushMessages
} from '../lib/push.js';
import { syncDailyQuestionsToPool } from '../lib/questionPool.js';

export const config = {
    runtime: 'nodejs'
};

type Movie = {
    id: number;
    title: string;
    director: string;
    year: number;
    genre: string;
    tagline: string;
    color: string;
    posterPath?: string;
    overview?: string;
    voteAverage?: number;
    cast?: string[];
    originalLanguage?: string;
    slotLabel?: string;
};

type UploadResult = {
    url: string | null;
    error: string | null;
    sourceUrl?: string;
};

type PosterDiagnostic = {
    movieId: number;
    title: string;
    size: 'w200' | 'w500';
    sourceUrl?: string;
    error: string;
};

type TmdbDiscoverMovie = {
    id?: number;
    title?: string;
    name?: string;
    poster_path?: string | null;
    release_date?: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    overview?: string;
    original_language?: string;
    genre_ids?: number[];
};

type TmdbCreditsResponse = {
    cast?: Array<{ name?: string; order?: number }>;
    crew?: Array<{ name?: string; job?: string; department?: string }>;
};

const DEFAULT_SLOT_LABELS = [
    'The Legend',
    'The Hidden Gem',
    'DNA Flip',
    'The Modern',
    'The Mystery'
];

const DEFAULT_GRADIENTS = [
    'from-red-900 to-red-800',
    'from-orange-400 to-orange-600',
    'from-blue-800 to-blue-900',
    'from-pink-300 to-purple-400',
    'from-green-700 to-green-900'
];
const DAILY_MOVIE_COUNT = 5;
const DAILY_MIN_UNIQUE_GENRES = DAILY_MOVIE_COUNT;
const CLASSIC_YEAR_THRESHOLD = 2000;
const MODERN_YEAR_THRESHOLD = 2010;
const DAILY_MAX_MOVIES_PER_DIRECTOR = 1;
const DAILY_REPEAT_COOLDOWN_DAYS = 60;
const TMDB_DISCOVER_PAGE_WINDOW = 20;
const TMDB_SLOT_PAGE_COUNT = 2;
const TMDB_MIN_VOTE_AVERAGE = 6.5;
const TMDB_MIN_VOTE_COUNT = 700;
const TMDB_MIN_POPULARITY = 7;
const TMDB_MIN_RUNTIME_MINUTES = 60;
const TMDB_EXCLUDED_GENRE_IDS = new Set<number>([99]);
const TMDB_CAST_LIMIT = 6;
const TMDB_FALLBACK_DISCOVER_PARAMS = [
    '&vote_average.gte=6.5&vote_count.gte=1200&sort_by=vote_count.desc',
    '&vote_average.gte=6.5&vote_count.gte=900&sort_by=popularity.desc',
    '&vote_average.gte=6.5&vote_count.gte=1200&sort_by=vote_average.desc'
];
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

const DEFAULT_SLOT_PARAMS = [
    '&vote_average.gte=7.2&vote_count.gte=2500&popularity.gte=18&sort_by=vote_average.desc',
    '&vote_average.gte=6.5&vote_count.gte=1200&popularity.gte=15&sort_by=popularity.desc',
    '&with_genres=36,10752,80,53,28&vote_average.gte=6.5&vote_count.gte=1000&popularity.gte=12&sort_by=popularity.desc',
    '&primary_release_date.gte=2024-01-01&vote_average.gte=6.5&vote_count.gte=800&popularity.gte=12&sort_by=popularity.desc',
    '&vote_average.gte=6.5&vote_count.gte=900&popularity.gte=12&with_original_language=ja|ko|fr&sort_by=popularity.desc'
];

const DEFAULT_SEED_MOVIES: Movie[] = [
    {
        id: 157336,
        title: 'Interstellar',
        director: 'Christopher Nolan',
        year: 2014,
        genre: 'Sci-Fi/Adventure',
        tagline: 'Mankind was born on Earth. It was never meant to die here.',
        color: 'from-slate-900 to-indigo-900',
        posterPath: '/gEU2QniL6C8zYEfe4NCJw46LCDp.jpg',
        voteAverage: 8.4,
        overview:
            'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.'
    },
    {
        id: 155,
        title: 'The Dark Knight',
        director: 'Christopher Nolan',
        year: 2008,
        genre: 'Action/Crime',
        tagline: 'Why So Serious?',
        color: 'from-gray-900 to-slate-800',
        posterPath: '/qJ2tW6WMUDux911r6m775X8H3rC.jpg',
        voteAverage: 8.5,
        overview:
            'Batman raises the stakes in his war on crime with the help of Lt. Jim Gordon and District Attorney Harvey Dent.'
    },
    {
        id: 129,
        title: 'Spirited Away',
        director: 'Hayao Miyazaki',
        year: 2001,
        genre: 'Animation/Fantasy',
        tagline: 'The tunnel led Chihiro to a mysterious town...',
        color: 'from-blue-800 to-teal-700',
        posterPath: '/3G1Q5Jd9dqmHGS3U8Y2jPuygQ8K.jpg',
        voteAverage: 8.5,
        overview:
            'A young girl, Chihiro, becomes trapped in a strange new world of spirits and must free her family.'
    },
    {
        id: 496243,
        title: 'Parasite',
        director: 'Bong Joon-ho',
        year: 2019,
        genre: 'Comedy/Thriller',
        tagline: 'Act like you own the place.',
        color: 'from-green-900 to-gray-900',
        posterPath: '/7IiTTgloJzvGIBNfSdNqOfqgFW9.jpg',
        voteAverage: 8.5,
        overview:
            "All unemployed, Ki-taek's family takes peculiar interest in the wealthy Parks until they are entangled in an unexpected incident."
    },
    {
        id: 389,
        title: '12 Angry Men',
        director: 'Sidney Lumet',
        year: 1957,
        genre: 'Drama',
        tagline: 'Life is in their hands. Death is on their minds.',
        color: 'from-gray-700 to-gray-900',
        posterPath: '/2JP0P0XM4Lh3M26fU9h8rQ7B1Yx.jpg',
        voteAverage: 8.5,
        overview:
            'The jury enters deliberations to decide whether a young defendant is guilty of murdering his father.'
    }
];

const LEGACY_SEED_ID_SET = new Set<number>(DEFAULT_SEED_MOVIES.map((movie) => movie.id));

const EXTRA_POSTER_CACHE_MOVIES: Movie[] = [
    {
        id: 843,
        title: 'In the Mood for Love',
        director: 'Wong Kar-wai',
        year: 2000,
        genre: 'Romance/Drama',
        tagline: 'Feelings keep lingering...',
        color: 'from-red-900 to-red-800',
        posterPath: '/inVq3FRqcYIRl2la8iZikYYxFNR.jpg'
    }
];

const hashString = (value: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const createSeededRandom = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

const getModernFloorDate = (): string => {
    const [year, month, day] = getDailyDateKey().split('-').map((part) => Number(part));
    const value = new Date(Date.UTC((year || 2000) - 2, (month || 1) - 1, day || 1));
    const floorYear = value.getUTCFullYear();
    const floorMonth = String(value.getUTCMonth() + 1).padStart(2, '0');
    const floorDay = String(value.getUTCDate()).padStart(2, '0');
    return `${floorYear}-${floorMonth}-${floorDay}`;
};

const getSlotParamsForToday = (): string[] => {
    const modernFloor = getModernFloorDate();
    return DEFAULT_SLOT_PARAMS.map((value) =>
        value.replace('2024-01-01', modernFloor)
    );
};

const getDateKeyDaysAgo = (dateKey: string, days: number): string => {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part));
    const safeDays = Math.max(0, Math.floor(days));
    const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    date.setUTCDate(date.getUTCDate() - safeDays);
    const nextYear = date.getUTCFullYear();
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getUTCDate()).padStart(2, '0');
    return `${nextYear}-${nextMonth}-${nextDay}`;
};

const normalizeMovieIds = (movieIds: number[] = []): number[] => {
    return Array.from(
        new Set(
            movieIds
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );
};

const normalizeDirectorKey = (value: string | null | undefined): string => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'unknown') return '';
    return normalized;
};

const isMovieEligibleForDaily = (movie: Movie): boolean => {
    const voteAverage = Number(movie.voteAverage);
    if (!Number.isFinite(voteAverage) || voteAverage < TMDB_MIN_VOTE_AVERAGE) return false;
    const normalizedGenre = String(movie.genre || '').toLowerCase();
    if (normalizedGenre.includes('documentary') || normalizedGenre.includes('belgesel')) return false;
    return true;
};

const isLegacySeedSelection = (movies: Movie[]): boolean => {
    const selected = movies.slice(0, DAILY_MOVIE_COUNT);
    if (selected.length !== DAILY_MOVIE_COUNT) return false;
    return selected.every((movie) => LEGACY_SEED_ID_SET.has(movie.id));
};

const parseYearFromDate = (value: string | undefined): number => {
    if (!value) return 2005;
    const year = Number.parseInt(value.slice(0, 4), 10);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return 2005;
    return year;
};

const parseSlotParams = (rawParams: string): URLSearchParams => {
    const searchParams = new URLSearchParams();
    const normalized = rawParams.replace(/^\?/, '').replace(/^&/, '');
    for (const chunk of normalized.split('&')) {
        if (!chunk) continue;
        const [rawKey, ...rest] = chunk.split('=');
        const key = (rawKey || '').trim();
        if (!key) continue;
        const value = rest.join('=').trim();
        if (value) {
            searchParams.set(key, value);
        }
    }
    return searchParams;
};

const parseNumberParam = (value: string | null): number | null => {
    if (typeof value !== 'string') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const enforceMinNumberParam = (params: URLSearchParams, key: string, minValue: number) => {
    const existing = parseNumberParam(params.get(key));
    if (existing === null || existing < minValue) {
        params.set(key, String(minValue));
    }
};

const sanitizeGenreFilter = (rawValue: string | null): number[] => {
    if (!rawValue) return [];
    return rawValue
        .split(',')
        .map((chunk) => Number(chunk.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
};

const enforceDiscoverQualityFilters = (params: URLSearchParams) => {
    enforceMinNumberParam(params, 'vote_average.gte', TMDB_MIN_VOTE_AVERAGE);
    enforceMinNumberParam(params, 'vote_count.gte', TMDB_MIN_VOTE_COUNT);
    enforceMinNumberParam(params, 'popularity.gte', TMDB_MIN_POPULARITY);
    enforceMinNumberParam(params, 'with_runtime.gte', TMDB_MIN_RUNTIME_MINUTES);

    const withGenres = sanitizeGenreFilter(params.get('with_genres')).filter(
        (genreId) => !TMDB_EXCLUDED_GENRE_IDS.has(genreId)
    );
    if (withGenres.length > 0) {
        params.set('with_genres', withGenres.join(','));
    } else {
        params.delete('with_genres');
    }

    const withoutGenres = new Set<number>([
        ...sanitizeGenreFilter(params.get('without_genres')),
        ...Array.from(TMDB_EXCLUDED_GENRE_IDS.values())
    ]);
    params.set('without_genres', Array.from(withoutGenres.values()).join(','));
};

const normalizeGenre = (movie: Movie): string => {
    return (movie.genre || '').split('/')[0].trim().toLowerCase();
};

const countUniqueGenres = (movies: Movie[]): number => {
    return new Set(movies.map((movie) => normalizeGenre(movie))).size;
};

const countByGenre = (movies: Movie[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const movie of movies) {
        const genre = normalizeGenre(movie);
        counts.set(genre, (counts.get(genre) || 0) + 1);
    }
    return counts;
};

const hasUniqueDirectors = (movies: Movie[]): boolean => {
    const seen = new Set<string>();
    for (const movie of movies) {
        const directorKey = normalizeDirectorKey(movie.director);
        if (!directorKey || seen.has(directorKey)) return false;
        seen.add(directorKey);
    }
    return true;
};

const hasEraBalance = (movies: Movie[]): boolean => {
    const hasClassic = movies.some((movie) => movie.year < CLASSIC_YEAR_THRESHOLD);
    const hasModern = movies.some((movie) => movie.year >= MODERN_YEAR_THRESHOLD);
    return hasClassic && hasModern;
};

const hasCastData = (movies: Movie[]): boolean => {
    return movies.every(
        (movie) => Array.isArray(movie.cast) && movie.cast.some((name) => String(name || '').trim().length > 0)
    );
};

const isSelectionEligibleForDaily = (movies: Movie[]): boolean => {
    if (movies.length !== DAILY_MOVIE_COUNT) return false;
    if (isLegacySeedSelection(movies)) return false;
    if (!movies.every(isMovieEligibleForDaily)) return false;
    if (!hasEraBalance(movies)) return false;
    if (!hasUniqueDirectors(movies)) return false;
    if (!hasCastData(movies)) return false;
    return true;
};

const applySlotStyles = (movies: Movie[]): Movie[] => {
    return movies.map((movie, index) => ({
        ...movie,
        slotLabel: DEFAULT_SLOT_LABELS[index] || movie.slotLabel,
        color: DEFAULT_GRADIENTS[index] || movie.color
    }));
};

const pickWithDirectorLimit = (pool: Movie[]): Movie[] => {
    const selected: Movie[] = [];
    const directorCounts = new Map<string, number>();

    for (const movie of pool) {
        const directorKey = normalizeDirectorKey(movie.director);
        const count = directorCounts.get(directorKey) || 0;
        if (directorKey && count >= DAILY_MAX_MOVIES_PER_DIRECTOR) continue;

        selected.push(movie);
        if (directorKey) {
            directorCounts.set(directorKey, count + 1);
        }
        if (selected.length >= DAILY_MOVIE_COUNT) break;
    }

    if (selected.length < DAILY_MOVIE_COUNT) {
        for (const movie of pool) {
            if (selected.some((selectedMovie) => selectedMovie.id === movie.id)) continue;
            selected.push(movie);
            if (selected.length >= DAILY_MOVIE_COUNT) break;
        }
    }

    return selected.slice(0, DAILY_MOVIE_COUNT);
};

const replaceMovie = (
    selected: Movie[],
    pool: Movie[],
    predicate: (movie: Movie) => boolean,
    canReplace: (movie: Movie, snapshot: Movie[]) => boolean
): Movie[] => {
    if (selected.some(predicate)) return selected;
    const candidate = pool.find((movie) => predicate(movie) && !selected.some((s) => s.id === movie.id));
    if (!candidate) return selected;

    for (let index = selected.length - 1; index >= 0; index -= 1) {
        if (!canReplace(selected[index], selected)) continue;
        const next = [...selected];
        next[index] = candidate;
        return next;
    }

    return selected;
};

const enforceGenreDiversity = (selected: Movie[], pool: Movie[]): Movie[] => {
    const next = [...selected];
    let attempts = 0;

    while (countUniqueGenres(next) < DAILY_MIN_UNIQUE_GENRES && attempts < 10) {
        const currentGenres = new Set(next.map((movie) => normalizeGenre(movie)));
        const candidate = pool.find(
            (movie) =>
                !next.some((selectedMovie) => selectedMovie.id === movie.id) &&
                !currentGenres.has(normalizeGenre(movie))
        );
        if (!candidate) break;

        const genreCounts = countByGenre(next);
        const classics = next.filter((movie) => movie.year < CLASSIC_YEAR_THRESHOLD).length;
        const moderns = next.filter((movie) => movie.year >= MODERN_YEAR_THRESHOLD).length;

        let replaceIndex = -1;
        for (let i = next.length - 1; i >= 0; i -= 1) {
            const movie = next[i];
            const genre = normalizeGenre(movie);
            const canDropGenre = (genreCounts.get(genre) || 0) > 1;
            if (!canDropGenre) continue;
            if (movie.year < CLASSIC_YEAR_THRESHOLD && classics <= 1) continue;
            if (movie.year >= MODERN_YEAR_THRESHOLD && moderns <= 1) continue;
            replaceIndex = i;
            break;
        }

        if (replaceIndex < 0) break;
        next[replaceIndex] = candidate;
        attempts += 1;
    }

    return next;
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_SOURCE_PROXIES = ['https://images.weserv.nl/?url=', 'https://wsrv.nl/?url='];
const tmdbPosterCache = new Map<number, string | null>();
const tmdbCreditsCache = new Map<number, { director: string; cast: string[] } | null>();

const fetchTmdbGenreMap = async (apiKey: string): Promise<Map<number, string>> => {
    const params = new URLSearchParams({
        api_key: apiKey,
        language: 'en-US'
    });
    const url = `${TMDB_API_BASE}/genre/movie/list?${params.toString()}`;
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                // Rate limited — wait and retry
                const retryAfter = Number(response.headers.get('retry-after') || 5) * 1000;
                const waitMs = Math.min(retryAfter, attempt * 5000);
                console.warn(`[daily-cron] TMDB genre fetch rate-limited, retrying in ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
                await new Promise((r) => setTimeout(r, waitMs));
                lastError = new Error(`genre_fetch_http_429`);
                continue;
            }
            if (!response.ok) {
                throw new Error(`genre_fetch_http_${response.status}`);
            }
            const payload = (await response.json()) as { genres?: Array<{ id: number; name: string }> };
            const genreMap = new Map<number, string>();
            for (const genre of payload.genres || []) {
                if (typeof genre?.id === 'number' && typeof genre?.name === 'string') {
                    genreMap.set(genre.id, genre.name);
                }
            }
            if (genreMap.size === 0) {
                throw new Error('genre_fetch_empty_response');
            }
            return genreMap;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < MAX_RETRIES) {
                const waitMs = attempt * 2000;
                console.warn(`[daily-cron] TMDB genre fetch failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${waitMs}ms:`, lastError.message);
                await new Promise((r) => setTimeout(r, waitMs));
            }
        }
    }

    console.error('[daily-cron] TMDB genre fetch exhausted all retries:', lastError?.message);
    throw lastError ?? new Error('genre_fetch_failed');
};

const fetchTmdbDiscoverForSlot = async (
    apiKey: string,
    dateKey: string,
    slotParams: string,
    slotIndex: number
): Promise<TmdbDiscoverMovie[]> => {
    const parsedSlotParams = parseSlotParams(slotParams);
    const basePage = (hashString(`cron-slot:${dateKey}:${slotIndex}`) % TMDB_DISCOVER_PAGE_WINDOW) + 1;
    const results: TmdbDiscoverMovie[] = [];

    for (let offset = 0; offset < TMDB_SLOT_PAGE_COUNT; offset += 1) {
        const page = ((basePage + offset * 7 - 1) % TMDB_DISCOVER_PAGE_WINDOW) + 1;
        const params = new URLSearchParams({
            api_key: apiKey,
            language: 'en-US',
            include_adult: 'false',
            include_video: 'false',
            page: String(page)
        });
        parsedSlotParams.forEach((value, key) => params.set(key, value));
        enforceDiscoverQualityFilters(params);

        try {
            const response = await fetch(`${TMDB_API_BASE}/discover/movie?${params.toString()}`);
            if (!response.ok) {
                console.warn(`[daily-cron] TMDB discover page ${page} failed with status ${response.status} (slot ${slotIndex})`);
                continue;
            }
            const payload = (await response.json()) as { results?: TmdbDiscoverMovie[] };
            if (Array.isArray(payload.results)) {
                results.push(...payload.results);
            }
        } catch (err) {
            console.warn(`[daily-cron] TMDB discover page ${page} threw (slot ${slotIndex}):`, err instanceof Error ? err.message : String(err));
        }
    }

    return results;
};

const mapTmdbResultToMovie = (result: TmdbDiscoverMovie, genreMap: Map<number, string>): Movie | null => {
    const id = Number(result.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (LEGACY_SEED_ID_SET.has(id)) return null;

    const title = (result.title || result.name || '').trim();
    if (!title) return null;

    const posterPath = typeof result.poster_path === 'string' ? result.poster_path : '';
    if (!posterPath) return null;

    const voteAverage = typeof result.vote_average === 'number' ? result.vote_average : 0;
    const voteCount = typeof result.vote_count === 'number' ? result.vote_count : 0;
    const popularity = typeof result.popularity === 'number' ? result.popularity : 0;
    if (voteAverage < TMDB_MIN_VOTE_AVERAGE) return null;
    if (voteCount < TMDB_MIN_VOTE_COUNT) return null;
    if (popularity < TMDB_MIN_POPULARITY) return null;

    const genreIds = (result.genre_ids || [])
        .map((genreId) => Number(genreId))
        .filter((genreId) => Number.isInteger(genreId) && genreId > 0);
    if (genreIds.length === 0) return null;
    if (genreIds.some((genreId) => TMDB_EXCLUDED_GENRE_IDS.has(genreId))) return null;

    const genres = genreIds
        .map((genreId) => genreMap.get(genreId) || '')
        .filter((genreName) => Boolean(genreName))
        .slice(0, 2);

    return {
        id,
        title,
        director: '',
        year: parseYearFromDate(result.release_date),
        genre: genres.join('/') || 'Drama',
        tagline: '',
        color: DEFAULT_GRADIENTS[0],
        posterPath,
        voteAverage: voteAverage || undefined,
        overview: typeof result.overview === 'string' ? result.overview : undefined,
        originalLanguage: typeof result.original_language === 'string' ? result.original_language : undefined,
        cast: []
    };
};

const fetchTmdbCredits = async (
    apiKey: string,
    movieId: number
): Promise<{ director: string; cast: string[] } | null> => {
    if (tmdbCreditsCache.has(movieId)) {
        return tmdbCreditsCache.get(movieId) || null;
    }

    try {
        const response = await fetch(`${TMDB_API_BASE}/movie/${movieId}/credits?api_key=${apiKey}&language=en-US`);
        if (!response.ok) {
            tmdbCreditsCache.set(movieId, null);
            return null;
        }

        const payload = (await response.json()) as TmdbCreditsResponse;
        const director =
            (payload.crew || [])
                .find((member) => String(member?.job || '').toLowerCase() === 'director')
                ?.name ||
            (payload.crew || [])
                .find((member) => String(member?.department || '').toLowerCase() === 'directing')
                ?.name ||
            '';
        const normalizedDirector = String(director || '').trim();
        if (!normalizedDirector) {
            tmdbCreditsCache.set(movieId, null);
            return null;
        }

        const cast = (payload.cast || [])
            .slice()
            .sort((left, right) => (Number(left?.order) || 9999) - (Number(right?.order) || 9999))
            .map((member) => String(member?.name || '').trim())
            .filter((name) => Boolean(name))
            .slice(0, TMDB_CAST_LIMIT);

        const resolved = {
            director: normalizedDirector,
            cast
        };
        tmdbCreditsCache.set(movieId, resolved);
        return resolved;
    } catch {
        tmdbCreditsCache.set(movieId, null);
        return null;
    }
};

const enrichSelectionWithCredits = async (
    selected: Movie[],
    pool: Movie[],
    apiKey: string
): Promise<Movie[]> => {
    const next = [...selected];
    const usedMovieIds = new Set(next.map((movie) => movie.id));

    for (let index = 0; index < next.length; index += 1) {
        const otherGenres = new Set(
            next
                .filter((_, i) => i !== index)
                .map((movie) => normalizeGenre(movie))
        );
        const otherDirectors = new Set(
            next
                .filter((_, i) => i !== index)
                .map((movie) => normalizeDirectorKey(movie.director))
                .filter((value) => Boolean(value))
        );

        const currentCredits = await fetchTmdbCredits(apiKey, next[index].id);
        const currentDirectorKey = normalizeDirectorKey(currentCredits?.director || next[index].director);
        const currentGenre = normalizeGenre(next[index]);
        const currentIsValid =
            Boolean(currentCredits?.director) &&
            Boolean(currentDirectorKey) &&
            !otherDirectors.has(currentDirectorKey) &&
            Boolean(currentGenre) &&
            !otherGenres.has(currentGenre);

        if (currentIsValid) {
            next[index] = {
                ...next[index],
                director: currentCredits!.director,
                cast: currentCredits!.cast.length ? currentCredits!.cast : next[index].cast || []
            };
            continue;
        }

        let replacementFound = false;
        for (const candidate of pool) {
            if (usedMovieIds.has(candidate.id)) continue;

            const candidateGenre = normalizeGenre(candidate);
            if (!candidateGenre || otherGenres.has(candidateGenre)) continue;

            const credits = await fetchTmdbCredits(apiKey, candidate.id);
            const directorKey = normalizeDirectorKey(credits?.director);
            if (!credits || !directorKey || otherDirectors.has(directorKey)) continue;

            usedMovieIds.delete(next[index].id);
            usedMovieIds.add(candidate.id);
            next[index] = {
                ...candidate,
                director: credits.director,
                cast: credits.cast.length ? credits.cast : candidate.cast || []
            };
            replacementFound = true;
            break;
        }

        if (!replacementFound) {
            return [];
        }
    }

    return next;
};

const buildFallbackSelectionFromPool = async (pool: Movie[], apiKey: string): Promise<Movie[]> => {
    const selected: Movie[] = [];
    const usedDirectors = new Set<string>();

    for (const candidate of pool) {
        if (selected.length >= DAILY_MOVIE_COUNT) break;

        const credits = await fetchTmdbCredits(apiKey, candidate.id);
        const director = String(credits?.director || candidate.director || '').trim();
        const directorKey = normalizeDirectorKey(director);
        const cast = Array.isArray(credits?.cast) && credits.cast.length > 0
            ? credits.cast
            : Array.isArray(candidate.cast)
                ? candidate.cast.filter((name) => String(name || '').trim().length > 0)
                : [];

        if (!directorKey || usedDirectors.has(directorKey) || cast.length === 0) {
            continue;
        }

        usedDirectors.add(directorKey);
        selected.push({
            ...candidate,
            director,
            cast
        });
    }

    return selected.slice(0, DAILY_MOVIE_COUNT);
};

const getCronSecret = (): string | null => {
    return process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || null;
};

const getBucketName = (): string => {
    return process.env.SUPABASE_STORAGE_BUCKET || 'posters';
};

const getSupabaseUrl = (): string => {
    return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
};

const getSupabaseServiceRoleKey = (): string => {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
};

const getTmdbApiKey = (): string => {
    return process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';
};

const decodeJwtRole = (jwt: string): string | null => {
    try {
        const parts = jwt.split('.');
        if (parts.length < 2) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const normalized = payload + '='.repeat((4 - (payload.length % 4)) % 4);
        let decoded = '';
        if (typeof atob === 'function') {
            decoded = atob(normalized);
        } else if (typeof Buffer !== 'undefined') {
            decoded = Buffer.from(normalized, 'base64').toString('utf8');
        } else {
            return null;
        }
        const json = JSON.parse(decoded);
        return typeof json?.role === 'string' ? json.role : null;
    } catch {
        return null;
    }
};

const getQueryParam = (req: any, key: string): string | null => {
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

const getHeader = (req: any, key: string): string => {
    const lowerKey = key.toLowerCase();
    const headers = req?.headers;

    if (!headers) return '';

    if (typeof headers.get === 'function') {
        return headers.get(key) || '';
    }

    return headers[lowerKey] || headers[key] || '';
};

const sendJson = (res: any, status: number, payload: Record<string, unknown>) => {
    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }

    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' }
    });
};

const normalizeText = (value: unknown, maxLength = 400): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const isValidDateKey = (value: string | null | undefined): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isSupabaseSecretApiKey = (value: string): boolean =>
    String(value || '').trim().startsWith('sb_secret_');

const createSupabaseRestHeaders = (
    serviceRoleKey: string,
    extra: Record<string, string> = {}
): Record<string, string> =>
    createSupabaseServiceHeaders(serviceRoleKey, {
        Accept: 'application/json',
        ...extra
    });

const readDailyShowcaseRowsViaRest = async (
    supabaseUrl: string,
    serviceRoleKey: string,
    input: { gteDate?: string; ltDate?: string }
): Promise<any[]> => {
    const params = new URLSearchParams({
        select: 'date,movies',
        limit: '120'
    });
    if (input.gteDate) {
        params.set('date', `gte.${input.gteDate}`);
    }
    if (input.ltDate) {
        params.append('date', `lt.${input.ltDate}`);
    }

    const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/daily_showcase?${params.toString()}`;
    const response = await fetch(endpoint, {
        headers: createSupabaseRestHeaders(serviceRoleKey)
    });
    const payload = (await response.json().catch(() => [])) as unknown;
    if (!response.ok) {
        const first = Array.isArray(payload) ? payload[0] : payload;
        const error = typeof first === 'object' && first ? first as Record<string, unknown> : {};
        throw new Error(normalizeText(error.message || error.error || `HTTP ${response.status}`, 320));
    }
    return Array.isArray(payload) ? payload as any[] : [];
};

const readDailyShowcaseEntryViaRest = async (
    supabaseUrl: string,
    serviceRoleKey: string,
    dateKey: string
): Promise<any | null> => {
    const endpoint =
        `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/daily_showcase` +
        `?select=date,movies&date=eq.${encodeURIComponent(dateKey)}&limit=1`;
    const response = await fetch(endpoint, {
        headers: createSupabaseRestHeaders(serviceRoleKey)
    });
    const payload = (await response.json().catch(() => [])) as unknown;
    if (!response.ok) {
        const first = Array.isArray(payload) ? payload[0] : payload;
        const error = typeof first === 'object' && first ? first as Record<string, unknown> : {};
        throw new Error(normalizeText(error.message || error.error || `HTTP ${response.status}`, 320));
    }
    return Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
};

const upsertDailyShowcaseViaRest = async (
    supabaseUrl: string,
    serviceRoleKey: string,
    dateKey: string,
    movies: Movie[]
): Promise<void> => {
    const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/daily_showcase?on_conflict=date`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: createSupabaseRestHeaders(serviceRoleKey, {
            'content-type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
        }),
        body: JSON.stringify([{ date: dateKey, movies }])
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as unknown;
        const error = typeof payload === 'object' && payload ? payload as Record<string, unknown> : {};
        throw new Error(normalizeText(error.message || error.error || `HTTP ${response.status}`, 320));
    }
};

const ensureBucket = async (supabase: any, bucket: string) => {
    const { data, error } = await supabase.storage.getBucket(bucket);
    if (data && !error) {
        if (data.public !== true) {
            const { error: updateError } = await supabase.storage.updateBucket(bucket, { public: true });
            if (updateError) {
                throw new Error(`Bucket update failed: ${updateError.message}`);
            }
        }
        return;
    }

    const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: true
    });
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
        throw new Error(`Bucket create failed: ${createError.message}`);
    }
};

const toImageUrl = (posterPath: string, size: 'w200' | 'w500' | 'w780' | 'original'): string => {
    if (/^https?:\/\//i.test(posterPath)) {
        const tmdbMatch = posterPath.match(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\/(.+)$/i);
        if (tmdbMatch) {
            return `${TMDB_IMAGE_BASE}/${size}/${tmdbMatch[1]}`;
        }
        return posterPath;
    }
    const clean = posterPath.startsWith('/') ? posterPath : `/${posterPath}`;
    return `${TMDB_IMAGE_BASE}/${size}${clean}`;
};

const buildSourceCandidates = (posterPath: string, size: 'w200' | 'w500'): string[] => {
    const direct = toImageUrl(posterPath, size);
    if (!direct) return [];
    const candidates = [direct];
    if (/^https?:\/\/image\.tmdb\.org\//i.test(direct)) {
        const encoded = encodeURIComponent(direct);
        for (const proxy of IMAGE_SOURCE_PROXIES) {
            candidates.push(`${proxy}${encoded}`);
        }
    }
    return Array.from(new Set(candidates));
};

const fetchLatestPosterPath = async (movie: Movie): Promise<string | null> => {
    if (tmdbPosterCache.has(movie.id)) {
        return tmdbPosterCache.get(movie.id) || null;
    }

    const apiKey = getTmdbApiKey();
    if (!apiKey) {
        tmdbPosterCache.set(movie.id, null);
        return null;
    }

    try {
        const detailUrl = `${TMDB_API_BASE}/movie/${movie.id}?api_key=${apiKey}&language=en-US`;
        const detailRes = await fetch(detailUrl);
        if (detailRes.ok) {
            const detail = await detailRes.json();
            if (typeof detail?.poster_path === 'string' && detail.poster_path) {
                tmdbPosterCache.set(movie.id, detail.poster_path);
                return detail.poster_path;
            }
        }
    } catch {
        // noop: search fallback below
    }

    if (movie.title) {
        try {
            const searchUrl = `${TMDB_API_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movie.title)}`;
            const searchRes = await fetch(searchUrl);
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                const firstPath = searchData?.results?.[0]?.poster_path;
                if (typeof firstPath === 'string' && firstPath) {
                    tmdbPosterCache.set(movie.id, firstPath);
                    return firstPath;
                }
            }
        } catch {
            // noop
        }
    }

    tmdbPosterCache.set(movie.id, null);
    return null;
};

const extFromContentType = (contentType: string | null): string => {
    if (!contentType) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    return 'jpg';
};

const uploadPoster = async (
    supabase: any,
    bucket: string,
    movieId: number,
    posterPath: string,
    size: 'w200' | 'w500'
): Promise<UploadResult> => {
    const sources = buildSourceCandidates(posterPath, size);
    if (!sources.length) return { url: null, error: 'no_source_candidates' };

    let selectedSource: string | null = null;
    let lastTriedSource: string | null = null;
    let contentType: string | null = null;
    let bytes: Uint8Array | null = null;
    let fetchError = 'fetch_failed';

    for (const sourceUrl of sources) {
        lastTriedSource = sourceUrl;
        try {
            const res = await fetch(sourceUrl);
            if (!res.ok) {
                fetchError = `fetch_http_${res.status}`;
                continue;
            }
            contentType = res.headers.get('content-type');
            const arrayBuffer = await res.arrayBuffer();
            bytes = new Uint8Array(arrayBuffer);
            selectedSource = sourceUrl;
            break;
        } catch (error: any) {
            fetchError = error?.message || 'fetch_exception';
        }
    }

    if (!bytes || !selectedSource) {
        return { url: null, error: fetchError, sourceUrl: lastTriedSource || undefined };
    }

    const ext = extFromContentType(contentType);
    const filePath = `${movieId}/${size}.${ext}`;

    const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, bytes, {
            contentType: contentType || 'image/jpeg',
            cacheControl: '31536000',
            upsert: true
        });

    if (error) {
        return { url: null, error: `upload_${error.message}`, sourceUrl: selectedSource };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return { url: data.publicUrl, error: null, sourceUrl: selectedSource };
};

const ensurePosters = async (
    supabase: any,
    bucket: string,
    movie: Movie,
    diagnostics: PosterDiagnostic[]
): Promise<Movie> => {
    if (!movie.posterPath) return movie;
    const latestPosterPath = await fetchLatestPosterPath(movie);
    const effectivePosterPath = latestPosterPath || movie.posterPath;

    const [w500Result, w200Result] = await Promise.all([
        uploadPoster(supabase, bucket, movie.id, effectivePosterPath, 'w500'),
        uploadPoster(supabase, bucket, movie.id, effectivePosterPath, 'w200')
    ]);

    if (w500Result.error) {
        diagnostics.push({
            movieId: movie.id,
            title: movie.title,
            size: 'w500',
            sourceUrl: w500Result.sourceUrl,
            error: w500Result.error
        });
    }

    if (w200Result.error) {
        diagnostics.push({
            movieId: movie.id,
            title: movie.title,
            size: 'w200',
            sourceUrl: w200Result.sourceUrl,
            error: w200Result.error
        });
    }

    return {
        ...movie,
        posterPath: w500Result.url || effectivePosterPath,
        posterStoragePath: w500Result.url || null,
        posterThumbPath: w200Result.url || null,
        posterSource: w500Result.url ? 'storage' : 'tmdb'
    } as Movie & {
        posterStoragePath?: string | null;
        posterThumbPath?: string | null;
        posterSource?: string;
    };
};

const buildDailyTmdbMovies = async (dateKey: string, excludedMovieIds: number[] = []): Promise<Movie[]> => {
    const apiKey = getTmdbApiKey();
    if (!apiKey || apiKey === 'YOUR_TMDB_API_KEY') return [];

    try {
        const genreMap = await fetchTmdbGenreMap(apiKey);
        const poolById = new Map<number, Movie>();
        const slotParams = getSlotParamsForToday();

        for (let slotIndex = 0; slotIndex < slotParams.length; slotIndex += 1) {
            const results = await fetchTmdbDiscoverForSlot(apiKey, dateKey, slotParams[slotIndex], slotIndex);
            for (const result of results) {
                const mapped = mapTmdbResultToMovie(result, genreMap);
                if (!mapped) continue;
                if (!poolById.has(mapped.id)) {
                    poolById.set(mapped.id, mapped);
                }
            }
        }

        if (poolById.size < 30) {
            for (let idx = 0; idx < TMDB_FALLBACK_DISCOVER_PARAMS.length; idx += 1) {
                const fallbackResults = await fetchTmdbDiscoverForSlot(
                    apiKey,
                    dateKey,
                    TMDB_FALLBACK_DISCOVER_PARAMS[idx],
                    100 + idx
                );
                for (const result of fallbackResults) {
                    const mapped = mapTmdbResultToMovie(result, genreMap);
                    if (!mapped) continue;
                    if (!poolById.has(mapped.id)) {
                        poolById.set(mapped.id, mapped);
                    }
                }
            }
        }

        const fullPool = Array.from(poolById.values()).filter(isMovieEligibleForDaily);
        const excludedSet = new Set(normalizeMovieIds(excludedMovieIds));
        const pool = fullPool.filter((movie) => !excludedSet.has(movie.id));
        if (pool.length < DAILY_MOVIE_COUNT) return [];

        const random = createSeededRandom(hashString(`daily-cron:${dateKey}`));
        for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        let selected = pickWithDirectorLimit(pool);
        selected = replaceMovie(
            selected,
            pool,
            (movie) => movie.year < CLASSIC_YEAR_THRESHOLD,
            (movie) => movie.year >= CLASSIC_YEAR_THRESHOLD
        );
        selected = replaceMovie(
            selected,
            pool,
            (movie) => movie.year >= MODERN_YEAR_THRESHOLD,
            (movie, snapshot) => {
                if (movie.year >= CLASSIC_YEAR_THRESHOLD) return true;
                return snapshot.filter((item) => item.year < CLASSIC_YEAR_THRESHOLD).length > 1;
            }
        );
        selected = enforceGenreDiversity(selected, pool);

        if (selected.length >= DAILY_MOVIE_COUNT) {
            selected = await enrichSelectionWithCredits(selected.slice(0, DAILY_MOVIE_COUNT), pool, apiKey);
            if (isSelectionEligibleForDaily(selected)) {
                return applySlotStyles(selected).filter(isMovieEligibleForDaily);
            }
        }

        const fallbackSelection = await buildFallbackSelectionFromPool(pool, apiKey);
        if (fallbackSelection.length < DAILY_MOVIE_COUNT) return [];
        return applySlotStyles(fallbackSelection).filter(isMovieEligibleForDaily);
    } catch (error) {
        console.warn('[daily-cron] dynamic tmdb pool failed', error);
        return [];
    }
};

export default async function handler(req: any, res: any) {
    try {
        console.log('[daily-cron] start');
        const ping = getQueryParam(req, 'ping');
        const envCheck = getQueryParam(req, 'env');
        const debug = getQueryParam(req, 'debug') === '1';
        const mode = normalizeText(getQueryParam(req, 'mode') || 'publish', 24).toLowerCase();
        if (ping === '1') {
            return sendJson(res, 200, {
                ok: true,
                runtime: 'node',
                time: new Date().toISOString(),
                timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED
            });
        }
        if (envCheck === '1') {
            const serviceRoleKey = getSupabaseServiceRoleKey();
            return sendJson(res, 200, {
                ok: true,
                hasSupabaseUrl: !!getSupabaseUrl(),
                hasServiceKey: !!serviceRoleKey,
                serviceRoleClaim: decodeJwtRole(serviceRoleKey),
                hasTmdbApiKey: !!getTmdbApiKey(),
                hasBucket: !!process.env.SUPABASE_STORAGE_BUCKET,
                hasCronSecret: !!process.env.CRON_SECRET || !!process.env.VERCEL_CRON_SECRET
            });
        }
        if (mode !== 'publish' && mode !== 'prepare') {
            return sendJson(res, 400, { error: 'Unsupported mode.', mode });
        }
        const secret = getCronSecret();
        if (secret) {
            // Accept secret only via Authorization Bearer header — not as a query param.
            const auth = getHeader(req, 'authorization');
            if (auth !== `Bearer ${secret}`) {
                console.warn('[daily-cron] unauthorized');
                return sendJson(res, 401, { error: 'Unauthorized' });
            }
        }

        const supabaseUrl = getSupabaseUrl();
        const supabaseServiceKey = getSupabaseServiceRoleKey();
        if (!supabaseUrl) throw new Error('Missing env: SUPABASE_URL');
        if (!supabaseServiceKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
        const role = decodeJwtRole(supabaseServiceKey);
        if (role && role !== 'service_role') {
            throw new Error(`SUPABASE_SERVICE_ROLE_KEY role is '${role}', expected 'service_role'`);
        }
        console.log('[daily-cron] env ok');
        const useRawSupabaseRest = isSupabaseSecretApiKey(supabaseServiceKey);
        const supabase = useRawSupabaseRest
            ? null
            : createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);

        const bucket = getBucketName();
        console.log('[daily-cron] bucket', bucket);
        if (supabase) {
            await ensureBucket(supabase, bucket);
        }
        const requestedDateKey = getQueryParam(req, 'date');
        const targetDateKey = isValidDateKey(requestedDateKey)
            ? requestedDateKey
            : mode === 'prepare'
                ? getQuizTargetDateKey(1)
                : getDailyDateKey();
        const cooldownStartKey = getDateKeyDaysAgo(targetDateKey, DAILY_REPEAT_COOLDOWN_DAYS);
        const forceValue = getQueryParam(req, 'force');
        const force = forceValue === '1' || forceValue === 'true';
        let cooldownMovieIds: number[] = [];

        let recentRows: any[] = [];
        if (useRawSupabaseRest) {
            try {
                recentRows = await readDailyShowcaseRowsViaRest(supabaseUrl, supabaseServiceKey, {
                    gteDate: cooldownStartKey,
                    ltDate: targetDateKey
                });
            } catch (error) {
                console.warn('[daily-cron] recent cooldown read failed', error);
            }
        } else {
            const serviceSupabase = supabase;
            if (!serviceSupabase) {
                throw new Error('Missing Supabase service client.');
            }
            const { data, error: recentRowsError } = await serviceSupabase
                .from('daily_showcase')
                .select('date,movies')
                .gte('date', cooldownStartKey)
                .lt('date', targetDateKey)
                .limit(120);

            if (recentRowsError && recentRowsError.code !== 'PGRST116') {
                console.warn('[daily-cron] recent cooldown read failed', recentRowsError.message);
            }
            recentRows = Array.isArray(data) ? data : [];
        }
        if (Array.isArray(recentRows)) {
            cooldownMovieIds = normalizeMovieIds(
                recentRows.flatMap((row: any) => {
                    const rowMovies = Array.isArray(row?.movies) ? row.movies : [];
                    return rowMovies
                        .map((movie: any) => Number((movie as Partial<Movie>)?.id))
                        .filter((id: number) => Number.isInteger(id) && id > 0);
                })
            );
        }

        let existing: any = null;
        if (useRawSupabaseRest) {
            try {
                existing = await readDailyShowcaseEntryViaRest(supabaseUrl, supabaseServiceKey, targetDateKey);
            } catch (error) {
                return sendJson(res, 500, {
                    error: error instanceof Error ? error.message : 'Daily showcase read failed.'
                });
            }
        } else {
            const serviceSupabase = supabase;
            if (!serviceSupabase) {
                throw new Error('Missing Supabase service client.');
            }
            const { data, error: readError } = await serviceSupabase
                .from('daily_showcase')
                .select('*')
                .eq('date', targetDateKey)
                .single();

            if (readError && readError.code !== 'PGRST116') {
                return sendJson(res, 500, { error: readError.message });
            }
            existing = data;
        }

        const existingMovies = Array.isArray(existing?.movies)
            ? (existing.movies as Movie[]).map((movie) => movie as Movie)
            : [];
        const cooldownMovieIdSet = new Set(cooldownMovieIds);
        const existingMoviesEligible =
            isSelectionEligibleForDaily(existingMovies) &&
            !existingMovies.some((movie) => cooldownMovieIdSet.has(movie.id));

        const preparedBatchResult = !force
            ? await readPreparedDailyQuizMovies(targetDateKey)
            : null;
        const preparedMovies =
            preparedBatchResult && preparedBatchResult.ok
                ? (preparedBatchResult.movies as Movie[])
                : [];
        const preparedMoviesEligible =
            preparedMovies.length > 0 &&
            isSelectionEligibleForDaily(preparedMovies) &&
            !preparedMovies.some((movie) => cooldownMovieIdSet.has(movie.id));

        let movieSource: 'prepared_quiz_batch' | 'existing_daily_showcase' | 'dynamic_tmdb' =
            preparedMoviesEligible
                ? 'prepared_quiz_batch'
                : existingMoviesEligible && !force
                    ? 'existing_daily_showcase'
                    : 'dynamic_tmdb';
        let cooldownPolicy: 'strict' | 'relaxed' = 'strict';
        let movies: Movie[] = preparedMoviesEligible
            ? preparedMovies
            : !force && existingMoviesEligible
                ? existingMovies
                : [];
        if (movies.length === 0) {
            const dynamicMovies = await buildDailyTmdbMovies(targetDateKey, cooldownMovieIds);
            movies = dynamicMovies.slice(0, DAILY_MOVIE_COUNT);
            movieSource = 'dynamic_tmdb';
            const strictSelectionValid =
                isSelectionEligibleForDaily(movies) &&
                !movies.some((movie) => cooldownMovieIdSet.has(movie.id));
            if (!strictSelectionValid && cooldownMovieIds.length > 0) {
                const relaxedMovies = await buildDailyTmdbMovies(targetDateKey);
                const candidateMovies = relaxedMovies.slice(0, DAILY_MOVIE_COUNT);
                if (isSelectionEligibleForDaily(candidateMovies)) {
                    movies = candidateMovies;
                    cooldownPolicy = 'relaxed';
                }
            }
        }
        if (
            !isSelectionEligibleForDaily(movies) ||
            (cooldownPolicy === 'strict' && movies.some((movie) => cooldownMovieIdSet.has(movie.id)))
        ) {
            return sendJson(res, 503, {
                error: 'No eligible TMDB movies found for constraints',
                date: targetDateKey,
                mode,
                timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
                cooldownPolicy
            });
        }
        const diagnostics: PosterDiagnostic[] = [];
        let storageBackedCount = 0;
        let allStorageBacked = false;
        let publishQuizSummary: { status: string; questionCount: number } = {
            status: 'source_only',
            questionCount: 0
        };

        if (mode === 'prepare') {
            const sourceStageResult = await stageDailyQuizSourceBatch({
                dateKey: targetDateKey,
                movies,
                status: 'prepared',
                metadata: {
                    source: movieSource,
                    sourceOnly: true,
                    cooldownPolicy
                }
            });
            if (!sourceStageResult.ok) {
                return sendJson(res, sourceStageResult.status || 500, {
                    ok: false,
                    mode,
                    date: targetDateKey,
                    timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
                    source: movieSource,
                    error: sourceStageResult.error
                });
            }

            let questionCount = 0;
            let sourceModel = 'source-only';
            let reused = false;
            let quizGenerationError: string | null = null;
            if (hasDailyQuizProviderConfig()) {
                const prepareResult = await prepareDailyQuizBatch({
                    dateKey: targetDateKey,
                    movies,
                    force
                });
                if (prepareResult.ok) {
                    questionCount = prepareResult.questionCount;
                    sourceModel = prepareResult.sourceModel;
                    reused = prepareResult.reused;
                } else {
                    quizGenerationError = prepareResult.error;
                }
            }

            return sendJson(res, 200, {
                ok: true,
                mode,
                prepared: true,
                reused,
                date: targetDateKey,
                timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
                source: movieSource,
                cooldownPolicy,
                count: movies.length,
                storageBackedCount,
                allStorageBacked,
                questionCount,
                sourceModel,
                quizGeneration: quizGenerationError ? 'failed' : questionCount > 0 ? 'ready' : 'skipped',
                quizGenerationError,
                ...(debug
                    ? {
                          diagnosticsCount: diagnostics.length,
                          diagnostics: diagnostics.slice(0, 10)
                      }
                    : {})
            });
        }

        if (useRawSupabaseRest) {
            try {
                await upsertDailyShowcaseViaRest(supabaseUrl, supabaseServiceKey, targetDateKey, movies);
            } catch (error) {
                return sendJson(res, 500, {
                    error: error instanceof Error ? error.message : 'Daily showcase upsert failed.'
                });
            }

            try {
                await setCachedDailyMovies(targetDateKey, movies);
            } catch (cacheError) {
                console.warn('[daily-cron] cache refresh failed', cacheError);
            }

            await stageDailyQuizSourceBatch({
                dateKey: targetDateKey,
                movies,
                status: 'published',
                metadata: {
                    source: movieSource,
                    sourceOnly: true,
                    cooldownPolicy
                }
            });

            // Sync daily quiz questions to the question pool
            try {
                const poolSync = await syncDailyQuestionsToPool(targetDateKey);
                console.log(`[daily-cron] pool sync (rest path): ${poolSync.synced} questions`);
            } catch (poolSyncError) {
                console.warn('[daily-cron] pool sync failed (rest path)', poolSyncError);
            }
        } else {
            movies = await Promise.all(movies.map((movie) => ensurePosters(supabase, bucket, movie, diagnostics)));

            storageBackedCount = movies.filter(
                (movie) =>
                    typeof movie.posterPath === 'string' &&
                    movie.posterPath.includes('/storage/v1/object/public/')
            ).length;
            allStorageBacked = storageBackedCount === movies.length;

            const reusedExistingShowcase =
                movieSource === 'existing_daily_showcase' &&
                existingMoviesEligible &&
                allStorageBacked &&
                !force;
            if (reusedExistingShowcase) {
                const publishResult = await publishDailyQuizBatch({
                    dateKey: targetDateKey,
                    movies
                });
                if (!publishResult.ok) {
                    return sendJson(res, publishResult.status || 500, {
                        ok: false,
                        mode,
                        date: targetDateKey,
                        timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
                        source: movieSource,
                        error: publishResult.error
                    });
                }

                return sendJson(res, 200, {
                    ok: true,
                    mode,
                    reused: true,
                    updated: false,
                    date: targetDateKey,
                    timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
                    source: movieSource,
                    cooldownPolicy,
                    count: movies.length,
                    storageBackedCount,
                    allStorageBacked,
                    quiz: {
                        status: publishResult.batchStatus,
                        questionCount: publishResult.questionCount
                    }
                });
            }

            const extraMovies = EXTRA_POSTER_CACHE_MOVIES.filter(
                (extraMovie) => !movies.some((movie) => movie.id === extraMovie.id)
            );
            if (extraMovies.length > 0) {
                await Promise.all(extraMovies.map((movie) => ensurePosters(supabase, bucket, movie, diagnostics)));
            }

            const serviceSupabase = supabase;
            if (!serviceSupabase) {
                throw new Error('Missing Supabase service client.');
            }
            const { error: upsertError } = await serviceSupabase
                .from('daily_showcase')
                .upsert({ date: targetDateKey, movies }, { onConflict: 'date' });

            if (upsertError) {
                return sendJson(res, 500, { error: upsertError.message });
            }

            try {
                await setCachedDailyMovies(targetDateKey, movies);
            } catch (cacheError) {
                console.warn('[daily-cron] cache refresh failed', cacheError);
            }

            const publishResult = await publishDailyQuizBatch({
                dateKey: targetDateKey,
                movies
            });
            if (!publishResult.ok) {
                return sendJson(res, publishResult.status || 500, {
                    ok: false,
                    mode,
                    date: targetDateKey,
                    timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
                    source: movieSource,
                    error: publishResult.error
                });
            }
            publishQuizSummary = {
                status: publishResult.batchStatus,
                questionCount: publishResult.questionCount
            };

            // Sync daily quiz questions to the question pool
            try {
                const poolSync = await syncDailyQuestionsToPool(targetDateKey);
                console.log(`[daily-cron] pool sync: ${poolSync.synced} questions`);
            } catch (poolSyncError) {
                console.warn('[daily-cron] pool sync failed', poolSyncError);
            }
        }

        let dailyPushSummary: {
            status: 'sent' | 'skipped' | 'error';
            message: string;
            targetedUserCount: number;
            sentCount: number;
            ticketCount: number;
            errorCount: number;
        } = {
            status: 'skipped',
            message: 'Gunluk push gonderilmedi.',
            targetedUserCount: 0,
            sentCount: 0,
            ticketCount: 0,
            errorCount: 0
        };

        try {
            const pushConfig = getSupabasePushConfig();
            if (!pushConfig) {
                dailyPushSummary = {
                    ...dailyPushSummary,
                    status: 'error',
                    message: 'Push env config eksik.'
                };
            } else {
                const audienceResult = await readAllPushAudiences(pushConfig);
                if (!audienceResult.ok) {
                    dailyPushSummary = {
                        ...dailyPushSummary,
                        status: 'error',
                        message: audienceResult.error
                    };
                } else if (audienceResult.audiences.length === 0) {
                    dailyPushSummary = {
                        ...dailyPushSummary,
                        message: 'Kayitli mobil push kitlesi bulunamadi.'
                    };
                } else {
                    const pushPreview = movies
                        .slice(0, 2)
                        .map((movie) => movie.title)
                        .filter(Boolean)
                        .join(' / ');
                    const pushBody = pushPreview
                        ? `Gunun 5 yeni filmi aciklandi. ${pushPreview} ile baslayabilirsin.`
                        : 'Gunun 5 yeni filmi aciklandi.';
                    const messages = audienceResult.audiences.flatMap((audience) =>
                        audience.tokens.map((token) => ({
                            to: token,
                            title: 'Gunun 5 yeni filmi yayinda',
                            body: pushBody,
                            sound: 'default' as const,
                            data: {
                                source: 'daily_cron',
                                kind: 'daily_drop',
                                deepLink: 'absolutecinema://open?target=daily',
                                sentAt: new Date().toISOString()
                            }
                        }))
                    );
                    const pushResult = await sendExpoPushMessages(messages);
                    if (!pushResult.ok) {
                        dailyPushSummary = {
                            status: 'error',
                            message: pushResult.error,
                            targetedUserCount: audienceResult.audiences.length,
                            sentCount: messages.length,
                            ticketCount: pushResult.ticketCount,
                            errorCount: pushResult.errorCount
                        };
                    } else {
                        dailyPushSummary = {
                            status: 'sent',
                            message: 'Gunluk push gonderildi.',
                            targetedUserCount: audienceResult.audiences.length,
                            sentCount: messages.length,
                            ticketCount: pushResult.ticketCount,
                            errorCount: pushResult.errorCount
                        };
                    }
                }
            }
        } catch (pushError: any) {
            dailyPushSummary = {
                ...dailyPushSummary,
                status: 'error',
                message: pushError?.message || 'Gunluk push gonderimi beklenmedik sekilde basarisiz oldu.'
            };
        }

        return sendJson(res, 200, {
            ok: true,
            mode,
            updated: true,
            date: targetDateKey,
            timezone: DAILY_ROLLOVER_TIMEZONE_RESOLVED,
            source: movieSource,
            cooldownPolicy,
            count: movies.length,
            storageBackedCount,
            allStorageBacked: storageBackedCount === movies.length,
            quiz: publishQuizSummary,
            push: dailyPushSummary,
            ...(debug
                ? {
                      diagnosticsCount: diagnostics.length,
                      diagnostics: diagnostics.slice(0, 10)
                  }
                : {})
        });
    } catch (error: any) {
        console.error('[daily-cron] error', error);
        return sendJson(res, 500, { error: error.message || 'Unexpected error' });
    }
}

