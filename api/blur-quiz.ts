import { createCorsHeaders } from './lib/cors.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import { getBlurQuizReward } from '../src/domain/progressionRewards.js';
import { applyProgressionReward } from './lib/progressionProfile.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined> | Headers;
    body?: unknown;
    on?: (event: string, cb: (chunk: Buffer | string) => void) => void;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

type TmdbMovieAliasPayload = {
    title?: string | null;
    original_title?: string | null;
    alternative_titles?: {
        titles?: Array<{ title?: string | null }>;
    };
    translations?: {
        translations?: Array<{
            data?: {
                title?: string | null;
            };
        }>;
    };
};

type BlurMovieGuessRow = {
    id: string;
    tmdb_id: number | null;
    title: string;
    title_aliases: string[];
};

type BlurMovieListRow = {
    id: string;
    poster_path: string | null;
    director: string | null;
    release_year: number | null;
    cast_names: string[] | null;
    genre: string | null;
};

type TitleMatch = {
    candidate: string;
    score: number;
    exact: boolean;
};

type BlurQuizJokerKey = 'director' | 'year' | 'cast' | 'genre';

type BlurQuizSessionRow = {
    id: string;
    user_id: string;
    movie_id: string;
    started_at: string;
    used_jokers: string[] | null;
    status: string;
};

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TITLE_DIRECT_ACCEPT_SCORE = 0.93;
const TITLE_CONFIRM_SCORE = 0.82;
const TITLE_MIN_CONFIRM_LENGTH = 4;
const BLUR_STEP_DURATION_MS = 5000;
const BLUR_TOTAL_STEPS = 6;
const BLUR_MAX_STEP = BLUR_TOTAL_STEPS - 1;
const BLUR_JOKER_KEYS = new Set<BlurQuizJokerKey>(['director', 'year', 'cast', 'genre']);
const TITLE_STOPWORDS = new Set([
    'the', 'a', 'an', 'and',
    'el', 'la', 'los', 'las', 'lo', 'y',
    'le', 'les', 'un', 'une', 'des', 'et',
    'de', 'del', 'da', 'do', 'du', 'of',
    'der', 'die', 'das', 'ein', 'eine',
]);
const ROMAN_NUMERAL_MAP: Record<string, string> = {
    i: '1',
    ii: '2',
    iii: '3',
    iv: '4',
    v: '5',
    vi: '6',
    vii: '7',
    viii: '8',
    ix: '9',
    x: '10',
};
const TITLE_CANONICAL_TOKEN_MAP: Record<string, string> = {
    american: 'american',
    amerikan: 'american',
    count: 'count',
    cont: 'count',
    conte: 'count',
    comte: 'count',
    conde: 'count',
    kont: 'count',
    kontu: 'count',
    cristo: 'cristo',
    kristo: 'cristo',
    captain: 'captain',
    kaptan: 'captain',
    doctor: 'doctor',
    doktor: 'doctor',
    matrix: 'matrix',
    matriks: 'matrix',
};
const tmdbTitleAliasCache = new Map<number, string[]>();
let titleAliasesColumnAvailable: boolean | null = null;

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
        headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    });
};

const getHeader = (req: ApiRequest, key: string): string => {
    const headers = req.headers;
    if (!headers) return '';
    if (typeof (headers as Headers).get === 'function') {
        return ((headers as Headers).get(key) || '').trim();
    }
    const obj = headers as Record<string, string | undefined>;
    return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
    const authHeader = getHeader(req, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() || null : null;
};

const getQueryParam = (req: ApiRequest, key: string): string | null => {
    const raw = req?.query?.[key];
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
    const rawUrl = typeof req?.url === 'string' ? req.url : '';
    if (!rawUrl) return null;
    try {
        const url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : 'https://localhost');
        return url.searchParams.get(key);
    } catch {
        return null;
    }
};

const readBody = (req: ApiRequest): Promise<unknown> => {
    if (req.body !== undefined) return Promise.resolve(req.body);
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        if (typeof req.on !== 'function') {
            resolve({});
            return;
        }
        req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                resolve({});
            }
        });
    });
};

