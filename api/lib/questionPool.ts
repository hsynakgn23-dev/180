import { createSupabaseServiceClient } from './supabaseServiceClient.js';

// ============================================================
// Types
// ============================================================

export type PoolMovie = {
    id: string;
    tmdbId: number;
    title: string;
    posterPath: string | null;
    releaseYear: number | null;
    genre: string | null;
    era: string | null;
    overview: string | null;
    voteAverage: number | null;
    originalLanguage: string | null;
    castNames: string[];
    director: string | null;
    questionCount: number;
};

type DailyPoolMovieMetadata = {
    title: string | null;
    posterPath: string | null;
    releaseYear: number | null;
    genre: string | null;
    era: string | null;
    overview: string | null;
    voteAverage: number | null;
    originalLanguage: string | null;
    castNames: string[];
    director: string | null;
};

type TmdbDiscoverResult = {
    id?: number;
    title?: string;
    poster_path?: string | null;
    release_date?: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    overview?: string;
    original_language?: string;
    genre_ids?: number[];
};

type TmdbMovieDetail = {
    id?: number;
    title?: string;
    poster_path?: string | null;
    release_date?: string;
    vote_average?: number;
    overview?: string;
    original_language?: string;
    tagline?: string;
    genres?: Array<{ id: number; name: string }>;
    runtime?: number;
};

type TmdbCreditsResult = {
    cast?: Array<{ name?: string; order?: number }>;
    crew?: Array<{ name?: string; job?: string; department?: string }>;
};

type PoolQuestionRow = {
    tmdb_movie_id: number;
    movie_id: string;
    question_order: number;
    question_key: string;
    question_translations: Record<string, string>;
    options_translations: Record<string, Record<string, string>>;
    correct_option: string;
    explanation_translations: Record<string, string>;
    difficulty: string;
    source: string;
    metadata: Record<string, unknown>;
};

type BatchRequestItem = {
    custom_id: string;
    params: {
        model: string;
        max_tokens: number;
        temperature: number;
        system: string;
        messages: Array<{ role: string; content: string }>;
    };
};

export type BatchGenerateResult = {
    ok: boolean;
    batchId?: string;
    totalMovies?: number;
    totalBatches?: number;
    error?: string;
};

export type BatchProcessResult = {
    ok: boolean;
    moviesProcessed?: number;
    questionsInserted?: number;
    error?: string;
};

// ============================================================
// Constants
// ============================================================

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_MIN_VOTE_AVERAGE = 6.5;
const TMDB_MIN_VOTE_COUNT = 700;
const TMDB_MIN_POPULARITY = 7;
const TMDB_EXCLUDED_GENRE_IDS = new Set<number>([99]); // Documentary
const TMDB_CAST_LIMIT = 6;
const MOVIES_PER_BATCH = 5;
const QUESTIONS_PER_MOVIE = 5;

// ============================================================
// Env helpers
// ============================================================

const getTmdbApiKey = (): string =>
    String(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '').trim();

const getAnthropicApiKey = (): string =>
    String(process.env.ANTHROPIC_API_KEY || '').trim();

const getAnthropicBatchModel = (): string =>
    String(process.env.ANTHROPIC_DAILY_QUIZ_MODEL || 'claude-sonnet-4-20250514').trim() || 'claude-sonnet-4-20250514';

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const getServiceSupabase = () => {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceRoleKey();
    if (!url || !key) throw new Error('Missing Supabase service config.');
    return createSupabaseServiceClient(url, key);
};

// ============================================================
// Concurrency helpers
// ============================================================

const TMDB_CREDITS_CONCURRENCY = 5;
const POOL_UPSERT_BATCH_SIZE = 50;

async function withConcurrency<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>
): Promise<void> {
    if (items.length === 0) return;
    const queue = [...items];
    const workerCount = Math.min(limit, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (item === undefined) break;
            await fn(item);
        }
    });
    await Promise.all(workers);
}

const normalizeText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(
        new Set(
            value
                .map((item) => normalizeText(item))
                .filter(Boolean)
        )
    );
};

const normalizeVoteAverage = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeReleaseYear = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 1850 ? parsed : null;
};

