/* eslint-disable @typescript-eslint/no-explicit-any */
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
    overview?: string;
    original_language?: string;
    genre_ids?: number[];
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
const DAILY_MIN_UNIQUE_GENRES = 4;
const CLASSIC_YEAR_THRESHOLD = 2000;
const MODERN_YEAR_THRESHOLD = 2010;
const DAILY_MAX_MOVIES_PER_DIRECTOR = 1;
const TMDB_DISCOVER_PAGE_WINDOW = 20;
const TMDB_SLOT_PAGE_COUNT = 2;

const DEFAULT_SLOT_PARAMS = [
    '&vote_average.gte=8.4&vote_count.gte=3000&sort_by=vote_average.desc',
    '&vote_average.gte=7.5&vote_count.gte=50&vote_count.lte=1000&sort_by=popularity.desc',
    '&with_genres=99,36,10752&sort_by=popularity.desc',
    '&primary_release_date.gte=2024-01-01&vote_average.gte=7.0&sort_by=popularity.desc',
    '&vote_average.gte=7.8&with_original_language=ja|ko|fr&sort_by=popularity.desc'
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
    const value = new Date();
    value.setFullYear(value.getFullYear() - 2);
    return value.toISOString().split('T')[0];
};

const getSlotParamsForToday = (): string[] => {
    const modernFloor = getModernFloorDate();
    return DEFAULT_SLOT_PARAMS.map((value) =>
        value.replace('2024-01-01', modernFloor)
    );
};

const getPreviousDateKey = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part));
    const date = new Date(year, (month || 1) - 1, day || 1);
    date.setDate(date.getDate() - 1);
    const prevYear = date.getFullYear();
    const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
    const prevDay = String(date.getDate()).padStart(2, '0');
    return `${prevYear}-${prevMonth}-${prevDay}`;
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
        slotLabel: DEFAULT_SLOT_LABELS[index] || movie.slotLabel,
        color: DEFAULT_GRADIENTS[index] || movie.color
    }));
};

const pickWithDirectorLimit = (pool: Movie[]): Movie[] => {
    const selected: Movie[] = [];
    const directorCounts = new Map<string, number>();

    for (const movie of pool) {
        const directorKey = (movie.director || '').trim().toLowerCase();
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

        const response = await fetch(`${TMDB_API_BASE}/discover/movie?${params.toString()}`);
        if (!response.ok) continue;

        const payload = (await response.json()) as { results?: TmdbDiscoverMovie[] };
        if (Array.isArray(payload.results)) {
            results.push(...payload.results);
        }
    }

    return results;
};

const fetchTmdbListPage = async (
    apiKey: string,
    endpoint: 'popular' | 'top_rated',
    page: number
): Promise<TmdbDiscoverMovie[]> => {
    const params = new URLSearchParams({
        api_key: apiKey,
        language: 'en-US',
        page: String(page)
    });
    const response = await fetch(`${TMDB_API_BASE}/movie/${endpoint}?${params.toString()}`);
    if (!response.ok) return [];
    const payload = (await response.json()) as { results?: TmdbDiscoverMovie[] };
    return Array.isArray(payload.results) ? payload.results : [];
};

const mapTmdbResultToMovie = (result: TmdbDiscoverMovie, genreMap: Map<number, string>): Movie | null => {
    const id = Number(result.id);
    if (!Number.isInteger(id) || id <= 0) return null;

    const title = (result.title || result.name || '').trim();
    if (!title) return null;

    const posterPath = typeof result.poster_path === 'string' ? result.poster_path : '';
    if (!posterPath) return null;

    const genres = (result.genre_ids || [])
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
        color: DEFAULT_GRADIENTS[0],
        posterPath,
        voteAverage: typeof result.vote_average === 'number' ? result.vote_average : undefined,
        overview: typeof result.overview === 'string' ? result.overview : undefined,
        originalLanguage: typeof result.original_language === 'string' ? result.original_language : undefined
    };
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