const getSupabase = () => {
    const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) throw new Error('Missing Supabase service config.');
    return createSupabaseServiceClient(url, key);
};

const isLikelyTmdbReadAccessToken = (value: string): boolean =>
    value.length > 40 || value.includes('.');

const getTmdbReadAccessToken = (): string => {
    const credential = String(
        process.env.TMDB_READ_ACCESS_TOKEN
        || process.env.TMDB_API_READ_ACCESS_TOKEN
        || process.env.TMDB_V4_ACCESS_TOKEN
        || process.env.TMDB_API_KEY
        || ''
    ).trim();

    return isLikelyTmdbReadAccessToken(credential) ? credential : '';
};

const stripDiacritics = (value: string): string =>
    value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const normalizeTitle = (value: string): string => {
    const normalized = stripDiacritics(value)
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    return normalized
        .split(' ')
        .map((token) => ROMAN_NUMERAL_MAP[token] || token)
        .filter((token) => token && !TITLE_STOPWORDS.has(token))
        .join(' ')
        .trim();
};

const collapseTitle = (value: string): string =>
    normalizeTitle(value).replace(/\s+/g, '');

const readStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
        : [];

const dedupeTitles = (titles: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const title of titles) {
        const cleaned = String(title || '').trim();
        if (!cleaned) continue;
        const key = collapseTitle(cleaned) || cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cleaned);
    }
    return result;
};

const countSharedTokens = (left: string, right: string): number => {
    const leftTokens = new Set(left.split(' ').filter(Boolean));
    const rightTokens = new Set(right.split(' ').filter(Boolean));
    let shared = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) shared += 1;
    }
    return shared;
};

const commonPrefixLength = (left: string, right: string): number => {
    const limit = Math.min(left.length, right.length);
    let index = 0;
    while (index < limit && left[index] === right[index]) {
        index += 1;
    }
    return index;
};

const normalizePhoneticToken = (value: string): string =>
    value
        .replace(/ph/g, 'f')
        .replace(/ck/g, 'k')
        .replace(/qu/g, 'k')
        .replace(/c(?=[aou])/g, 'k')
        .replace(/x/g, 'ks')
        .replace(/w/g, 'v')
        .replace(/y/g, 'i')
        .replace(/z/g, 's');

const canonicalizeToken = (value: string): string => {
    const cleaned = String(value || '').trim();
    if (!cleaned) return '';
    const phonetic = normalizePhoneticToken(cleaned);
    return TITLE_CANONICAL_TOKEN_MAP[cleaned] || TITLE_CANONICAL_TOKEN_MAP[phonetic] || phonetic;
};

const levenshtein = (a: string, b: string): number => {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
};

const scoreTokenPair = (left: string, right: string): number => {
    if (!left || !right) return 0;
    if (left === right) return 1;

    const phoneticLeft = normalizePhoneticToken(left);
    const phoneticRight = normalizePhoneticToken(right);
    if (phoneticLeft && phoneticLeft === phoneticRight) return 0.97;

    const canonicalLeft = canonicalizeToken(left);
    const canonicalRight = canonicalizeToken(right);
    if (canonicalLeft && canonicalLeft === canonicalRight) return 0.98;

    const maxLength = Math.max(left.length, right.length);
    if (maxLength < 4) return 0;

    const rawScore = Math.max(0, 1 - levenshtein(left, right) / maxLength);
    const phoneticMaxLength = Math.max(phoneticLeft.length, phoneticRight.length);
    const phoneticScore = phoneticMaxLength > 0
        ? Math.max(0, 1 - levenshtein(phoneticLeft, phoneticRight) / phoneticMaxLength)
        : 0;
    const prefixScore = commonPrefixLength(phoneticLeft, phoneticRight) >= Math.max(3, phoneticMaxLength - 2)
        ? 0.92
        : 0;

    return Math.max(rawScore, phoneticScore * 0.98, prefixScore);
};