const readDailyPoolMetadataMovie = (value: unknown): { tmdbId: number; metadata: DailyPoolMovieMetadata } | null => {
    if (!value || typeof value !== 'object') return null;
    const movie = value as Record<string, unknown>;
    const tmdbId = Number(movie.id ?? movie.movieId ?? movie.tmdb_id ?? movie.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;

    const releaseYear = normalizeReleaseYear(movie.year ?? movie.releaseYear ?? movie.release_year);
    const genre = normalizeText(movie.genre) || null;

    return {
        tmdbId,
        metadata: {
            title: normalizeText(movie.title) || null,
            posterPath: normalizeText(movie.posterPath ?? movie.poster_path) || null,
            releaseYear,
            genre,
            era: normalizeText(movie.era) || classifyEra(releaseYear),
            overview: normalizeText(movie.overview) || null,
            voteAverage: normalizeVoteAverage(movie.voteAverage ?? movie.vote_average),
            originalLanguage: normalizeText(movie.originalLanguage ?? movie.original_language) || null,
            castNames: normalizeStringArray(movie.cast ?? movie.castNames ?? movie.cast_names).slice(0, TMDB_CAST_LIMIT),
            director: normalizeText(movie.director) || null,
        }
    };
};

const mergeDailyPoolMetadata = (
    current: DailyPoolMovieMetadata | undefined,
    incoming: DailyPoolMovieMetadata
): DailyPoolMovieMetadata => {
    if (!current) return incoming;
    return {
        title: current.title || incoming.title,
        posterPath: current.posterPath || incoming.posterPath,
        releaseYear: current.releaseYear || incoming.releaseYear,
        genre: current.genre || incoming.genre,
        era: current.era || incoming.era,
        overview: current.overview || incoming.overview,
        voteAverage: current.voteAverage ?? incoming.voteAverage,
        originalLanguage: current.originalLanguage || incoming.originalLanguage,
        castNames: current.castNames.length > 0 ? current.castNames : incoming.castNames,
        director: current.director || incoming.director,
    };
};

const buildDailyPoolMetadataMap = async (
    supabase: ReturnType<typeof getServiceSupabase>,
    batchDate: string
): Promise<Map<number, DailyPoolMovieMetadata>> => {
    const metadataByMovieId = new Map<number, DailyPoolMovieMetadata>();

    const [{ data: batchRow }, { data: showcaseRow }] = await Promise.all([
        supabase
            .from('daily_quiz_batches')
            .select('movies')
            .eq('date', batchDate)
            .maybeSingle(),
        supabase
            .from('daily_showcase')
            .select('movies')
            .eq('date', batchDate)
            .maybeSingle()
    ]);

    for (const sourceRow of [batchRow, showcaseRow]) {
        const movies = Array.isArray((sourceRow as { movies?: unknown[] } | null)?.movies)
            ? ((sourceRow as { movies?: unknown[] }).movies || [])
            : [];
        for (const movie of movies) {
            const parsed = readDailyPoolMetadataMovie(movie);
            if (!parsed) continue;
            metadataByMovieId.set(
                parsed.tmdbId,
                mergeDailyPoolMetadata(metadataByMovieId.get(parsed.tmdbId), parsed.metadata)
            );
        }
    }

    return metadataByMovieId;
};

const buildPoolMovieMetadataPatch = (
    existingMovie: Record<string, unknown> | null | undefined,
    metadata: DailyPoolMovieMetadata | undefined,
    fallbackTitle: string
): Record<string, unknown> => {
    const patch: Record<string, unknown> = {};
    const normalizedTitle = metadata?.title || normalizeText(existingMovie?.title) || fallbackTitle;

    if (!normalizeText(existingMovie?.title) && normalizedTitle) patch.title = normalizedTitle;
    if (!normalizeText(existingMovie?.poster_path) && metadata?.posterPath) patch.poster_path = metadata.posterPath;
    if (!normalizeReleaseYear(existingMovie?.release_year) && metadata?.releaseYear) patch.release_year = metadata.releaseYear;
    if (!normalizeText(existingMovie?.genre) && metadata?.genre) patch.genre = metadata.genre;
    if (!normalizeText(existingMovie?.era) && metadata?.era) patch.era = metadata.era;
    if (!normalizeText(existingMovie?.overview) && metadata?.overview) patch.overview = metadata.overview;
    if (normalizeVoteAverage(existingMovie?.vote_average) === null && metadata?.voteAverage !== null && metadata?.voteAverage !== undefined) {
        patch.vote_average = metadata.voteAverage;
    }
    if (!normalizeText(existingMovie?.original_language) && metadata?.originalLanguage) patch.original_language = metadata.originalLanguage;
    if (normalizeStringArray(existingMovie?.cast_names).length === 0 && metadata?.castNames?.length) patch.cast_names = metadata.castNames;
    if (!normalizeText(existingMovie?.director) && metadata?.director) patch.director = metadata.director;

    if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
    }

    return patch;
};