const buildSeedMovies = (dateKey: string, excludedMovieIds: number[] = []): Movie[] => {
    const excludedSet = new Set(normalizeMovieIds(excludedMovieIds));
    const basePool = [...DEFAULT_SEED_MOVIES];
    for (const extraMovie of EXTRA_POSTER_CACHE_MOVIES) {
        if (!basePool.some((movie) => movie.id === extraMovie.id)) {
            basePool.push(extraMovie);
        }
    }
    const filteredPool = basePool.filter((movie) => !excludedSet.has(movie.id));
    const pool = filteredPool.length >= DAILY_MOVIE_COUNT ? filteredPool : basePool;

    const random = createSeededRandom(hashString(`daily:${dateKey}`));
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

    return applySlotStyles(selected);
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
            const fallbackPage = (hashString(`cron-fallback:${dateKey}`) % TMDB_DISCOVER_PAGE_WINDOW) + 1;
            const [popularResults, topRatedResults] = await Promise.all([
                fetchTmdbListPage(apiKey, 'popular', fallbackPage),
                fetchTmdbListPage(
                    apiKey,
                    'top_rated',
                    ((fallbackPage + 5 - 1) % TMDB_DISCOVER_PAGE_WINDOW) + 1
                )
            ]);

            for (const result of [...popularResults, ...topRatedResults]) {
                const mapped = mapTmdbResultToMovie(result, genreMap);
                if (!mapped) continue;
                if (!poolById.has(mapped.id)) {
                    poolById.set(mapped.id, mapped);
                }
            }
        }

        const fullPool = Array.from(poolById.values());
        const excludedSet = new Set(normalizeMovieIds(excludedMovieIds));
        const filteredPool = fullPool.filter((movie) => !excludedSet.has(movie.id));
        const pool = filteredPool.length >= DAILY_MOVIE_COUNT ? filteredPool : fullPool;
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

        if (selected.length < DAILY_MOVIE_COUNT) return [];
        return applySlotStyles(selected.slice(0, DAILY_MOVIE_COUNT));
    } catch (error) {
        console.warn('[daily-cron] dynamic tmdb pool failed, fallback to seeds', error);
        return [];
    }
};

export default async function handler(req: any, res: any) {
    try {
        console.log('[daily-cron] start');
        const ping = getQueryParam(req, 'ping');
        const envCheck = getQueryParam(req, 'env');
        const debug = getQueryParam(req, 'debug') === '1';
        if (ping === '1') {
            return sendJson(res, 200, { ok: true, runtime: 'node', time: new Date().toISOString() });
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
        const secret = getCronSecret();
        const querySecret = getQueryParam(req, 'secret');
        if (secret) {
            const auth = getHeader(req, 'authorization');
            if (auth !== `Bearer ${secret}` && querySecret !== secret) {
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
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        });

        const bucket = getBucketName();
        console.log('[daily-cron] bucket', bucket);
        await ensureBucket(supabase, bucket);
        const todayKey = new Date().toISOString().split('T')[0];
        const previousKey = getPreviousDateKey(todayKey);
        const forceValue = getQueryParam(req, 'force');
        const force = forceValue === '1' || forceValue === 'true';
        let previousMovieIds: number[] = [];

        const { data: previousData } = await supabase
            .from('daily_showcase')
            .select('movies')
            .eq('date', previousKey)
            .single();

        if (Array.isArray(previousData?.movies)) {
            previousMovieIds = normalizeMovieIds(
                previousData.movies
                    .map((movie: any) => Number((movie as Partial<Movie>)?.id))
                    .filter((id: number) => Number.isInteger(id) && id > 0)
            );
        }

        const { data: existing, error: readError } = await supabase
            .from('daily_showcase')
            .select('*')
            .eq('date', todayKey)
            .single();

        if (readError && readError.code !== 'PGRST116') {
            return sendJson(res, 500, { error: readError.message });
        }

        let movies: Movie[] = Array.isArray(existing?.movies) && !force ? existing.movies : [];
        if (movies.length === 0) {
            const dynamicMovies = await buildDailyTmdbMovies(todayKey, previousMovieIds);
            movies = dynamicMovies.length === DAILY_MOVIE_COUNT
                ? dynamicMovies
                : buildSeedMovies(todayKey, previousMovieIds);
        }
        const diagnostics: PosterDiagnostic[] = [];

        const isStorageBacked = movies.every((m: any) => typeof m.posterPath === 'string' && m.posterPath.includes('/storage/v1/object/public/'));
        if (existing?.movies && isStorageBacked && !force) {
            return sendJson(res, 200, { ok: true, reused: true, date: todayKey });
        }

        movies = await Promise.all(movies.map((movie) => ensurePosters(supabase, bucket, movie, diagnostics)));

        const extraMovies = EXTRA_POSTER_CACHE_MOVIES.filter(
            (extraMovie) => !movies.some((movie) => movie.id === extraMovie.id)
        );
        if (extraMovies.length > 0) {
            await Promise.all(extraMovies.map((movie) => ensurePosters(supabase, bucket, movie, diagnostics)));
        }

        const storageBackedCount = movies.filter(
            (movie) =>
                typeof movie.posterPath === 'string' &&
                movie.posterPath.includes('/storage/v1/object/public/')
        ).length;

        const { error: upsertError } = await supabase
            .from('daily_showcase')
            .upsert({ date: todayKey, movies }, { onConflict: 'date' });

        if (upsertError) {
            return sendJson(res, 500, { error: upsertError.message });
        }

        return sendJson(res, 200, {
            ok: true,
            updated: true,
            date: todayKey,
            count: movies.length,
            storageBackedCount,
            allStorageBacked: storageBackedCount === movies.length,
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