const bestTokenMatchScore = (token: string, candidates: string[]): number =>
    candidates.reduce((best, candidate) => Math.max(best, scoreTokenPair(token, candidate)), 0);

const allTokensMatchAtThreshold = (sourceTokens: string[], targetTokens: string[], threshold: number): boolean =>
    sourceTokens.length > 0 && sourceTokens.every((token) => bestTokenMatchScore(token, targetTokens) >= threshold);

const scoreTitleMatch = (guess: string, candidate: string): TitleMatch => {
    const normalizedGuess = normalizeTitle(guess);
    const normalizedCandidate = normalizeTitle(candidate);
    if (!normalizedGuess || !normalizedCandidate) {
        return { candidate, score: 0, exact: false };
    }

    const collapsedGuess = collapseTitle(guess);
    const collapsedCandidate = collapseTitle(candidate);
    if (!collapsedGuess || !collapsedCandidate) {
        return { candidate, score: 0, exact: false };
    }

    if (normalizedGuess === normalizedCandidate || collapsedGuess === collapsedCandidate) {
        return { candidate, score: 1, exact: true };
    }

    const guessTokens = normalizedGuess.split(' ').filter(Boolean);
    const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);
    const canonicalGuessTokens = guessTokens.map(canonicalizeToken);
    const canonicalCandidateTokens = candidateTokens.map(canonicalizeToken);
    const sharedTokens = countSharedTokens(normalizedGuess, normalizedCandidate);
    const canonicalSharedTokens = countSharedTokens(
        canonicalGuessTokens.join(' '),
        canonicalCandidateTokens.join(' ')
    );
    const tokenPrecision = guessTokens.length > 0 ? sharedTokens / guessTokens.length : 0;
    const tokenRecall = candidateTokens.length > 0 ? sharedTokens / candidateTokens.length : 0;
    const canonicalPrecision = guessTokens.length > 0 ? canonicalSharedTokens / guessTokens.length : 0;
    const canonicalRecall = candidateTokens.length > 0 ? canonicalSharedTokens / candidateTokens.length : 0;
    const tokenScore = Math.max(
        tokenPrecision * 0.55 + tokenRecall * 0.45,
        Math.min(tokenPrecision, tokenRecall),
        canonicalPrecision * 0.55 + canonicalRecall * 0.45,
        Math.min(canonicalPrecision, canonicalRecall)
    );

    const maxLength = Math.max(collapsedGuess.length, collapsedCandidate.length);
    const editDistance = levenshtein(collapsedGuess, collapsedCandidate);
    const editScore = maxLength > 0 ? Math.max(0, 1 - editDistance / maxLength) : 0;
    const prefixLength = commonPrefixLength(collapsedGuess, collapsedCandidate);

    let score = editScore * 0.65 + tokenScore * 0.35;

    if (guessTokens.length === 1 && candidateTokens.length === 1) {
        if (editDistance <= 1 && maxLength >= 5) {
            score = Math.max(score, 0.96);
        } else if (editScore >= 0.84 && prefixLength >= Math.max(3, maxLength - 2)) {
            score = Math.max(score, 0.94);
        }
    }

    const guessStronglyMatchesCandidate = allTokensMatchAtThreshold(guessTokens, candidateTokens, 0.92);
    const candidateSoftlyMatchesGuess = allTokensMatchAtThreshold(candidateTokens, guessTokens, 0.84);
    if (guessStronglyMatchesCandidate && candidateSoftlyMatchesGuess) {
        score = Math.max(score, 0.95);
    }

    if (canonicalRecall >= 1 && canonicalPrecision >= 1) {
        score = Math.max(score, 0.97);
    } else if (canonicalRecall >= 1 && canonicalPrecision >= 0.66) {
        score = Math.max(score, 0.93);
    }

    if (
        collapsedCandidate.includes(collapsedGuess) &&
        collapsedGuess.length >= TITLE_MIN_CONFIRM_LENGTH
    ) {
        score = Math.max(score, 0.84 + Math.min(0.08, collapsedGuess.length / Math.max(collapsedCandidate.length, 1) * 0.08));
    }

    if (
        collapsedGuess.includes(collapsedCandidate) &&
        collapsedCandidate.length >= TITLE_MIN_CONFIRM_LENGTH
    ) {
        score = Math.max(score, 0.9);
    }

    if (sharedTokens > 0 && tokenRecall >= 1 && tokenPrecision >= 0.66) {
        score = Math.max(score, 0.91);
    }

    const firstGuess = guessTokens[0] || '';
    const firstCandidate = candidateTokens[0] || '';
    const lastGuess = guessTokens[guessTokens.length - 1] || '';
    const lastCandidate = candidateTokens[candidateTokens.length - 1] || '';
    if (firstGuess && firstGuess === firstCandidate) score += 0.03;
    if (lastGuess && lastGuess === lastCandidate) score += 0.03;

    if (guessTokens.length === 1 && candidateTokens.length > 1 && !collapsedCandidate.startsWith(collapsedGuess)) {
        score = Math.min(score, 0.89);
    }

    if (collapsedGuess.length < 3) {
        score = 0;
    }

    return { candidate, score: Math.max(0, Math.min(1, score)), exact: false };
};