// ============================================================
// TMDB: Fetch popular movies
// ============================================================

const fetchTmdbGenreMap = async (apiKey: string): Promise<Map<number, string>> => {
    const response = await fetch(`${TMDB_API_BASE}/genre/movie/list?api_key=${apiKey}&language=en-US`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`TMDB genre fetch failed: ${response.status}`);
    const payload = (await response.json()) as { genres?: Array<{ id: number; name: string }> };
    const map = new Map<number, string>();
    for (const g of payload.genres || []) {
        if (typeof g?.id === 'number' && typeof g?.name === 'string') map.set(g.id, g.name);
    }
    return map;
};

const classifyEra = (year: number | null): string | null => {
    if (!year) return null;
    if (year < 1970) return 'classic';
    if (year < 1990) return '70s-80s';
    if (year < 2000) return '90s';
    if (year < 2010) return '2000s';
    if (year < 2020) return '2010s';
    return '2020s';
};

const parseYear = (dateStr: unknown): number | null => {
    if (typeof dateStr !== 'string') return null;
    const year = parseInt(dateStr.slice(0, 4), 10);
    return Number.isFinite(year) && year > 1850 ? year : null;
};

export type TmdbPageResult = { movies: TmdbMovieDetail[]; totalPages: number };

// Fetch exactly one TMDB discover page (up to 20 results after filtering)
export const fetchTmdbSinglePage = async (page: number): Promise<TmdbPageResult> => {
    const apiKey = getTmdbApiKey();
    if (!apiKey) throw new Error('Missing TMDB_API_KEY');

    const genreMap = await fetchTmdbGenreMap(apiKey);

    const params = new URLSearchParams({
        api_key: apiKey,
        language: 'en-US',
        sort_by: 'vote_count.desc',
        include_adult: 'false',
        'vote_average.gte': String(TMDB_MIN_VOTE_AVERAGE),
        'vote_count.gte': String(TMDB_MIN_VOTE_COUNT),
        page: String(page)
    });

    const response = await fetch(`${TMDB_API_BASE}/discover/movie?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`TMDB discover page ${page} failed: ${response.status}`);

    const payload = (await response.json()) as { results?: TmdbDiscoverResult[]; total_pages?: number };
    const totalPages = Number(payload.total_pages || 500);
    const movies: TmdbMovieDetail[] = [];

    for (const result of payload.results || []) {
        const id = Number(result.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        if ((result.vote_average || 0) < TMDB_MIN_VOTE_AVERAGE) continue;
        if ((result.vote_count || 0) < TMDB_MIN_VOTE_COUNT) continue;
        if ((result.popularity || 0) < TMDB_MIN_POPULARITY) continue;

        const genreIds = (result.genre_ids || []).filter((gid) => typeof gid === 'number');
        if (genreIds.some((gid) => TMDB_EXCLUDED_GENRE_IDS.has(gid))) continue;
        if (!result.poster_path) continue;

        const genres = genreIds
            .map((gid) => genreMap.get(gid) || '')
            .filter(Boolean)
            .slice(0, 2);

        movies.push({
            id,
            title: (result.title || '').trim(),
            poster_path: result.poster_path,
            release_date: result.release_date,
            vote_average: result.vote_average,
            overview: result.overview,
            original_language: result.original_language,
            genres: genres.map((name, i) => ({ id: genreIds[i] || 0, name })),
        });
    }

    return { movies, totalPages };
};

export const fetchTmdbPopularMovies = async (targetCount: number): Promise<TmdbMovieDetail[]> => {
    const apiKey = getTmdbApiKey();
    if (!apiKey) throw new Error('Missing TMDB_API_KEY');

    const genreMap = await fetchTmdbGenreMap(apiKey);
    const seenIds = new Set<number>();
    const movies: TmdbMovieDetail[] = [];
    const pagesNeeded = Math.ceil((targetCount * 1.5) / 20); // overfetch to filter

    // Fetch discover pages
    for (let page = 1; page <= pagesNeeded && movies.length < targetCount; page++) {
        const params = new URLSearchParams({
            api_key: apiKey,
            language: 'en-US',
            sort_by: 'vote_count.desc',
            include_adult: 'false',
            'vote_average.gte': String(TMDB_MIN_VOTE_AVERAGE),
            'vote_count.gte': String(TMDB_MIN_VOTE_COUNT),
            page: String(page)
        });

        const response = await fetch(`${TMDB_API_BASE}/discover/movie?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) continue;

        const payload = (await response.json()) as { results?: TmdbDiscoverResult[] };
        for (const result of payload.results || []) {
            const id = Number(result.id);
            if (!Number.isInteger(id) || id <= 0 || seenIds.has(id)) continue;
            if ((result.vote_average || 0) < TMDB_MIN_VOTE_AVERAGE) continue;
            if ((result.vote_count || 0) < TMDB_MIN_VOTE_COUNT) continue;
            if ((result.popularity || 0) < TMDB_MIN_POPULARITY) continue;

            const genreIds = (result.genre_ids || []).filter((gid) => typeof gid === 'number');
            if (genreIds.some((gid) => TMDB_EXCLUDED_GENRE_IDS.has(gid))) continue;
            if (!result.poster_path) continue;

            const genres = genreIds
                .map((gid) => genreMap.get(gid) || '')
                .filter(Boolean)
                .slice(0, 2);

            seenIds.add(id);
            movies.push({
                id,
                title: (result.title || '').trim(),
                poster_path: result.poster_path,
                release_date: result.release_date,
                vote_average: result.vote_average,
                overview: result.overview,
                original_language: result.original_language,
                genres: genres.map((name, i) => ({ id: genreIds[i] || 0, name })),
            });
        }
    }

    return movies.slice(0, targetCount);
};

