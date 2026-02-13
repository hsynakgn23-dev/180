import { useEffect, useMemo, useState } from 'react';
import { TMDB_SEEDS } from '../data/tmdbSeeds';
import { DAILY_SLOTS, FALLBACK_GRADIENTS } from '../data/dailyConfig';
import type { Movie } from '../data/mockMovies';
import { supabase, isSupabaseLive } from '../lib/supabase';

type LooseMovie = Partial<Movie> & {
    poster_path?: string;
    posterURL?: string;
    poster_url?: string;
};

interface UseDailyMoviesOptions {
    excludedMovieIds?: number[];
    excludedMovieTitles?: string[];
    personalizationSeed?: string;
}

const DAILY_CACHE_KEY = 'DAILY_SELECTION_V18';
const DAILY_CANDIDATE_CACHE_KEY = 'DAILY_CANDIDATE_POOL_V2';
const DAILY_MOVIE_COUNT = 5;
const DAILY_MIN_UNIQUE_GENRES = 4;
const CLASSIC_YEAR_THRESHOLD = 2000;
const MODERN_YEAR_THRESHOLD = 2010;
const DAILY_MAX_MOVIES_PER_DIRECTOR = 1;
const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_DISCOVER_PAGE_WINDOW = 20;
const TMDB_SLOT_PAGE_COUNT = 2;
const DEFAULT_DAILY_ROLLOVER_TIMEZONE = 'Europe/Istanbul';
const DAILY_ROLLOVER_TIMEZONE = (
    import.meta.env.VITE_DAILY_ROLLOVER_TIMEZONE || DEFAULT_DAILY_ROLLOVER_TIMEZONE
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

const TMDB_MIN_VOTE_AVERAGE = 6.5;
const TMDB_MIN_VOTE_COUNT = 700;
const TMDB_MIN_POPULARITY = 10;
const TMDB_MIN_RUNTIME_MINUTES = 60;
const TMDB_EXCLUDED_GENRE_IDS = new Set<number>([99]);
const TMDB_FALLBACK_DISCOVER_PARAMS = [
    '&vote_average.gte=6.5&vote_count.gte=1200&sort_by=vote_count.desc',
    '&vote_average.gte=6.5&vote_count.gte=900&sort_by=popularity.desc',
    '&vote_average.gte=6.5&vote_count.gte=1200&sort_by=vote_average.desc'
];
const LEGACY_SEED_ID_SET = new Set<number>(TMDB_SEEDS.map((movie) => movie.id));

const getDailyDateKey = (): string => getDateKeyFromFormatter(new Date(), DAILY_DATE_FORMATTER);

const getPreviousDateKey = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part));
    const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    date.setUTCDate(date.getUTCDate() - 1);
    const prevYear = date.getUTCFullYear();
    const prevMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const prevDay = String(date.getUTCDate()).padStart(2, '0');
    return `${prevYear}-${prevMonth}-${prevDay}`;
};
const readDailyShowcaseFromPublic = async (dateKey: string): Promise<Movie[] | null> => {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!supabaseUrl || !anonKey) return null;

    try {
        const endpoint = `${supabaseUrl}/rest/v1/daily_showcase?select=movies&date=eq.${encodeURIComponent(dateKey)}&limit=1`;
        const response = await fetch(endpoint, {
            headers: {
                apikey: anonKey,
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
    return DAILY_SLOTS.map((slot) => slot.params.replace('2024-01-01', modernFloor));
};

const uniqueMoviesById = (movies: Movie[]): Movie[] => {
    return Array.from(new Map(movies.map((movie) => [movie.id, movie])).values());
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

const fetchTmdbGenreMap = async (apiKey: string): Promise<Map<number, string>> => {
    const params = new URLSearchParams({
        api_key: apiKey,
        language: 'en-US'
    });
    const response = await fetch(`${TMDB_API_BASE}/genre/movie/list?${params.toString()}`);
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
    return genreMap;
};

const fetchTmdbDiscoverForSlot = async (
    apiKey: string,
    dateKey: string,
    slotParams: string,
    slotIndex: number
): Promise<TmdbDiscoverMovie[]> => {
    const parsedSlotParams = parseSlotParams(slotParams);
    const basePage = (hashString(`slot:${dateKey}:${slotIndex}`) % TMDB_DISCOVER_PAGE_WINDOW) + 1;
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

        parsedSlotParams.forEach((value, key) => {
            params.set(key, value);
        });
        enforceDiscoverQualityFilters(params);

        const response = await fetch(`${TMDB_API_BASE}/discover/movie?${params.toString()}`);
        if (!response.ok) continue;

        const payload = (await response.json()) as { results?: TmdbDiscoverMovie[] };
        if (Array.isArray(payload.results)) {
            results.push(...payload.results);
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
        director: 'Unknown',
        year: parseYearFromDate(result.release_date),
        genre: genres.join('/') || 'Drama',
        tagline: '',
        color: FALLBACK_GRADIENTS[0],
        posterPath,
        voteAverage: voteAverage || undefined,
        overview: typeof result.overview === 'string' ? result.overview : undefined,
        originalLanguage: typeof result.original_language === 'string' ? result.original_language : undefined
    };
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

const applySlotStyles = (movies: Movie[]): Movie[] => {
    return movies.map((movie, index) => ({
        ...movie,
        slotLabel: DAILY_SLOTS[index]?.label,
        color: FALLBACK_GRADIENTS[index] || movie.color
    }));
};

const pickWithDirectorLimit = (pool: Movie[]): Movie[] => {
    const selected: Movie[] = [];
    const directorCounts = new Map<string, number>();

    for (const movie of pool) {
        const directorKey = (movie.director || '').trim().toLowerCase();
        const count = directorCounts.get(directorKey) || 0;
        if (directorKey && count >= DAILY_MAX_MOVIES_PER_DIRECTOR) {
            continue;
        }
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

const buildDailyTmdbMovies = async (
    dateKey: string,
    apiKey: string,
    excludedMovieIds: number[] = []
): Promise<{ selected: Movie[]; pool: Movie[] }> => {
    if (!apiKey || apiKey === 'YOUR_TMDB_API_KEY') return { selected: [], pool: [] };

    try {
        const genreMap = await fetchTmdbGenreMap(apiKey);
        const poolById = new Map<number, Movie>();
        const slotParamsForToday = getSlotParamsForToday();

        for (let slotIndex = 0; slotIndex < slotParamsForToday.length; slotIndex += 1) {
            const slotParams = slotParamsForToday[slotIndex];
            const results = await fetchTmdbDiscoverForSlot(apiKey, dateKey, slotParams, slotIndex);
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
        const filteredPool = fullPool.filter((movie) => !excludedSet.has(movie.id));
        const pool = filteredPool.length >= DAILY_MOVIE_COUNT ? filteredPool : fullPool;
        if (pool.length < DAILY_MOVIE_COUNT) return { selected: [], pool: fullPool };

        const random = createSeededRandom(hashString(`daily-tmdb:${dateKey}`));
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

        if (selected.length < DAILY_MOVIE_COUNT) {
            return { selected: [], pool: fullPool };
        }
        return {
            selected: applySlotStyles(selected.slice(0, DAILY_MOVIE_COUNT)).filter(isMovieEligibleForDaily),
            pool: fullPool
        };
    } catch (error) {
        console.warn('[Daily5] TMDB dynamic pool failed.', error);
        return { selected: [], pool: [] };
    }
};

const normalizeMovie = (input: unknown): Movie => {
    if (!input || typeof input !== 'object') {
        return input as Movie;
    }
    const movie = input as LooseMovie;
    const posterPath = movie.posterPath ?? movie.poster_path ?? movie.posterURL ?? movie.poster_url;
    return { ...(movie as Movie), posterPath };
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

const normalizeMovieTitleKey = (value: string): string => {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
};

const normalizeMovieTitles = (movieTitles: string[] = []): string[] => {
    return Array.from(
        new Set(
            movieTitles
                .map((value) => normalizeMovieTitleKey(String(value || '')))
                .filter(Boolean)
        )
    );
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
const buildPersonalizedDailyMovies = (
    baseMovies: Movie[],
    candidateMovies: Movie[],
    excludedMovieIds: number[],
    excludedMovieTitles: string[],
    dateKey: string,
    personalizationSeed: string
): Movie[] => {
    const base = baseMovies.slice(0, DAILY_MOVIE_COUNT);
    if (base.length === 0) return [];

    const excludedSet = new Set(normalizeMovieIds(excludedMovieIds));
    const excludedTitleSet = new Set(normalizeMovieTitles(excludedMovieTitles));
    if (excludedSet.size === 0 && excludedTitleSet.size === 0) return applySlotStyles(base);

    const replacementPool = uniqueMoviesById(candidateMovies).filter(isMovieEligibleForDaily);
    const baseMovieIds = new Set(base.map((movie) => movie.id));
    const random = createSeededRandom(hashString(`daily-user:${dateKey}:${personalizationSeed}`));

    const isExcluded = (movie: Movie): boolean => {
        if (excludedSet.has(movie.id)) return true;
        const titleKey = normalizeMovieTitleKey(movie.title || '');
        return Boolean(titleKey && excludedTitleSet.has(titleKey));
    };

    for (let i = replacementPool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [replacementPool[i], replacementPool[j]] = [replacementPool[j], replacementPool[i]];
    }

    const usedMovieIds = new Set<number>();
    const availableReplacements = replacementPool.filter(
        (movie) => !isExcluded(movie) && !baseMovieIds.has(movie.id)
    );

    const personalized = base.map((movie) => {
        if (!isExcluded(movie) && !usedMovieIds.has(movie.id)) {
            usedMovieIds.add(movie.id);
            return movie;
        }

        const replacement = availableReplacements.find((candidate) => !usedMovieIds.has(candidate.id));
        if (!replacement) {
            usedMovieIds.add(movie.id);
            return movie;
        }

        usedMovieIds.add(replacement.id);
        return replacement;
    });

    return applySlotStyles(personalized);
};

export const useDailyMovies = ({
    excludedMovieIds = [],
    excludedMovieTitles = [],
    personalizationSeed = 'guest'
}: UseDailyMoviesOptions = {}) => {
    const [baseMovies, setBaseMovies] = useState<Movie[]>([]);
    const [candidateMovies, setCandidateMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateKey, setDateKey] = useState<string>(getDailyDateKey);

    useEffect(() => {
        let dateKeyTimer: number | null = null;

        const syncDateKey = () => {
            const nextDateKey = getDailyDateKey();
            setDateKey((prev) => (prev === nextDateKey ? prev : nextDateKey));
        };

        const scheduleDateKeyTick = () => {
            const nowMs = Date.now();
            const waitMs = Math.max(500, 60000 - (nowMs % 60000) + 200);
            dateKeyTimer = window.setTimeout(() => {
                syncDateKey();
                scheduleDateKeyTick();
            }, waitMs);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                syncDateKey();
            }
        };

        syncDateKey();
        scheduleDateKeyTick();
        window.addEventListener('focus', syncDateKey);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (dateKeyTimer !== null) {
                window.clearTimeout(dateKeyTimer);
            }
            window.removeEventListener('focus', syncDateKey);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    useEffect(() => {
        const fetchDaily5 = async () => {
            setLoading(true);
            const todayKey = dateKey;
            const previousKey = getPreviousDateKey(todayKey);
            const isDev = import.meta.env.DEV;
            // Client write path is restricted to local/dev. Production write source should be cron/service role.
            const allowClientDailyWrite =
                isDev && import.meta.env.VITE_ALLOW_CLIENT_DAILY_WRITE === '1';
            const apiKey = import.meta.env.VITE_TMDB_API_KEY;
            const isClientTmdbDisabled = import.meta.env.VITE_TMDB_API_DISABLED === '1';
            let previousGlobalMovieIds: number[] = [];

            const applyCandidateCache = () => {
                const cachedPool = localStorage.getItem(DAILY_CANDIDATE_CACHE_KEY);
                if (!cachedPool) return false;
                try {
                    const parsed = JSON.parse(cachedPool) as { date?: string; movies?: unknown[] };
                    if (parsed?.date !== todayKey) return false;
                    const cachedMovies = Array.isArray(parsed?.movies) ? parsed.movies : [];
                    if (cachedMovies.length === 0) return false;
                    const normalized = uniqueMoviesById(cachedMovies.map((m) => normalizeMovie(m))).filter(
                        isMovieEligibleForDaily
                    );
                    if (normalized.length === 0) return false;
                    setCandidateMovies(normalized);
                    return true;
                } catch {
                    localStorage.removeItem(DAILY_CANDIDATE_CACHE_KEY);
                    return false;
                }
            };

            const updateCandidatePool = (movies: Movie[]) => {
                const normalized = uniqueMoviesById(movies.map((movie) => normalizeMovie(movie))).filter(
                    isMovieEligibleForDaily
                );
                if (!normalized.length) return;
                setCandidateMovies(normalized);
                localStorage.setItem(
                    DAILY_CANDIDATE_CACHE_KEY,
                    JSON.stringify({ date: todayKey, movies: normalized })
                );
            };

            // 1. SUPABASE STRATEGY (The Absolute Source)
            if (isSupabaseLive() && supabase) {
                if (isDev) {
                    console.log('[Daily5] Checking Supabase for global sync...');
                }

                try {
                    const { data: previousData } = await supabase
                        .from('daily_showcase')
                        .select('movies')
                        .eq('date', previousKey)
                        .maybeSingle();
                    const previousMovies = Array.isArray(previousData?.movies) ? previousData.movies : [];
                    previousGlobalMovieIds = normalizeMovieIds(
                        previousMovies
                            .map((movie) => normalizeMovie(movie).id)
                            .filter((id): id is number => Number.isInteger(id) && id > 0)
                    );

                    if (previousGlobalMovieIds.length === 0) {
                        const previousPublicMovies = await readDailyShowcaseFromPublic(previousKey);
                        if (previousPublicMovies?.length) {
                            previousGlobalMovieIds = normalizeMovieIds(previousPublicMovies.map((movie) => movie.id));
                        }
                    }

                    // a) READ from DB
                    const { data, error } = await supabase
                        .from('daily_showcase')
                        .select('*')
                        .eq('date', todayKey)
                        .maybeSingle();

                    if (data && data.movies) {
                        const fromDb = Array.isArray(data.movies) ? (data.movies as unknown[]) : [];
                        const normalized = fromDb
                            .map((m: unknown) => normalizeMovie(m))
                            .filter(isMovieEligibleForDaily);
                        const isEligibleSelection =
                            normalized.length === DAILY_MOVIE_COUNT &&
                            !isLegacySeedSelection(normalized);

                        if (isEligibleSelection) {
                            if (isDev) {
                                console.log('[Daily5] Sync successful. Using global daily selection.');
                            }
                            setBaseMovies(normalized);
                            if (!applyCandidateCache() && !isClientTmdbDisabled && apiKey && apiKey !== 'YOUR_TMDB_API_KEY') {
                                void buildDailyTmdbMovies(todayKey, apiKey, previousGlobalMovieIds).then((result) => {
                                    if (result.pool.length) {
                                        updateCandidatePool(result.pool);
                                    }
                                });
                            }
                            setLoading(false);
                            return;
                        }

                        if (isDev) {
                            console.log('[Daily5] Existing selection rejected by quality rules. Regenerating...');
                        }
                    }

                    const publicTodayMovies = await readDailyShowcaseFromPublic(todayKey);
                    if (
                        publicTodayMovies?.length === DAILY_MOVIE_COUNT &&
                        !isLegacySeedSelection(publicTodayMovies)
                    ) {
                        setBaseMovies(publicTodayMovies);
                        setLoading(false);
                        return;
                    }
                    if (error && error.code !== 'PGRST116') { // PGRST116 is 'Row not found', which is expected first time
                        console.warn('[Daily5] Supabase Error:', error);
                    }

                    // b) WRITE to DB (First user of the day)
                    // If we are here, DB is empty for today. We must generate the list using our existing logic.
                    if (isDev) {
                        console.log('[Daily5] No entry for today. Generating Global Daily 5...');
                    }
                } catch (err) {
                    console.error('[Daily5] DB Connection failed, falling back to local.', err);
                }
            }

            // --- EXISTING LOGIC STARTS HERE (As Fallback or Generator) ---

            // 2. Check Local Cache (Fallback for offline/no-db)
            const cachedData = localStorage.getItem(DAILY_CACHE_KEY);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData) as { date?: string; movies?: unknown[] };
                    const date = parsed?.date;
                    const cachedMovies = Array.isArray(parsed?.movies) ? parsed.movies : [];
                    if (date === todayKey && cachedMovies.length === DAILY_MOVIE_COUNT) {
                        const normalized = cachedMovies
                            .map((m) => normalizeMovie(m))
                            .filter(isMovieEligibleForDaily);
                        const isEligibleSelection =
                            normalized.length === DAILY_MOVIE_COUNT &&
                            !isLegacySeedSelection(normalized);
                        if (isEligibleSelection) {
                            setBaseMovies(normalized);
                            applyCandidateCache();
                            setLoading(false);
                            return;
                        }
                    }
                } catch {
                    localStorage.removeItem(DAILY_CACHE_KEY);
                }
            }

            let finalMovies: Movie[] = [];

            if (!isClientTmdbDisabled && apiKey && apiKey !== 'YOUR_TMDB_API_KEY') {
                const dynamicResult = await buildDailyTmdbMovies(todayKey, apiKey, previousGlobalMovieIds);
                finalMovies = dynamicResult.selected;
                if (dynamicResult.pool.length) {
                    updateCandidatePool(dynamicResult.pool);
                }
                if (finalMovies.length !== DAILY_MOVIE_COUNT) {
                    const retryResult = await buildDailyTmdbMovies(todayKey, apiKey, []);
                    finalMovies = retryResult.selected;
                    if (retryResult.pool.length) {
                        updateCandidatePool(retryResult.pool);
                    }
                }
            }
            finalMovies = finalMovies.filter(isMovieEligibleForDaily).slice(0, DAILY_MOVIE_COUNT);

            if (finalMovies.length !== DAILY_MOVIE_COUNT && isSupabaseLive() && supabase) {
                try {
                    await fetch('/api/cron/daily');
                    const { data: refreshedData } = await supabase
                        .from('daily_showcase')
                        .select('*')
                        .eq('date', todayKey)
                        .maybeSingle();

                    const refreshedMovies = Array.isArray(refreshedData?.movies)
                        ? (refreshedData.movies as unknown[])
                              .map((movie) => normalizeMovie(movie))
                              .filter(isMovieEligibleForDaily)
                        : [];

                    if (
                        refreshedMovies.length === DAILY_MOVIE_COUNT &&
                        !isLegacySeedSelection(refreshedMovies)
                    ) {
                        finalMovies = refreshedMovies;
                    } else {
                        const publicRefreshedMovies = await readDailyShowcaseFromPublic(todayKey);
                        if (
                            publicRefreshedMovies?.length === DAILY_MOVIE_COUNT &&
                            !isLegacySeedSelection(publicRefreshedMovies)
                        ) {
                            finalMovies = publicRefreshedMovies;
                        }
                    }
                } catch {
                    // noop: if cron endpoint is protected or unavailable, keep current fallback path
                }
            }


            // c) SAVE TO DB (Only when explicitly enabled; cron should be the default writer)
            if (allowClientDailyWrite && isSupabaseLive() && supabase && finalMovies.length === 5) {
                if (isDev) {
                    console.log('[Daily5] Writing generated list to Supabase...');
                }
                const { error: insertError } = await supabase
                    .from('daily_showcase')
                    .upsert([{ date: todayKey, movies: finalMovies }], {
                        onConflict: 'date',
                        ignoreDuplicates: true
                    });

                if (insertError) console.error('[Daily5] Failed to write to DB:', insertError);
            }

            // Local Cache & Set State
            if (finalMovies.length === DAILY_MOVIE_COUNT && !isLegacySeedSelection(finalMovies)) {
                localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ date: todayKey, movies: finalMovies }));
            } else {
                localStorage.removeItem(DAILY_CACHE_KEY);
            }
            setBaseMovies(finalMovies);
            setLoading(false);
        };

        fetchDaily5();
    }, [dateKey]);

    const exclusionKey = normalizeMovieIds(excludedMovieIds).sort((a, b) => a - b).join(',');
    const exclusionTitleKey = normalizeMovieTitles(excludedMovieTitles).sort((a, b) => a.localeCompare(b)).join('|');

    const movies = useMemo(() => {
        return buildPersonalizedDailyMovies(
            baseMovies,
            candidateMovies,
            excludedMovieIds,
            excludedMovieTitles,
            dateKey,
            personalizationSeed
        );
    }, [baseMovies, candidateMovies, dateKey, exclusionKey, exclusionTitleKey, excludedMovieIds, excludedMovieTitles, personalizationSeed]);

    return { movies, loading, dateKey };
};