const fetchTmdbTitleAliases = async (tmdbMovieId: number, fallbackTitle: string): Promise<string[]> => {
    if (!Number.isInteger(tmdbMovieId) || tmdbMovieId <= 0) {
        return fallbackTitle ? [fallbackTitle] : [];
    }
    if (tmdbTitleAliasCache.has(tmdbMovieId)) {
        return tmdbTitleAliasCache.get(tmdbMovieId) || [];
    }

    const titles = new Set<string>();
    if (fallbackTitle) titles.add(fallbackTitle);

    const readAccessToken = getTmdbReadAccessToken();
    if (!readAccessToken) {
        const cached = dedupeTitles([...titles]);
        tmdbTitleAliasCache.set(tmdbMovieId, cached);
        return cached;
    }

    try {
        const requestUrl = new URL(`${TMDB_API_BASE}/movie/${tmdbMovieId}`);
        requestUrl.search = new URLSearchParams({
            language: 'en-US',
            append_to_response: 'alternative_titles,translations',
        }).toString();

        const response = await fetch(
            requestUrl.toString(),
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${readAccessToken}`,
                },
                signal: AbortSignal.timeout(3500),
            }
        );
        if (response.ok) {
            const payload = (await response.json()) as TmdbMovieAliasPayload;
            if (payload.title) titles.add(payload.title);
            if (payload.original_title) titles.add(payload.original_title);
            for (const entry of payload.alternative_titles?.titles || []) {
                if (entry?.title) titles.add(entry.title);
            }
            for (const translation of payload.translations?.translations || []) {
                if (translation?.data?.title) titles.add(translation.data.title);
            }
        }
    } catch {
        // TMDB aliases are optional. Stored titles remain the fallback.
    }

    const cached = dedupeTitles([...titles]);
    tmdbTitleAliasCache.set(tmdbMovieId, cached);
    return cached;
};

const columnMissingError = (error: unknown): boolean => {
    const message = String((error as { message?: unknown })?.message || '');
    return /title_aliases/i.test(message) && /column|schema/i.test(message);
};

const readMovieForGuess = async (
    supabase: ReturnType<typeof getSupabase>,
    movieId: string
): Promise<{ movie: BlurMovieGuessRow | null; error: { message?: string } | null }> => {
    if (titleAliasesColumnAvailable !== false) {
        const { data, error } = await supabase
            .from('question_pool_movies')
            .select('id, tmdb_id, title, title_aliases')
            .eq('id', movieId)
            .single();

        if (!error && data) {
            titleAliasesColumnAvailable = true;
            return {
                movie: {
                    id: String(data.id || ''),
                    tmdb_id: Number(data.tmdb_id) || null,
                    title: String(data.title || ''),
                    title_aliases: readStringArray((data as { title_aliases?: unknown }).title_aliases),
                },
                error: null,
            };
        }

        if (error && !columnMissingError(error)) {
            return { movie: null, error };
        }

        titleAliasesColumnAvailable = false;
    }

    const { data, error } = await supabase
        .from('question_pool_movies')
        .select('id, tmdb_id, title')
        .eq('id', movieId)
        .single();

    if (error || !data) return { movie: null, error: error || null };

    return {
        movie: {
            id: String(data.id || ''),
            tmdb_id: Number(data.tmdb_id) || null,
            title: String(data.title || ''),
            title_aliases: [],
        },
        error: null,
    };
};

const persistMovieTitleAliases = async (
    supabase: ReturnType<typeof getSupabase>,
    movieId: string,
    titleAliases: string[]
): Promise<void> => {
    if (titleAliasesColumnAvailable !== true || titleAliases.length === 0) return;
    const { error } = await supabase
        .from('question_pool_movies')
        .update({ title_aliases: titleAliases, updated_at: new Date().toISOString() })
        .eq('id', movieId);
    if (error && columnMissingError(error)) {
        titleAliasesColumnAvailable = false;
    }
};

const buildTitleCandidates = async (
    supabase: ReturnType<typeof getSupabase>,
    movie: BlurMovieGuessRow
): Promise<string[]> => {
    const storedCandidates = dedupeTitles([movie.title, ...movie.title_aliases]);
    const tmdbCandidates = await fetchTmdbTitleAliases(Number(movie.tmdb_id), movie.title);
    const allCandidates = dedupeTitles([...storedCandidates, ...tmdbCandidates]);

    const hasNewAliases = allCandidates.length > storedCandidates.length;
    if (hasNewAliases) {
        await persistMovieTitleAliases(supabase, movie.id, allCandidates);
    } else if (titleAliasesColumnAvailable === true && movie.title_aliases.length === 0 && movie.title) {
        await persistMovieTitleAliases(supabase, movie.id, allCandidates);
    }

    return allCandidates;
};

const evaluateGuess = (
    guess: string,
    candidateTitles: string[],
    confirmGuess: boolean
): {
    accepted: boolean;
    requiresConfirmation: boolean;
    best: TitleMatch | null;
} => {
    const cleanGuess = String(guess || '').trim();
    if (!cleanGuess) {
        return { accepted: false, requiresConfirmation: false, best: null };
    }

    const best = candidateTitles
        .map((candidate) => scoreTitleMatch(cleanGuess, candidate))
        .sort((left, right) => right.score - left.score)[0] || null;

    if (!best) {
        return { accepted: false, requiresConfirmation: false, best: null };
    }

    const guessLength = collapseTitle(cleanGuess).length;

    if (best.exact || best.score >= TITLE_DIRECT_ACCEPT_SCORE) {
        return { accepted: true, requiresConfirmation: false, best };
    }

    if (guessLength >= TITLE_MIN_CONFIRM_LENGTH && best.score >= TITLE_CONFIRM_SCORE) {
        if (confirmGuess) {
            return { accepted: true, requiresConfirmation: false, best };
        }
        return { accepted: false, requiresConfirmation: true, best };
    }

    return { accepted: false, requiresConfirmation: false, best };
};

const calcXp = (blurStep: number, jokersUsed: number): number => {
    const base = 50 - blurStep * 8 - jokersUsed * 5;
    return Math.max(10, base);
};

const normalizeBlurGenreKey = (value: unknown): string =>
    String(value || '')
        .split('/')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)[0] || '';

const pickWeightedBlurMovie = <T extends { genre?: unknown }>(
    movies: T[],
    excludedGenres: Set<string>
): T | null => {
    if (!movies.length) return null;

    const genreCounts = new Map<string, number>();
    for (const movie of movies) {
        const genreKey = normalizeBlurGenreKey(movie.genre);
        genreCounts.set(genreKey, (genreCounts.get(genreKey) || 0) + 1);
    }

    const weighted = movies.map((movie) => {
        const genreKey = normalizeBlurGenreKey(movie.genre);
        const genreCount = genreCounts.get(genreKey) || 1;
        let weight = 1 / genreCount;
        if (genreKey && !excludedGenres.has(genreKey)) {
            weight += 1.5;
        }
        if (!genreKey) {
            weight *= 0.65;
        }
        return { movie, weight };
    });

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) {
        return movies[Math.floor(Math.random() * movies.length)] || null;
    }

    let cursor = Math.random() * totalWeight;
    for (const entry of weighted) {
        cursor -= entry.weight;
        if (cursor <= 0) return entry.movie;
    }

    return weighted[weighted.length - 1]?.movie || movies[0] || null;
};

const normalizeBlurSessionJokers = (value: unknown): BlurQuizJokerKey[] => {
    const result: BlurQuizJokerKey[] = [];
    const seen = new Set<BlurQuizJokerKey>();
    for (const entry of readStringArray(value)) {
        const normalized = entry.trim().toLowerCase() as BlurQuizJokerKey;
        if (!BLUR_JOKER_KEYS.has(normalized) || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
};

const deriveBlurStepFromStartedAt = (startedAt: string): number => {
    const startedMs = Date.parse(startedAt);
    if (!Number.isFinite(startedMs)) return BLUR_MAX_STEP;
    const elapsedMs = Math.max(0, Date.now() - startedMs);
    return Math.min(BLUR_MAX_STEP, Math.floor(elapsedMs / BLUR_STEP_DURATION_MS));
};

const sanitizeServerErrorMessage = (fallback: string): string => fallback;

const createBlurQuizSession = async (
    supabase: ReturnType<typeof getSupabase>,
    input: { userId: string; movieId: string }
): Promise<{ session: BlurQuizSessionRow | null; error: { message?: string } | null }> => {
    const { data, error } = await supabase
        .from('blur_quiz_sessions')
        .insert({
            user_id: input.userId,
            movie_id: input.movieId,
        })
        .select('id, user_id, movie_id, started_at, used_jokers, status')
        .single();

    if (error || !data) {
        return { session: null, error: error || null };
    }

    return {
        session: {
            id: String(data.id || ''),
            user_id: String(data.user_id || ''),
            movie_id: String(data.movie_id || ''),
            started_at: String(data.started_at || ''),
            used_jokers: readStringArray((data as { used_jokers?: unknown }).used_jokers),
            status: String(data.status || ''),
        },
        error: null,
    };
};

const readBlurQuizSession = async (
    supabase: ReturnType<typeof getSupabase>,
    input: { userId: string; sessionId: string }
): Promise<{ session: BlurQuizSessionRow | null; error: { message?: string } | null }> => {
    const { data, error } = await supabase
        .from('blur_quiz_sessions')
        .select('id, user_id, movie_id, started_at, used_jokers, status')
        .eq('id', input.sessionId)
        .eq('user_id', input.userId)
        .maybeSingle();

    if (error || !data) {
        return { session: null, error: error || null };
    }

    return {
        session: {
            id: String(data.id || ''),
            user_id: String(data.user_id || ''),
            movie_id: String(data.movie_id || ''),
            started_at: String(data.started_at || ''),
            used_jokers: readStringArray((data as { used_jokers?: unknown }).used_jokers),
            status: String(data.status || ''),
        },
        error: null,
    };
};

const updateBlurQuizSessionJokers = async (
    supabase: ReturnType<typeof getSupabase>,
    session: BlurQuizSessionRow,
    jokerKey: BlurQuizJokerKey
): Promise<{
    ok: true;
    usedJokers: BlurQuizJokerKey[];
  } | {
    ok: false;
    error: string;
  }> => {
    const currentJokers = normalizeBlurSessionJokers(session.used_jokers);
    if (currentJokers.includes(jokerKey)) {
        return { ok: true, usedJokers: currentJokers };
    }

    const nextJokers = [...currentJokers, jokerKey];
    const { error } = await supabase
        .from('blur_quiz_sessions')
        .update({
            used_jokers: nextJokers,
            updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
        .eq('user_id', session.user_id)
        .eq('status', 'in_progress');

    if (error) {
        return { ok: false, error: 'Failed to register joker use.' };
    }

    return { ok: true, usedJokers: nextJokers };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type, apikey, x-client-info',
        methods: 'GET, POST, OPTIONS',
    });

    if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);

    const accessToken = getBearerToken(req);
    if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

    if (req.method === 'GET') {
        const excludeRaw = getQueryParam(req, 'exclude') || '';
        const excludeIds = excludeRaw
            ? excludeRaw.split(',').map((s) => s.trim()).filter(Boolean)
            : [];
        const excludeGenresRaw = getQueryParam(req, 'excludeGenres') || '';
        const excludeGenres = new Set(
            excludeGenresRaw
                ? excludeGenresRaw
                    .split(',')
                    .map((entry) => normalizeBlurGenreKey(entry))
                    .filter(Boolean)
                : []
        );

        let query = supabase
            .from('question_pool_movies')
            .select('id, poster_path, director, release_year, cast_names, genre')
            .not('poster_path', 'is', null)
            .neq('poster_path', '');

        if (excludeIds.length > 0) {
            query = query.not('id', 'in', `(${excludeIds.join(',')})`);
        }

        const { data: movieRows, error } = await query.limit(220);
        if (error) return sendJson(res, 500, { ok: false, error: sanitizeServerErrorMessage('Failed to load blur quiz movies.') }, cors);
        const movies = (movieRows || []) as BlurMovieListRow[];
        if (!movies || movies.length === 0) {
            return sendJson(res, 404, { ok: false, error: 'No movies available.' }, cors);
        }

        const filteredByGenre = excludeGenres.size > 0
            ? movies.filter((movie) => !excludeGenres.has(normalizeBlurGenreKey(movie.genre)))
            : movies;
        const candidateMovies = filteredByGenre.length >= Math.min(12, Math.max(4, Math.floor(movies.length * 0.2)))
            ? filteredByGenre
            : movies;
        const movie = pickWeightedBlurMovie(candidateMovies, excludeGenres);
        if (!movie) {
            return sendJson(res, 404, { ok: false, error: 'No movies available.' }, cors);
        }
        const castNames = Array.isArray(movie.cast_names)
            ? (movie.cast_names as string[]).slice(0, 3)
            : [];
        const sessionResult = await createBlurQuizSession(supabase, {
            userId: user.id,
            movieId: String(movie.id || ''),
        });
        if (sessionResult.error || !sessionResult.session) {
            return sendJson(res, 500, { ok: false, error: 'Failed to create blur quiz session.' }, cors);
        }

        return sendJson(res, 200, {
            ok: true,
            movie_id: movie.id,
            session_id: sessionResult.session.id,
            poster_path: movie.poster_path,
            hints: {
                director: String(movie.director || ''),
                release_year: movie.release_year ?? null,
                cast: castNames,
                genre: String(movie.genre || ''),
            },
        }, cors);
    }

    if (req.method === 'POST') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const action = String(body?.action || 'submit').trim().toLowerCase();
        const sessionId = String(body?.session_id || body?.sessionId || '').trim();
        const guess = String(body?.guess || '').trim();
        const jokerKey = String(body?.joker_key || body?.jokerKey || '').trim().toLowerCase() as BlurQuizJokerKey;
        const confirmGuess = body?.confirm_guess === true;

        if (!sessionId) {
            return sendJson(res, 400, { ok: false, error: 'session_id is required.' }, cors);
        }

        const sessionResult = await readBlurQuizSession(supabase, {
            userId: user.id,
            sessionId,
        });
        if (sessionResult.error || !sessionResult.session) {
            return sendJson(res, 404, { ok: false, error: 'Blur quiz session not found.' }, cors);
        }

        const session = sessionResult.session;
        if (session.status !== 'in_progress') {
            return sendJson(res, 409, { ok: false, error: 'Blur quiz session is already resolved.' }, cors);
        }

        if (action === 'joker_use') {
            if (!BLUR_JOKER_KEYS.has(jokerKey)) {
                return sendJson(res, 400, { ok: false, error: 'Invalid blur joker.' }, cors);
            }

            const jokerResult = await updateBlurQuizSessionJokers(supabase, session, jokerKey);
            if (!jokerResult.ok) {
                return sendJson(res, 500, { ok: false, error: sanitizeServerErrorMessage('Failed to update blur quiz joker state.') }, cors);
            }

            return sendJson(res, 200, {
                ok: true,
                session_id: session.id,
                joker_key: jokerKey,
                jokers_used: jokerResult.usedJokers.length,
                used_jokers: jokerResult.usedJokers,
            }, cors);
        }

        const movieResult = await readMovieForGuess(supabase, session.movie_id);
        if (movieResult.error || !movieResult.movie) {
            return sendJson(res, 404, { ok: false, error: 'Movie not found.' }, cors);
        }

        const movie = movieResult.movie;
        const titleCandidates = await buildTitleCandidates(supabase, movie);
        const evaluation = evaluateGuess(guess, titleCandidates, confirmGuess);
        const correct = evaluation.accepted;
        const blurStep = deriveBlurStepFromStartedAt(session.started_at);
        const usedJokers = normalizeBlurSessionJokers(session.used_jokers);
        const jokersUsed = usedJokers.length;
        const xpEarned = correct ? calcXp(blurStep, jokersUsed) : 0;
        const rewardGrant = getBlurQuizReward({
            correct,
            blurStep,
            jokersUsed
        });

        if (evaluation.requiresConfirmation && evaluation.best) {
            return sendJson(res, 200, {
                ok: true,
                correct: false,
                xp_earned: 0,
                needs_retry: true,
                retry_reason: 'close_match',
                match_score: Number(evaluation.best.score.toFixed(3)),
            }, cors);
        }

        const { data: resolvedSession, error: resolveError } = await supabase
            .from('blur_quiz_sessions')
            .update({
                status: 'completed',
                submitted_guess: guess || null,
                correct,
                blur_step: blurStep,
                jokers_used_count: jokersUsed,
                xp_earned: xpEarned,
                tickets_earned: rewardGrant.tickets,
                arena_score_earned: rewardGrant.arenaScore,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', session.id)
            .eq('user_id', user.id)
            .eq('status', 'in_progress')
            .select('id')
            .maybeSingle();

        if (resolveError || !resolvedSession) {
            return sendJson(res, 409, { ok: false, error: 'Blur quiz session is already resolved.' }, cors);
        }

        if (correct && (xpEarned > 0 || rewardGrant.tickets > 0 || rewardGrant.arenaScore > 0)) {
            await applyProgressionReward({
                supabase,
                userId: user.id,
                fallbackEmail: user.email || null,
                fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
                reward: {
                    xp: xpEarned,
                    tickets: rewardGrant.tickets,
                    arenaScore: rewardGrant.arenaScore,
                    arenaActivity: rewardGrant.arenaActivity
                },
                isQuizReward: true,
                ledger: {
                    source: 'blur_quiz',
                    sourceId: session.id,
                    reason: 'blur_quiz_complete',
                    metadata: {
                        blurStep,
                        jokersUsed,
                        correct,
                        matchScore: evaluation.best ? Number(evaluation.best.score.toFixed(3)) : 0,
                        movieId: session.movie_id,
                    },
                    eventKey: `blur_quiz:${session.id}`,
                }
            });
        }

        return sendJson(res, 200, {
            ok: true,
            correct,
            session_id: session.id,
            xp_earned: xpEarned,
            tickets_earned: rewardGrant.tickets,
            arena_score_earned: rewardGrant.arenaScore,
            match_score: evaluation.best ? Number(evaluation.best.score.toFixed(3)) : 0,
            matched_title: correct ? movie.title : null,
        }, cors);
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);
}