// ============================================================
// TMDB: Enrich movies with credits (director + cast)
// ============================================================

export const enrichMoviesWithCredits = async (
    movies: TmdbMovieDetail[]
): Promise<Array<TmdbMovieDetail & { director: string; castNames: string[] }>> => {
    const apiKey = getTmdbApiKey();
    if (!apiKey) throw new Error('Missing TMDB_API_KEY');

    const enrichedByIndex = new Array<TmdbMovieDetail & { director: string; castNames: string[] }>(movies.length);

    await withConcurrency(
        movies.map((movie, index) => ({ movie, index })),
        TMDB_CREDITS_CONCURRENCY,
        async ({ movie, index }) => {
            const movieId = Number(movie.id);
            if (!movieId) return;

            try {
                const response = await fetch(
                    `${TMDB_API_BASE}/movie/${movieId}/credits?api_key=${apiKey}&language=en-US`,
                    { signal: AbortSignal.timeout(15000) }
                );
                if (!response.ok) {
                    enrichedByIndex[index] = { ...movie, director: '', castNames: [] };
                    return;
                }

                const payload = (await response.json()) as TmdbCreditsResult;
                const director =
                    (payload.crew || []).find((m) => String(m?.job || '').toLowerCase() === 'director')?.name ||
                    (payload.crew || []).find((m) => String(m?.department || '').toLowerCase() === 'directing')?.name ||
                    '';

                const castNames = (payload.cast || [])
                    .slice()
                    .sort((a, b) => (Number(a?.order) || 9999) - (Number(b?.order) || 9999))
                    .map((m) => String(m?.name || '').trim())
                    .filter(Boolean)
                    .slice(0, TMDB_CAST_LIMIT);

                enrichedByIndex[index] = { ...movie, director: director.trim(), castNames };
            } catch {
                enrichedByIndex[index] = { ...movie, director: '', castNames: [] };
            }
        }
    );

    return enrichedByIndex.filter((entry): entry is TmdbMovieDetail & { director: string; castNames: string[] } => Boolean(entry));
};

// ============================================================
// Save movies to question_pool_movies
// ============================================================

export const saveMoviesToPool = async (
    movies: Array<TmdbMovieDetail & { director: string; castNames: string[] }>
): Promise<{ inserted: number; skipped: number }> => {
    const supabase = getServiceSupabase();
    let inserted = 0;
    let skipped = 0;

    type UpsertRow = {
        tmdb_id: number;
        title: string;
        poster_path: string | null;
        release_year: number | null;
        genre: string | null;
        era: string | null;
        overview: string | null;
        vote_average: number | null;
        original_language: string | null;
        cast_names: string[];
        director: string | null;
        added_from: string;
        updated_at: string;
    };

    const rows: UpsertRow[] = [];
    for (const movie of movies) {
        const tmdbId = Number(movie.id);
        if (!tmdbId) { skipped++; continue; }

        const year = parseYear(movie.release_date);
        const genre = (movie.genres || []).map((g) => g.name).filter(Boolean).join('/') || null;

        rows.push({
            tmdb_id: tmdbId,
            title: (movie.title || '').trim(),
            poster_path: movie.poster_path || null,
            release_year: year,
            genre,
            era: classifyEra(year),
            overview: (movie.overview || '').trim() || null,
            vote_average: movie.vote_average || null,
            original_language: movie.original_language || null,
            cast_names: movie.castNames || [],
            director: movie.director || null,
            added_from: 'batch_generate',
            updated_at: new Date().toISOString()
        });
    }

    const batches: UpsertRow[][] = [];
    for (let i = 0; i < rows.length; i += POOL_UPSERT_BATCH_SIZE) {
        batches.push(rows.slice(i, i + POOL_UPSERT_BATCH_SIZE));
    }

    const results = await Promise.all(
        batches.map((batch) =>
            supabase
                .from('question_pool_movies')
                .upsert(batch, { onConflict: 'tmdb_id', ignoreDuplicates: false })
        )
    );

    results.forEach((result, idx) => {
        const batchSize = batches[idx].length;
        if (result.error) {
            skipped += batchSize;
        } else {
            inserted += batchSize;
        }
    });

    return { inserted, skipped };
};

// ============================================================
// Anthropic Batch API: Build quiz generation requests
// ============================================================

const buildQuizSystemPrompt = (): string =>
    [
        'Sen bir film quiz motoru olarak calisiyorsun.',
        'GOREV: Sana verilen film verileri icin coktan secmeli sorular uret ve 4 dile cevir.',
        'Sadece JSON dondur. Markdown kullanma. Code block kullanma.',
        'Cikti formati tam olarak su yapida olmali: {"films":[{"film_id":123,"yetersiz_veri":false,"soru_sayisi":5,"sorular":[{"index":1,"tip":"genel","tr":{"soru":"...","secenekler":{"A":"...","B":"...","C":"...","D":"..."},"dogru":"B"},"en":{"soru":"...","secenekler":{"A":"...","B":"...","C":"...","D":"..."},"dogru":"B"},"es":{"soru":"...","secenekler":{"A":"...","B":"...","C":"...","D":"..."},"dogru":"B"},"fr":{"soru":"...","secenekler":{"A":"...","B":"...","C":"...","D":"..."},"dogru":"B"}}]}]}',
        'Her film output icinde mutlaka yer alsin. Veri yetersizse o film icin "yetersiz_veri": true, "soru_sayisi": 0, "sorular": [] dondur.',
        'Soru sayisi kurali: zengin veri 5 soru, orta veri 3 soru, zayif veri 1-2 soru, veri yoksa 0 soru.',
        'Az soru uretmek uydurma sorudan daha iyidir.',
        'Sorular film izlenmis mi anlamaya yardim etmeli.',
        'Yasaklar: yonetmen adi, yayin yili, film turu, overviewdan birebir kopya, spoiler, uydurma sahne, uydurma diyalog, emin olmadigin detay.',
        'Her soruda 4 sik olsun: A, B, C, D. Tek dogru cevap olsun.',
        'Diller: tr, en, es, fr. Sadece metin cevrilir; dogru harfi tum dillerde ayni kalir.'
    ].join(' ');

const buildQuizUserPrompt = (
    movies: Array<TmdbMovieDetail & { director: string; castNames: string[] }>
): string => {
    const payload = {
        films: movies.map((movie) => ({
            film_id: movie.id,
            title: movie.title,
            overview: (movie.overview || '').trim(),
            cast: movie.castNames.slice(0, 6),
            genres: (movie.genres || []).map((g) => g.name).filter(Boolean),
            tagline: (movie.tagline || '').trim()
        }))
    };
    return `Asagidaki film verileri icin sorular uret.\nFilms JSON:\n${JSON.stringify(payload, null, 2)}`;
};

export const buildBatchRequests = (
    movies: Array<TmdbMovieDetail & { director: string; castNames: string[] }>
): BatchRequestItem[] => {
    const batches: BatchRequestItem[] = [];
    const model = getAnthropicBatchModel();

    for (let i = 0; i < movies.length; i += MOVIES_PER_BATCH) {
        const chunk = movies.slice(i, i + MOVIES_PER_BATCH);
        batches.push({
            custom_id: `pool_batch_${i / MOVIES_PER_BATCH}`,
            params: {
                model,
                max_tokens: 12000,
                temperature: 0.2,
                system: buildQuizSystemPrompt(),
                messages: [{ role: 'user', content: buildQuizUserPrompt(chunk) }]
            }
        });
    }

    return batches;
};

// ============================================================
// Anthropic Batch API: Submit batch
// ============================================================

export const submitAnthropicBatch = async (
    requests: BatchRequestItem[]
): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> => {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) return { ok: false, error: 'Missing ANTHROPIC_API_KEY' };

    const response = await fetch('https://api.anthropic.com/v1/messages/batches', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({ requests })
    });

    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
        const errorMsg = String(
            (payload as Record<string, unknown>)?.error ||
            (payload as Record<string, Record<string, unknown>>)?.error?.message ||
            `Anthropic Batch API HTTP ${response.status}`
        );
        return { ok: false, error: errorMsg };
    }

    const batchId = String(payload.id || '').trim();
    if (!batchId) return { ok: false, error: 'No batch ID returned.' };

    return { ok: true, batchId };
};

// ============================================================
// Anthropic Batch API: Check batch status
// ============================================================

export const checkBatchStatus = async (
    batchId: string
): Promise<{ status: string; resultsUrl?: string }> => {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

    const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        }
    });

    const payload = (await response.json()) as Record<string, unknown>;
    return {
        status: String(payload.processing_status || payload.status || 'unknown'),
        resultsUrl: typeof payload.results_url === 'string' ? payload.results_url : undefined
    };
};

// ============================================================
// Anthropic Batch API: Fetch and process results
// ============================================================

const normalizeOption = (value: unknown): string => {
    const str = String(value || '').trim().toLowerCase();
    if (str === 'a' || str === 'b' || str === 'c' || str === 'd') return str;
    return 'a';
};

const parseAnthropicQuizResponse = (
    text: string
): Array<{
    filmId: number;
    questions: Array<{
        index: number;
        questionTranslations: Record<string, string>;
        optionsTranslations: Record<string, Record<string, string>>;
        correctOption: string;
        explanationTranslations: Record<string, string>;
    }>;
}> => {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const films = Array.isArray(parsed.films) ? parsed.films : [];
    const results: Array<{
        filmId: number;
        questions: Array<{
            index: number;
            questionTranslations: Record<string, string>;
            optionsTranslations: Record<string, Record<string, string>>;
            correctOption: string;
            explanationTranslations: Record<string, string>;
        }>;
    }> = [];

    for (const film of films) {
        const filmId = Number(film?.film_id || 0);
        if (!filmId || film?.yetersiz_veri === true) continue;

        const questions: Array<{
            index: number;
            questionTranslations: Record<string, string>;
            optionsTranslations: Record<string, Record<string, string>>;
            correctOption: string;
            explanationTranslations: Record<string, string>;
        }> = [];

        const rawQuestions = Array.isArray(film?.sorular) ? film.sorular : [];
        for (const q of rawQuestions) {
            const idx = Number(q?.index || 0);
            const langs = ['tr', 'en', 'es', 'fr'] as const;

            const questionTranslations: Record<string, string> = {};
            const optionsTranslations: Record<string, Record<string, string>> = {
                a: {}, b: {}, c: {}, d: {}
            };
            let correctOption = '';
            const explanationTranslations: Record<string, string> = {};

            for (const lang of langs) {
                const langBlock = q?.[lang];
                if (!langBlock) continue;

                questionTranslations[lang] = String(langBlock.soru || '').trim();
                const opts = langBlock.secenekler || {};
                optionsTranslations.a[lang] = String(opts.A || opts.a || '').trim();
                optionsTranslations.b[lang] = String(opts.B || opts.b || '').trim();
                optionsTranslations.c[lang] = String(opts.C || opts.c || '').trim();
                optionsTranslations.d[lang] = String(opts.D || opts.d || '').trim();

                if (!correctOption) {
                    correctOption = normalizeOption(langBlock.dogru);
                }
            }

            if (questionTranslations.tr || questionTranslations.en) {
                questions.push({
                    index: idx,
                    questionTranslations,
                    optionsTranslations,
                    correctOption: correctOption || 'a',
                    explanationTranslations
                });
            }
        }

        if (questions.length > 0) {
            results.push({ filmId, questions });
        }
    }

    return results;
};

export const fetchAndProcessBatchResults = async (
    batchId: string
): Promise<BatchProcessResult> => {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) return { ok: false, error: 'Missing ANTHROPIC_API_KEY' };

    const supabase = getServiceSupabase();

    // Get batch results
    const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}/results`, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        }
    });

    if (!response.ok) {
        return { ok: false, error: `Failed to fetch batch results: ${response.status}` };
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(Boolean);

    let moviesProcessed = 0;
    let questionsInserted = 0;

    for (const line of lines) {
        try {
            const result = JSON.parse(line) as Record<string, unknown>;
            if (result.result && typeof result.result === 'object') {
                const msgResult = result.result as Record<string, unknown>;
                if (msgResult.type !== 'succeeded') continue;

                const message = msgResult.message as Record<string, unknown>;
                const contentBlocks = Array.isArray(message?.content) ? message.content : [];
                const responseText = contentBlocks
                    .filter((block: Record<string, unknown>) => block?.type === 'text')
                    .map((block: Record<string, unknown>) => String(block?.text || ''))
                    .join('\n')
                    .trim();

                if (!responseText) continue;

                const filmResults = parseAnthropicQuizResponse(responseText);

                for (const filmResult of filmResults) {
                    // Get pool movie ID
                    const { data: poolMovie } = await supabase
                        .from('question_pool_movies')
                        .select('id')
                        .eq('tmdb_id', filmResult.filmId)
                        .single();

                    if (!poolMovie?.id) continue;

                    const rows: PoolQuestionRow[] = filmResult.questions
                        .slice(0, QUESTIONS_PER_MOVIE)
                        .map((q, idx) => ({
                            tmdb_movie_id: filmResult.filmId,
                            movie_id: poolMovie.id,
                            question_order: idx,
                            question_key: `batch:${batchId}:${filmResult.filmId}:${idx}`,
                            question_translations: q.questionTranslations,
                            options_translations: q.optionsTranslations,
                            correct_option: q.correctOption,
                            explanation_translations: q.explanationTranslations,
                            difficulty: 'medium',
                            source: 'batch_generate',
                            metadata: { batch_id: batchId }
                        }));

                    const { error } = await supabase
                        .from('question_pool_questions')
                        .upsert(rows, { onConflict: 'movie_id,question_order', ignoreDuplicates: true });

                    if (!error) {
                        questionsInserted += rows.length;
                        moviesProcessed++;

                        // Update question_count
                        await supabase
                            .from('question_pool_movies')
                            .update({
                                question_count: rows.length,
                                updated_at: new Date().toISOString()
                            })
                            .eq('tmdb_id', filmResult.filmId);
                    }
                }
            }
        } catch {
            // Skip malformed result lines
            continue;
        }
    }

    return { ok: true, moviesProcessed, questionsInserted };
};

// ============================================================
// Daily sync: Copy daily quiz questions into the pool
// ============================================================

export const syncDailyQuestionsToPool = async (batchDate: string): Promise<{ synced: number }> => {
    const supabase = getServiceSupabase();
    const metadataByMovieId = await buildDailyPoolMetadataMap(supabase, batchDate);

    // Fetch daily questions for this date
    const { data: dailyQuestions } = await supabase
        .from('daily_movie_questions')
        .select('*')
        .eq('batch_date', batchDate);

    if (!dailyQuestions || dailyQuestions.length === 0) return { synced: 0 };

    let synced = 0;

    // Group by movie
    const movieGroups = new Map<number, typeof dailyQuestions>();
    for (const q of dailyQuestions) {
        const movieId = Number(q.movie_id);
        if (!movieId) continue;
        if (!movieGroups.has(movieId)) movieGroups.set(movieId, []);
        movieGroups.get(movieId)!.push(q);
    }

    for (const [tmdbId, questions] of movieGroups) {
        const metadata = metadataByMovieId.get(tmdbId);
        const movieTitle = metadata?.title || String(questions[0]?.movie_title || '').trim();

        // Ensure movie exists in pool
        const { data: existingMovie } = await supabase
            .from('question_pool_movies')
            .select('id, title, poster_path, release_year, genre, era, overview, vote_average, original_language, cast_names, director')
            .eq('tmdb_id', tmdbId)
            .maybeSingle();

        let poolMovieId: string;

        if (existingMovie?.id) {
            poolMovieId = existingMovie.id;
            const metadataPatch = buildPoolMovieMetadataPatch(existingMovie, metadata, movieTitle);
            if (Object.keys(metadataPatch).length > 0) {
                await supabase
                    .from('question_pool_movies')
                    .update(metadataPatch)
                    .eq('id', poolMovieId);
            }
        } else {
            const { data: newMovie } = await supabase
                .from('question_pool_movies')
                .insert({
                    tmdb_id: tmdbId,
                    title: movieTitle,
                    poster_path: metadata?.posterPath || null,
                    release_year: metadata?.releaseYear || null,
                    genre: metadata?.genre || null,
                    era: metadata?.era || null,
                    overview: metadata?.overview || null,
                    vote_average: metadata?.voteAverage ?? null,
                    original_language: metadata?.originalLanguage || null,
                    cast_names: metadata?.castNames || [],
                    director: metadata?.director || null,
                    added_from: 'daily_sync',
                    question_count: 0
                })
                .select('id')
                .single();

            if (!newMovie?.id) continue;
            poolMovieId = newMovie.id;
        }

        // Insert questions
        for (const q of questions) {
            const { error } = await supabase
                .from('question_pool_questions')
                .upsert({
                    tmdb_movie_id: tmdbId,
                    movie_id: poolMovieId,
                    question_order: Number(q.question_order),
                    question_key: `daily:${batchDate}:${q.question_key}`,
                    question_translations: q.question_translations,
                    options_translations: q.options_translations,
                    correct_option: q.correct_option,
                    explanation_translations: q.explanation_translations || {},
                    difficulty: 'medium',
                    source: 'daily_sync',
                    source_daily_date: batchDate,
                    metadata: q.metadata || {}
                }, { onConflict: 'movie_id,question_order', ignoreDuplicates: true });

            if (!error) synced++;
        }

        // Update question count
        const { count } = await supabase
            .from('question_pool_questions')
            .select('*', { count: 'exact', head: true })
            .eq('movie_id', poolMovieId);

        await supabase
            .from('question_pool_movies')
            .update({
                question_count: count || 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', poolMovieId);
    }

    return { synced };
};

// ============================================================
// Full batch generate pipeline
// ============================================================

export const runBatchGenerate = async (
    targetMovieCount: number = 400
): Promise<BatchGenerateResult> => {
    try {
        // 1. Fetch movies from TMDB
        const tmdbMovies = await fetchTmdbPopularMovies(targetMovieCount);
        if (tmdbMovies.length === 0) {
            return { ok: false, error: 'No movies fetched from TMDB.' };
        }

        // 2. Filter out movies already in pool
        const supabase = getServiceSupabase();
        const { data: existingMovies } = await supabase
            .from('question_pool_movies')
            .select('tmdb_id');

        const existingIds = new Set((existingMovies || []).map((m) => Number(m.tmdb_id)));
        const newMovies = tmdbMovies.filter((m) => !existingIds.has(Number(m.id)));

        if (newMovies.length === 0) {
            return { ok: true, totalMovies: 0, totalBatches: 0, batchId: 'none_needed' };
        }

        // 3. Enrich with credits
        const enriched = await enrichMoviesWithCredits(newMovies);

        // 4. Save movies to pool
        await saveMoviesToPool(enriched);

        // 5. Build and submit batch
        const requests = buildBatchRequests(enriched);
        const result = await submitAnthropicBatch(requests);

        if (!result.ok) {
            return { ok: false, error: result.error };
        }

        return {
            ok: true,
            batchId: result.batchId,
            totalMovies: enriched.length,
            totalBatches: requests.length
        };
    } catch (error) {
        return { ok: false, error: String(error) };
    }
};
