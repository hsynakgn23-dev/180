import { createSupabaseServiceClient } from './supabaseServiceClient.js';
import { createSupabaseServiceHeaders } from './supabaseServiceHeaders.js';

export type DailyQuizLanguageCode = 'tr' | 'en' | 'es' | 'fr';

export type DailyQuizMovie = {
    id: number;
    title: string;
    director: string;
    year: number;
    genre: string;
    tagline?: string;
    color?: string;
    posterPath?: string | null;
    overview?: string;
    voteAverage?: number;
    cast?: string[];
    originalLanguage?: string;
    slotLabel?: string;
    [key: string]: unknown;
};

type DailyQuizBatchRow = {
    date?: unknown;
    status?: unknown;
    source?: unknown;
    source_model?: unknown;
    movies?: unknown;
    question_count?: unknown;
    language_codes?: unknown;
    prepared_at?: unknown;
    published_at?: unknown;
    metadata?: unknown;
    updated_at?: unknown;
};

type DailyQuizQuestionRow = {
    id?: unknown;
    batch_date?: unknown;
    movie_id?: unknown;
    movie_title?: unknown;
    movie_order?: unknown;
    question_order?: unknown;
    question_key?: unknown;
    question_translations?: unknown;
    options_translations?: unknown;
    correct_option?: unknown;
    explanation_translations?: unknown;
    metadata?: unknown;
};

type DailyQuizAttemptRow = {
    question_id?: unknown;
    selected_option?: unknown;
    is_correct?: unknown;
    answered_at?: unknown;
    movie_id?: unknown;
};

type DailyQuizProgressRow = {
    batch_date?: unknown;
    user_id?: unknown;
    answered_count?: unknown;
    correct_count?: unknown;
    completed_movie_ids?: unknown;
    streak_protected?: unknown;
    streak_protected_at?: unknown;
    xp_awarded?: unknown;
    last_answered_at?: unknown;
    metadata?: unknown;
};

type ProfileRow = {
    user_id?: unknown;
    email?: unknown;
    display_name?: unknown;
    xp_state?: unknown;
};

type LocalizedRecord = Record<DailyQuizLanguageCode, string>;

type OpenAiQuestionOption = {
    key?: unknown;
    translations?: unknown;
};

type OpenAiQuestion = {
    questionKey?: unknown;
    questionTranslations?: unknown;
    options?: unknown;
    correctOption?: unknown;
    explanationTranslations?: unknown;
};

type OpenAiMovieBlock = {
    movieId?: unknown;
    movieTitle?: unknown;
    questions?: unknown;
};

type OpenAiDailyQuizPayload = {
    movies?: unknown;
    films?: unknown;
};

type StoredDailyQuizQuestion = {
    id: string;
    movieId: number;
    movieTitle: string;
    movieOrder: number;
    questionOrder: number;
    questionKey: string;
    questionTranslations: LocalizedRecord;
    optionsTranslations: Record<'a' | 'b' | 'c' | 'd', LocalizedRecord>;
    correctOption: 'a' | 'b' | 'c' | 'd';
    explanationTranslations: LocalizedRecord;
    metadata: Record<string, unknown>;
};

type FlexibleQuizPayload = {
    movies?: unknown;
    films?: unknown;
};

type RequestedQuizPayload = {
    payload: FlexibleQuizPayload;
    source: string;
    sourceModel: string;
    strictQuestionCount: boolean;
};

export type StoredDailyQuizProgress = {
    answeredCount: number;
    correctCount: number;
    completedMovieIds: number[];
    streakProtected: boolean;
    streakProtectedAt: string | null;
    xpAwarded: number;
    lastAnsweredAt: string | null;
    metadata: Record<string, unknown>;
};

export type PreparedBatchResult = {
    ok: true;
    reused: boolean;
    date: string;
    questionCount: number;
    sourceModel: string;
} | {
    ok: false;
    error: string;
    status?: number;
};

export type PublishBatchResult = {
    ok: true;
    date: string;
    questionCount: number;
    batchStatus: string;
} | {
    ok: false;
    error: string;
    status?: number;
};

export type DailyQuizBundleResult = {
    ok: true;
    date: string;
    status: string;
    movies: DailyQuizMovie[];
    language: DailyQuizLanguageCode;
    questionCount: number;
    questionsByMovie: Array<{
        movieId: number;
        movieTitle: string;
        movieOrder: number;
        requiredCorrectCount: number;
        questions: Array<{
            id: string;
            questionKey: string;
            questionOrder: number;
            question: string;
            options: Array<{ key: 'a' | 'b' | 'c' | 'd'; label: string }>;
            attempt: null | {
                selectedOption: 'a' | 'b' | 'c' | 'd';
                isCorrect: boolean;
                answeredAt: string;
                explanation: string;
            };
        }>;
    }>;
    progress: StoredDailyQuizProgress | null;
} | {
    ok: false;
    error: string;
    status?: number;
};

export type SubmitAnswerResult = {
    ok: true;
    questionId: string;
    selectedOption: 'a' | 'b' | 'c' | 'd';
    isCorrect: boolean;
    alreadyAnswered: boolean;
    explanation: string;
    progress: StoredDailyQuizProgress;
    xp: {
        delta: number;
        total: number | null;
        streak: number | null;
        streakProtectedNow: boolean;
    };
} | {
    ok: false;
    error: string;
    status?: number;
};

const DAILY_QUIZ_LANGUAGES: DailyQuizLanguageCode[] = ['tr', 'en', 'es', 'fr'];
const DAILY_QUIZ_QUESTIONS_PER_MOVIE = 5;
const DAILY_QUIZ_MOVIE_PASS_THRESHOLD = 3;
const DAILY_QUIZ_XP_PER_CORRECT = 2;
const DAILY_QUIZ_XP_FIRST_COMPLETION = 8;
const DAILY_QUIZ_XP_EXTRA_COMPLETION = 4;
const DEFAULT_DAILY_ROLLOVER_TIMEZONE = 'Europe/Istanbul';
const OPENAI_DEFAULT_MODEL = (process.env.OPENAI_DAILY_QUIZ_MODEL || 'gpt-4.1-mini').trim() || 'gpt-4.1-mini';
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const normalizeText = (value: unknown, maxLength = 400): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const toArray = <T>(value: unknown): T[] => {
    return Array.isArray(value) ? (value as T[]) : [];
};

const toInteger = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
};

const normalizeUuid = (value: unknown): string => {
    const text = normalizeText(value, 120);
    return UUID_REGEX.test(text) ? text : '';
};

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

const getDailyDateKey = (value = new Date()): string => getDateKeyFromFormatter(value, DAILY_DATE_FORMATTER);

const getDateKeyDaysFrom = (dateKey: string, days: number): string => {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part));
    const date = new Date(Date.UTC(year || 2000, (month || 1) - 1, day || 1));
    date.setUTCDate(date.getUTCDate() + days);
    const nextYear = date.getUTCFullYear();
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getUTCDate()).padStart(2, '0');
    return `${nextYear}-${nextMonth}-${nextDay}`;
};

const parseDateKeyToDayIndex = (dateKey: string): number | null => {
    const parts = dateKey.split('-').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
    const [year, month, day] = parts;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.floor(parsed.getTime() / 86400000);
};

const normalizeLanguage = (value: unknown): DailyQuizLanguageCode => {
    const text = normalizeText(value, 16).toLowerCase();
    return text === 'tr' || text === 'en' || text === 'es' || text === 'fr' ? text : 'en';
};

const normalizeSelectedOption = (value: unknown): 'a' | 'b' | 'c' | 'd' | null => {
    const text = normalizeText(value, 4).toLowerCase();
    return text === 'a' || text === 'b' || text === 'c' || text === 'd' ? text : null;
};

const normalizeLocalizedRecord = (value: unknown, fallbackText = ''): LocalizedRecord => {
    const objectValue = toObject(value);
    const fallback = normalizeText(fallbackText, 320);
    const english = normalizeText(objectValue?.en, 320) || fallback;
    const turkish = normalizeText(objectValue?.tr, 320) || english;
    const spanish = normalizeText(objectValue?.es, 320) || english;
    const french = normalizeText(objectValue?.fr, 320) || english;
    return {
        en: english,
        tr: turkish,
        es: spanish,
        fr: french
    };
};

const normalizeRequiredLocalizedRecord = (value: unknown): LocalizedRecord => {
    const objectValue = toObject(value);
    return {
        en: normalizeText(objectValue?.en, 320),
        tr: normalizeText(objectValue?.tr, 320),
        es: normalizeText(objectValue?.es, 320),
        fr: normalizeText(objectValue?.fr, 320)
    };
};

const buildStaticLocalizedRecord = (value: {
    en: string;
    tr: string;
    es: string;
    fr: string;
}): LocalizedRecord => ({
    en: normalizeText(value.en, 320),
    tr: normalizeText(value.tr, 320),
    es: normalizeText(value.es, 320),
    fr: normalizeText(value.fr, 320)
});

const DEFAULT_EXPLANATION_TRANSLATIONS = buildStaticLocalizedRecord({
    en: 'The correct answer matches a detail from the film.',
    tr: 'Dogru cevap filmdeki bir ayrinti ile eslesir.',
    es: 'La respuesta correcta coincide con un detalle de la pelicula.',
    fr: 'La bonne reponse correspond a un detail du film.'
});

const getRequiredCorrectCount = (questionCount: number): number => {
    const normalized = Math.max(0, Math.min(DAILY_QUIZ_QUESTIONS_PER_MOVIE, toInteger(questionCount)));
    return Math.min(DAILY_QUIZ_MOVIE_PASS_THRESHOLD, normalized);
};

const normalizeDuplicateTextKey = (value: string): string =>
    normalizeText(value, 320)
        .toLocaleLowerCase('en-US')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const assertCompleteLocalizedRecord = (
    value: LocalizedRecord,
    context: string
): void => {
    for (const language of DAILY_QUIZ_LANGUAGES) {
        if (!normalizeText(value[language], 320)) {
            throw new Error(`${context} is missing ${language} translation.`);
        }
    }
};

const pickTranslation = (value: LocalizedRecord, language: DailyQuizLanguageCode): string => {
    return normalizeText(value[language], 320) || normalizeText(value.en, 320) || normalizeText(value.tr, 320);
};

const normalizeMovie = (value: unknown): DailyQuizMovie | null => {
    const movie = toObject(value);
    const id = toInteger(movie?.id);
    const title = normalizeText(movie?.title || movie?.movieTitle || movie?.movie_title, 180);
    if (!id || !title) return null;

    return {
        ...movie,
        id,
        title,
        director: normalizeText(movie?.director, 160),
        year: toInteger(movie?.year),
        genre: normalizeText(movie?.genre, 160),
        tagline: normalizeText(movie?.tagline, 200),
        color: normalizeText(movie?.color, 120),
        posterPath:
            normalizeText(
                movie?.posterPath ||
                movie?.poster_path ||
                movie?.posterStoragePath ||
                movie?.poster_storage_path,
                600
            ) || null,
        overview: normalizeText(movie?.overview, 1200),
        voteAverage: Number(movie?.voteAverage ?? movie?.vote_average) || undefined,
        cast: toArray<string>(movie?.cast).map((entry) => normalizeText(entry, 120)).filter(Boolean),
        originalLanguage: normalizeText(movie?.originalLanguage || movie?.original_language, 32),
        slotLabel: normalizeText(movie?.slotLabel, 120)
    };
};

const getSupabaseUrl = (): string => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseAnonKey = (): string => String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const getSupabaseServiceRoleKey = (): string => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const getAnthropicApiKey = (): string => String(process.env.ANTHROPIC_API_KEY || '').trim();
const getAnthropicDailyQuizModel = (): string =>
    String(process.env.ANTHROPIC_DAILY_QUIZ_MODEL || 'claude-sonnet-4-20250514').trim() || 'claude-sonnet-4-20250514';
const getAnthropicApiTimeoutMs = (): number => {
    const parsed = Number(process.env.ANTHROPIC_API_TIMEOUT_MS || 45000);
    return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 45000;
};
const getAnthropicApiRetries = (): number => {
    const parsed = Number(process.env.ANTHROPIC_API_RETRIES || 3);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
};
const getOpenAiApiKey = (): string => String(process.env.OPENAI_API_KEY || '').trim();
const getDailyQuizApiUrl = (): string => String(process.env.DAILY_QUIZ_API_URL || '').trim();
const getDailyQuizApiKey = (): string => String(process.env.DAILY_QUIZ_API_KEY || '').trim();
const getDailyQuizApiAuthHeader = (): string =>
    String(process.env.DAILY_QUIZ_API_AUTH_HEADER || 'authorization').trim().toLowerCase() || 'authorization';
const getDailyQuizApiModel = (): string =>
    String(process.env.DAILY_QUIZ_API_MODEL || 'external_quiz_api').trim() || 'external_quiz_api';
const getDailyQuizApiTimeoutMs = (): number => {
    const parsed = Number(process.env.DAILY_QUIZ_API_TIMEOUT_MS || 45000);
    return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 45000;
};
const getDailyQuizApiRetries = (): number => {
    const parsed = Number(process.env.DAILY_QUIZ_API_RETRIES || 3);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
};

export const hasDailyQuizProviderConfig = (): boolean =>
    Boolean(getAnthropicApiKey() || getDailyQuizApiUrl() || getOpenAiApiKey());

const getSupabaseServiceRestConfig = (): { url: string; serviceRoleKey: string } => {
    const url = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    if (!url || !serviceRoleKey) {
        throw new Error('Missing Supabase service config.');
    }
    return {
        url: url.replace(/\/+$/, ''),
        serviceRoleKey
    };
};

const createServiceClient = () => {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceRoleKey();
    if (!url || !key) {
        throw new Error('Missing Supabase service config.');
    }

    return createSupabaseServiceClient(url, key);
};

const readDailyQuizBatchViaRest = async (dateKey: string): Promise<DailyQuizBatchRow | null> => {
    const config = getSupabaseServiceRestConfig();
    const endpoint =
        `${config.url}/rest/v1/daily_quiz_batches` +
        `?select=date,status,source,source_model,movies,question_count,language_codes,prepared_at,published_at,metadata,updated_at` +
        `&date=eq.${encodeURIComponent(dateKey)}` +
        '&limit=1';

    const response = await fetch(endpoint, {
        headers: createSupabaseServiceHeaders(config.serviceRoleKey, {
            Accept: 'application/json'
        })
    });

    const payload = (await response.json().catch(() => [])) as unknown;
    if (!response.ok) {
        const first = Array.isArray(payload) ? payload[0] : payload;
        const error = toObject(first);
        throw new Error(
            normalizeText(error?.message || error?.error || `HTTP ${response.status}`, 320) ||
            'Daily quiz batch read failed.'
        );
    }

    if (!Array.isArray(payload) || payload.length === 0) return null;
    return (payload[0] || null) as DailyQuizBatchRow | null;
};

export const stageDailyQuizSourceBatch = async (input: {
    dateKey: string;
    movies: DailyQuizMovie[];
    status?: 'preparing' | 'prepared' | 'published' | 'failed';
    metadata?: Record<string, unknown>;
}): Promise<{ ok: true; date: string; status: string } | { ok: false; error: string; status?: number }> => {
    try {
        const config = getSupabaseServiceRestConfig();
        const status = normalizeText(input.status || 'prepared', 24) || 'prepared';
        const endpoint = `${config.url}/rest/v1/daily_quiz_batches?on_conflict=date`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: createSupabaseServiceHeaders(config.serviceRoleKey, {
                Accept: 'application/json',
                'content-type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=minimal'
            }),
            body: JSON.stringify([
                {
                    date: input.dateKey,
                    status,
                    source: 'locked_daily_source',
                    source_model: null,
                    movies: input.movies,
                    question_count: 0,
                    language_codes: DAILY_QUIZ_LANGUAGES,
                    prepared_at: new Date().toISOString(),
                    metadata: input.metadata || {},
                    updated_at: new Date().toISOString()
                }
            ])
        });

        if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as unknown;
            const error = toObject(payload);
            return {
                ok: false,
                error:
                    normalizeText(error?.message || error?.error || `HTTP ${response.status}`, 320) ||
                    'Daily quiz source stage failed.',
                status: response.status
            };
        }

        return {
            ok: true,
            date: input.dateKey,
            status
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Daily quiz source stage failed.', 320),
            status: 500
        };
    }
};

const getHeader = (
    headers: Record<string, string | undefined> | Headers | undefined,
    key: string
): string => {
    if (!headers) return '';
    if (typeof (headers as Headers).get === 'function') {
        return ((headers as Headers).get(key) || '').trim();
    }

    const objectHeaders = headers as Record<string, string | undefined>;
    return (objectHeaders[key.toLowerCase()] || objectHeaders[key] || '').trim();
};

const getBearerToken = (
    headers: Record<string, string | undefined> | Headers | undefined
): string | null => {
    const authHeader = getHeader(headers, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1].trim();
    return token || null;
};

const readAuthUser = async (accessToken: string): Promise<{ id: string; email: string } | null> => {
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    if (!url || !anonKey || !accessToken) return null;

    try {
        const response = await fetch(`${url}/auth/v1/user`, {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${accessToken}`
            }
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { id?: unknown; email?: unknown };
        const id = normalizeUuid(payload.id);
        if (!id) return null;
        return {
            id,
            email: normalizeText(payload.email, 240)
        };
    } catch {
        return null;
    }
};

const buildOpenAiSchema = () => ({
    name: 'daily_quiz_batch',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            movies: {
                type: 'array',
                minItems: 5,
                maxItems: 5,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        movieId: { type: 'integer' },
                        movieTitle: { type: 'string' },
                        questions: {
                            type: 'array',
                            minItems: 5,
                            maxItems: 5,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    questionKey: { type: 'string' },
                                    questionTranslations: {
                                        type: 'object',
                                        additionalProperties: false,
                                        properties: {
                                            en: { type: 'string' },
                                            tr: { type: 'string' },
                                            es: { type: 'string' },
                                            fr: { type: 'string' }
                                        },
                                        required: ['en', 'tr', 'es', 'fr']
                                    },
                                    options: {
                                        type: 'array',
                                        minItems: 4,
                                        maxItems: 4,
                                        items: {
                                            type: 'object',
                                            additionalProperties: false,
                                            properties: {
                                                key: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
                                                translations: {
                                                    type: 'object',
                                                    additionalProperties: false,
                                                    properties: {
                                                        en: { type: 'string' },
                                                        tr: { type: 'string' },
                                                        es: { type: 'string' },
                                                        fr: { type: 'string' }
                                                    },
                                                    required: ['en', 'tr', 'es', 'fr']
                                                }
                                            },
                                            required: ['key', 'translations']
                                        }
                                    },
                                    correctOption: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
                                    explanationTranslations: {
                                        type: 'object',
                                        additionalProperties: false,
                                        properties: {
                                            en: { type: 'string' },
                                            tr: { type: 'string' },
                                            es: { type: 'string' },
                                            fr: { type: 'string' }
                                        },
                                        required: ['en', 'tr', 'es', 'fr']
                                    }
                                },
                                required: [
                                    'questionKey',
                                    'questionTranslations',
                                    'options',
                                    'correctOption',
                                    'explanationTranslations'
                                ]
                            }
                        }
                    },
                    required: ['movieId', 'movieTitle', 'questions']
                }
            }
        },
        required: ['movies']
    }
});

const buildOpenAiMessages = (dateKey: string, movies: DailyQuizMovie[]) => {
    const moviePayload = movies.map((movie, index) => ({
        movieId: movie.id,
        movieTitle: movie.title,
        movieOrder: index,
        director: movie.director,
        year: movie.year,
        genre: movie.genre,
        overview: movie.overview || '',
        cast: Array.isArray(movie.cast) ? movie.cast.slice(0, 6) : [],
        originalLanguage: movie.originalLanguage || ''
    }));

    return [
        {
            role: 'system',
            content:
                'You are preparing a daily movie-verification quiz for a film app. ' +
                'Return strict JSON only. Generate exactly 5 multiple-choice questions per movie and 4 translated variants for each string: en, tr, es, fr. ' +
                'Questions must help determine whether someone has actually watched the movie. ' +
                'Avoid spoilers, ending reveals, twist reveals, director/year/genre trivia, actor names, poster-visible details, and facts already shown in the app card. ' +
                'Prefer scene memory, object recall, character behavior, mood shifts, setting detail, and non-ending plot beats. ' +
                'Each question needs exactly 4 plausible options with one correct answer. ' +
                'Explanations must stay short and spoiler-safe.'
        },
        {
            role: 'user',
            content:
                `Target date: ${dateKey}\n` +
                'Movies JSON:\n' +
                JSON.stringify(moviePayload, null, 2)
        }
    ];
};

const buildExternalQuizPayload = (dateKey: string, movies: DailyQuizMovie[]) => ({
    date: dateKey,
    films: movies.map((movie) => ({
        film_id: movie.id,
        title: movie.title,
        overview: movie.overview || '',
        cast: Array.isArray(movie.cast) ? movie.cast.slice(0, 6) : [],
        genres: normalizeText(movie.genre, 160)
            .split('/')
            .map((entry) => normalizeText(entry, 80))
            .filter(Boolean),
        keywords: toArray<string>(movie.keywords).map((entry) => normalizeText(entry, 80)).filter(Boolean),
        tagline: normalizeText(movie.tagline, 200)
    }))
});

const buildAnthropicSystemPrompt = (): string =>
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

const buildAnthropicUserPrompt = (dateKey: string, movies: DailyQuizMovie[]): string =>
    `Target date: ${dateKey}\nAsagidaki film verileri icin sorular uret.\nFilms JSON:\n${JSON.stringify(buildExternalQuizPayload(dateKey, movies), null, 2)}`;

const requestOpenAiQuizPayload = async (dateKey: string, movies: DailyQuizMovie[]): Promise<OpenAiDailyQuizPayload> => {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
        throw new Error('Missing env: OPENAI_API_KEY');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: OPENAI_DEFAULT_MODEL,
            temperature: 0.4,
            messages: buildOpenAiMessages(dateKey, movies),
            response_format: {
                type: 'json_schema',
                json_schema: buildOpenAiSchema()
            }
        })
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
        const errorPayload = toObject(payload.error);
        throw new Error(
            normalizeText(errorPayload?.message || `OpenAI HTTP ${response.status}`, 320) ||
            'OpenAI request failed.'
        );
    }

    const firstChoice = toArray<Record<string, unknown>>(payload.choices)[0] || null;
    const message = toObject(firstChoice?.message);
    const refusal = normalizeText(message?.refusal, 320);
    if (refusal) {
        throw new Error(refusal);
    }

    const rawContent = message?.content;
    if (typeof rawContent === 'string') {
        return JSON.parse(rawContent) as OpenAiDailyQuizPayload;
    }

    const contentParts = toArray<Record<string, unknown>>(rawContent);
    const textPart = contentParts.find((part) => normalizeText(part.type, 32) === 'text') || null;
    const text = normalizeText(textPart?.text, 20000);
    if (!text) {
        throw new Error('OpenAI returned empty quiz payload.');
    }

    return JSON.parse(text) as OpenAiDailyQuizPayload;
};

const parseJsonResponse = async (response: Response): Promise<Record<string, unknown>> => {
    const rawText = await response.text();
    if (!rawText.trim()) return {};

    try {
        const parsed = JSON.parse(rawText) as unknown;
        return toObject(parsed) || {};
    } catch {
        throw new Error('Daily quiz provider returned invalid JSON.');
    }
};

const unwrapJsonText = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed.startsWith('```')) return trimmed;

    const withoutOpeningFence = trimmed.replace(/^```(?:json)?\s*/i, '');
    const closingFenceIndex = withoutOpeningFence.lastIndexOf('```');
    return (closingFenceIndex >= 0
        ? withoutOpeningFence.slice(0, closingFenceIndex)
        : withoutOpeningFence
    ).trim();
};

const parseJsonText = (value: string, errorMessage: string): Record<string, unknown> => {
    const normalized = unwrapJsonText(value);
    if (!normalized) {
        throw new Error(errorMessage);
    }

    try {
        const parsed = JSON.parse(normalized) as unknown;
        return toObject(parsed) || {};
    } catch {
        throw new Error(errorMessage);
    }
};

const requestExternalQuizPayload = async (dateKey: string, movies: DailyQuizMovie[]): Promise<RequestedQuizPayload> => {
    const endpoint = getDailyQuizApiUrl();
    if (!endpoint) {
        throw new Error('Missing env: DAILY_QUIZ_API_URL');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getDailyQuizApiTimeoutMs());
    const authHeaderName = getDailyQuizApiAuthHeader();
    const apiKey = getDailyQuizApiKey();
    const headers: Record<string, string> = {
        accept: 'application/json',
        'content-type': 'application/json'
    };

    if (apiKey) {
        headers[authHeaderName] =
            authHeaderName === 'authorization' ? `Bearer ${apiKey}` : apiKey;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(buildExternalQuizPayload(dateKey, movies)),
            signal: controller.signal
        });
        const payload = await parseJsonResponse(response);

        if (!response.ok) {
            const errorPayload = toObject(payload.error) || payload;
            throw new Error(
                normalizeText(
                    errorPayload?.message ||
                    errorPayload?.error ||
                    `Daily quiz provider HTTP ${response.status}`,
                    320
                ) || 'Daily quiz provider request failed.'
            );
        }

        return {
            payload,
            source: 'external_quiz_api',
            sourceModel:
                normalizeText(payload.sourceModel || payload.model, 120) ||
                getDailyQuizApiModel(),
            strictQuestionCount: false
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Daily quiz provider request failed.';
        throw new Error(normalizeText(message, 320) || 'Daily quiz provider request failed.');
    } finally {
        clearTimeout(timeout);
    }
};

const sleep = async (milliseconds: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const requestPreferredQuizPayload = async (dateKey: string, movies: DailyQuizMovie[]): Promise<RequestedQuizPayload> => {
    const anthropicApiKey = getAnthropicApiKey();
    const externalQuizApiUrl = getDailyQuizApiUrl();
    const openAiApiKey = getOpenAiApiKey();

    if (anthropicApiKey) {
        let lastAnthropicError = 'Anthropic request failed.';
        const retryCount = getAnthropicApiRetries();

        for (let attempt = 1; attempt <= retryCount; attempt += 1) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), getAnthropicApiTimeoutMs());

                try {
                    const response = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/json',
                            'x-api-key': anthropicApiKey,
                            'anthropic-version': '2023-06-01'
                        },
                        body: JSON.stringify({
                            model: getAnthropicDailyQuizModel(),
                            max_tokens: 12000,
                            temperature: 0.2,
                            system: buildAnthropicSystemPrompt(),
                            messages: [
                                {
                                    role: 'user',
                                    content: buildAnthropicUserPrompt(dateKey, movies)
                                }
                            ]
                        }),
                        signal: controller.signal
                    });

                    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
                    if (!response.ok) {
                        const errorPayload = toObject(payload.error) || payload;
                        throw new Error(
                            normalizeText(
                                errorPayload?.message ||
                                errorPayload?.error ||
                                `Anthropic HTTP ${response.status}`,
                                320
                            ) || 'Anthropic request failed.'
                        );
                    }

                    const contentBlocks = toArray<Record<string, unknown>>(payload.content);
                    const text = contentBlocks
                        .filter((block) => normalizeText(block.type, 32) === 'text')
                        .map((block) => normalizeText(block.text, 50000))
                        .filter(Boolean)
                        .join('\n')
                        .trim();

                    const parsedPayload = parseJsonText(text, 'Anthropic returned invalid quiz JSON.');
                    return {
                        payload: parsedPayload,
                        source: 'anthropic',
                        sourceModel:
                            normalizeText(payload.model, 120) ||
                            getAnthropicDailyQuizModel(),
                        strictQuestionCount: false
                    };
                } finally {
                    clearTimeout(timeout);
                }
            } catch (error) {
                lastAnthropicError = normalizeText(
                    error instanceof Error ? error.message : 'Anthropic request failed.',
                    320
                ) || 'Anthropic request failed.';
                if (attempt < retryCount) {
                    await sleep(attempt * 700);
                }
            }
        }

        if (!externalQuizApiUrl && !openAiApiKey) {
            throw new Error(lastAnthropicError);
        }
    }

    if (externalQuizApiUrl) {
        let lastExternalError = 'Daily quiz provider request failed.';
        const retryCount = getDailyQuizApiRetries();

        for (let attempt = 1; attempt <= retryCount; attempt += 1) {
            try {
                return await requestExternalQuizPayload(dateKey, movies);
            } catch (error) {
                lastExternalError = normalizeText(
                    error instanceof Error ? error.message : 'Daily quiz provider request failed.',
                    320
                ) || 'Daily quiz provider request failed.';
                if (attempt < retryCount) {
                    await sleep(attempt * 600);
                }
            }
        }

        if (!openAiApiKey) {
            throw new Error(lastExternalError);
        }
    }

    if (!openAiApiKey) {
        throw new Error('No daily quiz provider is configured.');
    }

    return {
        payload: await requestOpenAiQuizPayload(dateKey, movies),
        source: 'openai',
        sourceModel: OPENAI_DEFAULT_MODEL,
        strictQuestionCount: true
    };
};

const normalizeQuestionOptionMap = (
    options: unknown,
    questionKey: string
): Record<'a' | 'b' | 'c' | 'd', LocalizedRecord> => {
    const optionMap: Partial<Record<'a' | 'b' | 'c' | 'd', LocalizedRecord>> = {};
    for (const rawOption of toArray<OpenAiQuestionOption>(options)) {
        const key = normalizeSelectedOption(rawOption?.key);
        if (!key) continue;
        optionMap[key] = normalizeRequiredLocalizedRecord(rawOption?.translations);
    }

    if (!optionMap.a || !optionMap.b || !optionMap.c || !optionMap.d) {
        throw new Error(`Question ${questionKey} is missing one or more answer options.`);
    }

    return {
        a: optionMap.a,
        b: optionMap.b,
        c: optionMap.c,
        d: optionMap.d
    };
};

const normalizeExternalQuestionOptionMap = (
    rawQuestion: Record<string, unknown>,
    questionKey: string
): Record<'a' | 'b' | 'c' | 'd', LocalizedRecord> => {
    const translations = {
        tr: toObject(toObject(rawQuestion.tr)?.secenekler) || {},
        en: toObject(toObject(rawQuestion.en)?.secenekler) || {},
        es: toObject(toObject(rawQuestion.es)?.secenekler) || {},
        fr: toObject(toObject(rawQuestion.fr)?.secenekler) || {}
    };

    const result: Partial<Record<'a' | 'b' | 'c' | 'd', LocalizedRecord>> = {};
    for (const optionKey of ['a', 'b', 'c', 'd'] as const) {
        const upperKey = optionKey.toUpperCase();
        const perLanguage = {
            tr: normalizeText(translations.tr[upperKey] ?? translations.tr[optionKey], 320),
            en: normalizeText(translations.en[upperKey] ?? translations.en[optionKey], 320),
            es: normalizeText(translations.es[upperKey] ?? translations.es[optionKey], 320),
            fr: normalizeText(translations.fr[upperKey] ?? translations.fr[optionKey], 320)
        };

        result[optionKey] = normalizeRequiredLocalizedRecord(perLanguage);
    }

    if (!result.a || !result.b || !result.c || !result.d) {
        throw new Error(`Question ${questionKey} is missing one or more answer options.`);
    }

    return {
        a: result.a,
        b: result.b,
        c: result.c,
        d: result.d
    };
};

const normalizeInternalPreparedQuestions = (
    dateKey: string,
    movies: DailyQuizMovie[],
    payload: FlexibleQuizPayload,
    strictQuestionCount: boolean
): StoredDailyQuizQuestion[] => {
    const byMovieId = new Map<number, DailyQuizMovie>(movies.map((movie) => [movie.id, movie]));
    const movieOrderById = new Map<number, number>(movies.map((movie, index) => [movie.id, index]));
    const rawMovies = toArray<OpenAiMovieBlock>(payload.movies);
    const questions: StoredDailyQuizQuestion[] = [];

    for (const rawMovie of rawMovies) {
        const movieId = toInteger(rawMovie?.movieId);
        const movie = byMovieId.get(movieId);
        const movieOrder = movieOrderById.get(movieId);
        if (!movie) {
            throw new Error(`Quiz payload references unknown movie id: ${movieId || 'missing'}`);
        }
        if (!Number.isInteger(movieOrder)) {
            throw new Error(`Quiz payload is missing movie order for movie id: ${movieId}`);
        }
        const resolvedMovieOrder = Number(movieOrder);

        const movieTitle = normalizeText(rawMovie?.movieTitle, 180) || movie.title;
        const rawQuestions = toArray<OpenAiQuestion>(rawMovie?.questions);
        if (strictQuestionCount && rawQuestions.length !== DAILY_QUIZ_QUESTIONS_PER_MOVIE) {
            throw new Error(`Movie ${movie.title} returned ${rawQuestions.length} questions instead of 5.`);
        }
        if (rawQuestions.length > DAILY_QUIZ_QUESTIONS_PER_MOVIE) {
            throw new Error(`Movie ${movie.title} returned ${rawQuestions.length} questions which exceeds the limit of 5.`);
        }

        rawQuestions.forEach((rawQuestion, questionOrder) => {
            const questionKey =
                normalizeText(rawQuestion?.questionKey, 80) ||
                `${dateKey}:${movie.id}:q${questionOrder + 1}`;
            const correctOption = normalizeSelectedOption(rawQuestion?.correctOption);
            if (!correctOption) {
                throw new Error(`Question ${questionKey} is missing a valid correct option.`);
            }

            questions.push({
                id: crypto.randomUUID(),
                movieId: movie.id,
                movieTitle,
                movieOrder: resolvedMovieOrder,
                questionOrder,
                questionKey,
                questionTranslations: normalizeRequiredLocalizedRecord(rawQuestion?.questionTranslations),
                optionsTranslations: normalizeQuestionOptionMap(rawQuestion?.options, questionKey),
                correctOption,
                explanationTranslations: toObject(rawQuestion?.explanationTranslations)
                    ? normalizeRequiredLocalizedRecord(rawQuestion?.explanationTranslations)
                    : DEFAULT_EXPLANATION_TRANSLATIONS,
                metadata: {
                    movieYear: movie.year || null,
                    movieGenre: movie.genre || null,
                    questionType: 'internal'
                }
            });
        });
    }

    const expectedQuestionCount = movies.length * DAILY_QUIZ_QUESTIONS_PER_MOVIE;
    if (strictQuestionCount && questions.length !== expectedQuestionCount) {
        throw new Error(`Quiz payload returned ${questions.length} questions instead of ${expectedQuestionCount}.`);
    }

    return questions.sort((left, right) => {
        if (left.movieOrder !== right.movieOrder) return left.movieOrder - right.movieOrder;
        return left.questionOrder - right.questionOrder;
    });
};

const normalizeExternalPreparedQuestions = (
    dateKey: string,
    movies: DailyQuizMovie[],
    payload: FlexibleQuizPayload
): StoredDailyQuizQuestion[] => {
    const movieOrderById = new Map<number, number>(movies.map((movie, index) => [movie.id, index]));
    const rawFilms = toArray<Record<string, unknown>>(payload.films);
    const rawByMovieId = new Map<number, Record<string, unknown>>();

    for (const rawFilm of rawFilms) {
        const movieId = toInteger(rawFilm?.film_id ?? rawFilm?.movieId ?? rawFilm?.id);
        if (!movieId) continue;
        rawByMovieId.set(movieId, rawFilm);
    }

    const questions: StoredDailyQuizQuestion[] = [];

    for (const movie of movies) {
        const rawFilm = rawByMovieId.get(movie.id);
        const isInsufficientData =
            rawFilm?.yetersiz_veri === true ||
            normalizeText(rawFilm?.yetersiz_veri, 16).toLowerCase() === 'true';
        if (!rawFilm || isInsufficientData) continue;

        const movieOrder = movieOrderById.get(movie.id);
        if (!Number.isInteger(movieOrder)) {
            throw new Error(`Quiz payload is missing movie order for movie id: ${movie.id}`);
        }

        const rawQuestions = toArray<Record<string, unknown>>(rawFilm.sorular);
        if (rawQuestions.length > DAILY_QUIZ_QUESTIONS_PER_MOVIE) {
            throw new Error(`Movie ${movie.title} returned ${rawQuestions.length} questions which exceeds the limit of 5.`);
        }

        rawQuestions.forEach((rawQuestion, index) => {
            const requestedIndex = toInteger(rawQuestion.index, index + 1);
            const questionOrder = Math.max(0, Math.min(DAILY_QUIZ_QUESTIONS_PER_MOVIE - 1, requestedIndex - 1 || index));
            const questionKey =
                normalizeText(rawQuestion.questionKey, 80) ||
                `${dateKey}:${movie.id}:q${questionOrder + 1}`;
            const correctOption =
                normalizeSelectedOption(rawQuestion.dogru) ||
                normalizeSelectedOption(toObject(rawQuestion.tr)?.dogru) ||
                normalizeSelectedOption(toObject(rawQuestion.en)?.dogru) ||
                normalizeSelectedOption(toObject(rawQuestion.es)?.dogru) ||
                normalizeSelectedOption(toObject(rawQuestion.fr)?.dogru);

            if (!correctOption) {
                throw new Error(`Question ${questionKey} is missing a valid correct option.`);
            }

            questions.push({
                id: crypto.randomUUID(),
                movieId: movie.id,
                movieTitle: normalizeText(rawFilm.title || movie.title, 180) || movie.title,
                movieOrder: Number(movieOrder),
                questionOrder,
                questionKey,
                questionTranslations: normalizeRequiredLocalizedRecord({
                    tr: toObject(rawQuestion.tr)?.soru,
                    en: toObject(rawQuestion.en)?.soru,
                    es: toObject(rawQuestion.es)?.soru,
                    fr: toObject(rawQuestion.fr)?.soru
                }),
                optionsTranslations: normalizeExternalQuestionOptionMap(rawQuestion, questionKey),
                correctOption,
                explanationTranslations: DEFAULT_EXPLANATION_TRANSLATIONS,
                metadata: {
                    movieYear: movie.year || null,
                    movieGenre: movie.genre || null,
                    questionType: normalizeText(rawQuestion.tip, 40) || 'external_prompt'
                }
            });
        });
    }

    return questions.sort((left, right) => {
        if (left.movieOrder !== right.movieOrder) return left.movieOrder - right.movieOrder;
        return left.questionOrder - right.questionOrder;
    });
};

const normalizePreparedQuestions = (
    dateKey: string,
    movies: DailyQuizMovie[],
    payload: FlexibleQuizPayload,
    options: {
        strictQuestionCount?: boolean;
    } = {}
): StoredDailyQuizQuestion[] => {
    const payloadObject = toObject(payload) || {};
    if (Array.isArray(payloadObject.films)) {
        return normalizeExternalPreparedQuestions(dateKey, movies, payloadObject);
    }

    return normalizeInternalPreparedQuestions(
        dateKey,
        movies,
        payloadObject,
        Boolean(options.strictQuestionCount)
    );
};

const validatePreparedQuestions = (
    movies: DailyQuizMovie[],
    questions: StoredDailyQuizQuestion[]
): void => {
    const movieIds = new Set(movies.map((movie) => movie.id));
    const duplicateQuestionKeys = new Set<string>();
    const duplicateQuestionTexts = new Set<string>();

    for (const question of questions) {
        if (!movieIds.has(question.movieId)) {
            throw new Error(`Quiz payload references unknown movie id: ${question.movieId}`);
        }

        assertCompleteLocalizedRecord(
            question.questionTranslations,
            `Question ${question.questionKey}`
        );
        assertCompleteLocalizedRecord(
            question.explanationTranslations,
            `Explanation ${question.questionKey}`
        );

        for (const optionKey of ['a', 'b', 'c', 'd'] as const) {
            assertCompleteLocalizedRecord(
                question.optionsTranslations[optionKey],
                `Option ${question.questionKey}:${optionKey}`
            );
        }

        const duplicateQuestionKey = `${question.movieId}:${normalizeDuplicateTextKey(question.questionKey)}`;
        if (duplicateQuestionKeys.has(duplicateQuestionKey)) {
            throw new Error(`Movie ${question.movieTitle} contains duplicate question keys.`);
        }
        duplicateQuestionKeys.add(duplicateQuestionKey);

        for (const language of DAILY_QUIZ_LANGUAGES) {
            const candidateText = normalizeDuplicateTextKey(question.questionTranslations[language]);
            if (!candidateText) continue;
            const duplicateTextKey = `${question.movieId}:${language}:${candidateText}`;
            if (duplicateQuestionTexts.has(duplicateTextKey)) {
                throw new Error(`Movie ${question.movieTitle} contains duplicate questions.`);
            }
            duplicateQuestionTexts.add(duplicateTextKey);
        }
    }
};

const readStoredQuestions = (rows: DailyQuizQuestionRow[]): StoredDailyQuizQuestion[] => {
    return rows
        .map((row) => {
            const id = normalizeUuid(row.id);
            const correctOption = normalizeSelectedOption(row.correct_option);
            if (!id || !correctOption) return null;

            return {
                id,
                movieId: toInteger(row.movie_id),
                movieTitle: normalizeText(row.movie_title, 180),
                movieOrder: toInteger(row.movie_order),
                questionOrder: toInteger(row.question_order),
                questionKey: normalizeText(row.question_key, 80),
                questionTranslations: normalizeLocalizedRecord(row.question_translations),
                optionsTranslations: normalizeQuestionOptionMap(
                    Object.entries(toObject(row.options_translations) || {}).map(([key, translations]) => ({
                        key,
                        translations
                    })),
                    normalizeText(row.question_key, 80)
                ),
                correctOption,
                explanationTranslations: normalizeLocalizedRecord(row.explanation_translations),
                metadata: toObject(row.metadata) || {}
            };
        })
        .filter((row): row is StoredDailyQuizQuestion => Boolean(row));
};

const storePreparedBatch = async (
    supabase: ReturnType<typeof createServiceClient>,
    dateKey: string,
    movies: DailyQuizMovie[],
    questions: StoredDailyQuizQuestion[],
    options: {
        status?: 'prepared' | 'published';
        source?: string;
        sourceModel?: string | null;
        metadata?: Record<string, unknown>;
    } = {}
): Promise<void> => {
    const status = normalizeText(options.status || 'prepared', 24) || 'prepared';
    const source = normalizeText(options.source || 'openai', 120) || 'openai';
    const sourceModel = normalizeText(options.sourceModel || OPENAI_DEFAULT_MODEL, 120) || OPENAI_DEFAULT_MODEL;
    const metadata = {
        movieCount: movies.length,
        ...(options.metadata || {})
    };
    const { error: batchError } = await supabase
        .from('daily_quiz_batches')
        .upsert(
            {
                date: dateKey,
                status,
                source,
                source_model: sourceModel,
                movies,
                question_count: questions.length,
                language_codes: DAILY_QUIZ_LANGUAGES,
                prepared_at: new Date().toISOString(),
                published_at: status === 'published' ? new Date().toISOString() : null,
                metadata,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'date' }
        );

    if (batchError) {
        throw new Error(batchError.message);
    }

    const { error: deleteError } = await supabase
        .from('daily_movie_questions')
        .delete()
        .eq('batch_date', dateKey);
    if (deleteError) {
        throw new Error(deleteError.message);
    }

    const rows = questions.map((question) => ({
        id: question.id,
        batch_date: dateKey,
        movie_id: question.movieId,
        movie_title: question.movieTitle,
        movie_order: question.movieOrder,
        question_order: question.questionOrder,
        question_key: question.questionKey,
        question_translations: question.questionTranslations,
        options_translations: question.optionsTranslations,
        correct_option: question.correctOption,
        explanation_translations: question.explanationTranslations,
        metadata: question.metadata
    }));

    const { error: insertError } = await supabase
        .from('daily_movie_questions')
        .insert(rows);
    if (insertError) {
        throw new Error(insertError.message);
    }
};

const readPreparedBatch = async (
    supabase: ReturnType<typeof createServiceClient>,
    dateKey: string
): Promise<{ batch: DailyQuizBatchRow | null; questions: StoredDailyQuizQuestion[] }> => {
    const { data: batchRow, error: batchError } = await supabase
        .from('daily_quiz_batches')
        .select('date,status,source,source_model,movies,question_count,language_codes,prepared_at,published_at,metadata,updated_at')
        .eq('date', dateKey)
        .maybeSingle();
    if (batchError && batchError.code !== 'PGRST116') {
        throw new Error(batchError.message);
    }

    const { data: questionRows, error: questionError } = await supabase
        .from('daily_movie_questions')
        .select('id,batch_date,movie_id,movie_title,movie_order,question_order,question_key,question_translations,options_translations,correct_option,explanation_translations,metadata')
        .eq('batch_date', dateKey)
        .order('movie_order', { ascending: true })
        .order('question_order', { ascending: true });
    if (questionError) {
        throw new Error(questionError.message);
    }

    return {
        batch: (batchRow || null) as DailyQuizBatchRow | null,
        questions: readStoredQuestions((questionRows || []) as DailyQuizQuestionRow[])
    };
};

const normalizeStoredProgress = (row: DailyQuizProgressRow | null | undefined): StoredDailyQuizProgress => {
    const metadata = toObject(row?.metadata) || {};
    return {
        answeredCount: Math.max(0, toInteger(row?.answered_count)),
        correctCount: Math.max(0, toInteger(row?.correct_count)),
        completedMovieIds: Array.from(
            new Set(
                toArray<unknown>(row?.completed_movie_ids)
                    .map((value) => toInteger(value))
                    .filter((value) => value > 0)
            )
        ),
        streakProtected: Boolean(row?.streak_protected),
        streakProtectedAt: normalizeText(row?.streak_protected_at, 80) || null,
        xpAwarded: toInteger(row?.xp_awarded),
        lastAnsweredAt: normalizeText(row?.last_answered_at, 80) || null,
        metadata
    };
};

const deriveProgressFromAttempts = (
    attempts: DailyQuizAttemptRow[],
    questions: StoredDailyQuizQuestion[],
    previousProgress: StoredDailyQuizProgress | null
): StoredDailyQuizProgress => {
    const answeredCount = attempts.length;
    const correctCount = attempts.reduce((count, attempt) => count + (attempt.is_correct ? 1 : 0), 0);
    const byMovie = new Map<number, { answered: number; correct: number }>();
    const availableQuestionCountByMovie = new Map<number, number>();

    for (const question of questions) {
        const movieId = toInteger(question.movieId);
        if (!movieId) continue;
        availableQuestionCountByMovie.set(movieId, (availableQuestionCountByMovie.get(movieId) || 0) + 1);
    }

    for (const attempt of attempts) {
        const movieId = toInteger(attempt.movie_id);
        if (!movieId) continue;
        const current = byMovie.get(movieId) || { answered: 0, correct: 0 };
        current.answered += 1;
        current.correct += attempt.is_correct ? 1 : 0;
        byMovie.set(movieId, current);
    }

    const completedMovieIds = Array.from(byMovie.entries())
        .filter(([movieId, value]) => {
            const availableQuestionCount = availableQuestionCountByMovie.get(movieId) || 0;
            const requiredCorrectCount = getRequiredCorrectCount(availableQuestionCount);
            return availableQuestionCount > 0 && value.correct >= requiredCorrectCount;
        })
        .map(([movieId]) => movieId)
        .sort((left, right) => left - right);

    return {
        answeredCount,
        correctCount,
        completedMovieIds,
        streakProtected:
            Boolean(previousProgress?.streakProtected) ||
            completedMovieIds.length > 0,
        streakProtectedAt: previousProgress?.streakProtectedAt || null,
        xpAwarded: previousProgress?.xpAwarded || 0,
        lastAnsweredAt:
            normalizeText(attempts[attempts.length - 1]?.answered_at, 80) ||
            previousProgress?.lastAnsweredAt ||
            new Date().toISOString(),
        metadata: previousProgress?.metadata || {}
    };
};

const computeQuizXpDelta = (
    wasCorrect: boolean,
    previousProgress: StoredDailyQuizProgress,
    nextProgress: StoredDailyQuizProgress
): number => {
    let delta = wasCorrect ? DAILY_QUIZ_XP_PER_CORRECT : 0;
    const previousCompleted = new Set(previousProgress.completedMovieIds);
    const newlyCompletedCount = nextProgress.completedMovieIds.filter((movieId) => !previousCompleted.has(movieId)).length;
    for (let index = 0; index < newlyCompletedCount; index += 1) {
        delta += previousCompleted.size + index === 0
            ? DAILY_QUIZ_XP_FIRST_COMPLETION
            : DAILY_QUIZ_XP_EXTRA_COMPLETION;
    }
    return delta;
};

export const readPreparedDailyQuizMovies = async (dateKey: string): Promise<{
    ok: true;
    date: string;
    status: string;
    movies: DailyQuizMovie[];
    questionCount: number;
} | {
    ok: false;
    error: string;
    status?: number;
}> => {
    try {
        const batch = await readDailyQuizBatchViaRest(dateKey);
        const status = normalizeText(batch?.status, 40);
        const movies = toArray<unknown>(batch?.movies)
            .map((movie) => normalizeMovie(movie))
            .filter((movie): movie is DailyQuizMovie => Boolean(movie));

        if (!batch || movies.length === 0) {
            return {
                ok: false,
                error: 'Prepared daily quiz batch was not found.',
                status: 404
            };
        }

        return {
            ok: true,
            date: dateKey,
            status,
            movies,
            questionCount: toInteger(batch.question_count)
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Prepared daily quiz read failed.', 320),
            status: 500
        };
    }
};

const updateProfileXpStateForQuiz = async (input: {
    supabase: ReturnType<typeof createServiceClient>;
    userId: string;
    email: string;
    xpDelta: number;
    dateKey: string;
    shouldProtectStreak: boolean;
}): Promise<{ totalXP: number | null; streak: number | null }> => {
    const { data: profileRow, error: profileError } = await input.supabase
        .from('profiles')
        .select('user_id,email,display_name,xp_state')
        .eq('user_id', input.userId)
        .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
        throw new Error(profileError.message);
    }

    const currentProfile = (profileRow || {}) as ProfileRow;
    const currentState = toObject(currentProfile.xp_state) || {};
    const currentTotalXp = toInteger(currentState.totalXP);
    const currentStreak = toInteger(currentState.streak);
    const currentLastStreakDate = normalizeText(currentState.lastStreakDate, 40) || null;
    const currentActiveDays = Array.from(
        new Set(
            toArray<unknown>(currentState.activeDays)
                .map((value) => normalizeText(value, 40))
                .filter(Boolean)
        )
    );

    let nextStreak = currentStreak;
    let nextLastStreakDate = currentLastStreakDate;
    let nextActiveDays = currentActiveDays;

    if (input.shouldProtectStreak && currentLastStreakDate !== input.dateKey) {
        const todayDayIndex = parseDateKeyToDayIndex(input.dateKey);
        const lastDayIndex = currentLastStreakDate ? parseDateKeyToDayIndex(currentLastStreakDate) : null;
        if (todayDayIndex !== null && lastDayIndex !== null && todayDayIndex - lastDayIndex === 1) {
            nextStreak = Math.max(1, currentStreak) + 1;
        } else {
            nextStreak = 1;
        }
        nextLastStreakDate = input.dateKey;
        nextActiveDays = Array.from(new Set([...currentActiveDays, input.dateKey])).sort();
    }

    const nextTotalXp = currentTotalXp + Math.max(0, input.xpDelta);
    const nextState = {
        ...currentState,
        totalXP: nextTotalXp,
        streak: nextStreak,
        lastStreakDate: nextLastStreakDate,
        activeDays: nextActiveDays
    };

    const { error: upsertError } = await input.supabase
        .from('profiles')
        .upsert(
            {
                user_id: input.userId,
                email: normalizeText(currentProfile.email, 240) || input.email,
                display_name: normalizeText(currentProfile.display_name, 180) || normalizeText(input.email.split('@')[0], 120),
                xp_state: nextState,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
        );

    if (upsertError) {
        throw new Error(upsertError.message);
    }

    return {
        totalXP: nextTotalXp,
        streak: nextStreak
    };
};

export const prepareDailyQuizBatch = async (input: {
    dateKey: string;
    movies: DailyQuizMovie[];
    force?: boolean;
}): Promise<PreparedBatchResult> => {
    try {
        const supabase = createServiceClient();
        const existing = await readPreparedBatch(supabase, input.dateKey);
        const expectedQuestionCount = input.movies.length * DAILY_QUIZ_QUESTIONS_PER_MOVIE;
        const existingStatus = normalizeText(existing.batch?.status, 40);
        const preferredSource = getAnthropicApiKey()
            ? 'anthropic'
            : getDailyQuizApiUrl()
                ? 'external_quiz_api'
                : 'openai';
        const preferredSourceModel = getAnthropicApiKey()
            ? getAnthropicDailyQuizModel()
            : getDailyQuizApiUrl()
                ? getDailyQuizApiModel()
                : OPENAI_DEFAULT_MODEL;

        if (
            !input.force &&
            existing.questions.length > 0 &&
            (existingStatus === 'prepared' || existingStatus === 'published') &&
            (existing.questions.length === expectedQuestionCount || normalizeText(existing.batch?.source, 120) !== 'openai')
        ) {
            return {
                ok: true,
                reused: true,
                date: input.dateKey,
                questionCount: existing.questions.length,
                sourceModel: normalizeText(existing.batch?.source_model, 120) || preferredSourceModel
            };
        }

        const { error: markPreparingError } = await supabase
            .from('daily_quiz_batches')
            .upsert(
                {
                    date: input.dateKey,
                    status: 'preparing',
                    source: preferredSource,
                    source_model: preferredSourceModel,
                    movies: input.movies,
                    language_codes: DAILY_QUIZ_LANGUAGES,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'date' }
            );
        if (markPreparingError) {
            throw new Error(markPreparingError.message);
        }

        const requestedQuiz = await requestPreferredQuizPayload(input.dateKey, input.movies);
        const questions = normalizePreparedQuestions(input.dateKey, input.movies, requestedQuiz.payload, {
            strictQuestionCount: requestedQuiz.strictQuestionCount
        });
        validatePreparedQuestions(input.movies, questions);
        await storePreparedBatch(supabase, input.dateKey, input.movies, questions, {
            source: requestedQuiz.source,
            sourceModel: requestedQuiz.sourceModel,
            metadata: {
                provider: requestedQuiz.source
            }
        });

        return {
            ok: true,
            reused: false,
            date: input.dateKey,
            questionCount: questions.length,
            sourceModel: requestedQuiz.sourceModel
        };
    } catch (error) {
        try {
            const supabase = createServiceClient();
            await supabase
                .from('daily_quiz_batches')
                .upsert(
                    {
                        date: input.dateKey,
                        status: 'failed',
                        source: getAnthropicApiKey()
                            ? 'anthropic'
                            : getDailyQuizApiUrl()
                                ? 'external_quiz_api'
                                : 'openai',
                        source_model: getAnthropicApiKey()
                            ? getAnthropicDailyQuizModel()
                            : getDailyQuizApiUrl()
                                ? getDailyQuizApiModel()
                                : OPENAI_DEFAULT_MODEL,
                        movies: input.movies,
                        metadata: {
                            error: normalizeText(error instanceof Error ? error.message : 'Daily quiz prepare failed.', 320)
                        },
                        updated_at: new Date().toISOString()
                    },
                    { onConflict: 'date' }
                );
        } catch {
            // noop
        }

        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Daily quiz prepare failed.', 320),
            status: 500
        };
    }
};

export const importDailyQuizBatch = async (input: {
    dateKey: string;
    payload: unknown;
    publish?: boolean;
    source?: string;
    sourceModel?: string | null;
}): Promise<{
    ok: true;
    date: string;
    questionCount: number;
    batchStatus: string;
} | {
    ok: false;
    error: string;
    status?: number;
}> => {
    try {
        const supabase = createServiceClient();
        const existing = await readPreparedBatch(supabase, input.dateKey);
        const movies = toArray<unknown>(existing.batch?.movies)
            .map((movie) => normalizeMovie(movie))
            .filter((movie): movie is DailyQuizMovie => Boolean(movie));

        if (!existing.batch || movies.length === 0) {
            return {
                ok: false,
                error: 'Prepared daily quiz source batch was not found.',
                status: 404
            };
        }

        const payloadObject = toObject(input.payload);
        const normalizedPayload: FlexibleQuizPayload = payloadObject
            ? {
                  movies: Array.isArray(payloadObject.movies) ? payloadObject.movies : undefined,
                  films: Array.isArray(payloadObject.films) ? payloadObject.films : undefined
              }
            : {};
        const questions = normalizePreparedQuestions(input.dateKey, movies, normalizedPayload);
        validatePreparedQuestions(movies, questions);
        const shouldPublish = Boolean(input.publish);

        await storePreparedBatch(supabase, input.dateKey, movies, questions, {
            status: shouldPublish ? 'published' : 'prepared',
            source: normalizeText(input.source, 120) || 'external_codex',
            sourceModel: normalizeText(input.sourceModel, 120) || 'external_codex',
            metadata: {
                importedExternally: true,
                importedAt: new Date().toISOString()
            }
        });

        return {
            ok: true,
            date: input.dateKey,
            questionCount: questions.length,
            batchStatus: shouldPublish ? 'published' : 'prepared'
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Daily quiz import failed.', 320),
            status: 500
        };
    }
};

export const publishDailyQuizBatch = async (input: {
    dateKey: string;
    movies: DailyQuizMovie[];
}): Promise<PublishBatchResult> => {
    try {
        const supabase = createServiceClient();
        const existing = await readPreparedBatch(supabase, input.dateKey);
        const questionCount = existing.questions.length;

        const { error } = await supabase
            .from('daily_quiz_batches')
            .upsert(
                {
                    date: input.dateKey,
                    status: questionCount > 0 ? 'published' : 'failed',
                    source: 'openai',
                    source_model: normalizeText(existing.batch?.source_model, 120) || OPENAI_DEFAULT_MODEL,
                    movies: input.movies,
                    question_count: questionCount,
                    language_codes: DAILY_QUIZ_LANGUAGES,
                    prepared_at: normalizeText(existing.batch?.prepared_at, 80) || null,
                    published_at: questionCount > 0 ? new Date().toISOString() : null,
                    metadata: {
                        ...(toObject(existing.batch?.metadata) || {}),
                        publishedWithoutQuestions: questionCount === 0
                    },
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'date' }
            );

        if (error) {
            throw new Error(error.message);
        }

        return {
            ok: true,
            date: input.dateKey,
            questionCount,
            batchStatus: questionCount > 0 ? 'published' : 'failed'
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Daily quiz publish failed.', 320),
            status: 500
        };
    }
};

export const getQuizTargetDateKey = (offsetDays = 0): string => {
    const current = getDailyDateKey();
    if (!Number.isFinite(offsetDays) || offsetDays === 0) return current;
    return getDateKeyDaysFrom(current, Math.trunc(offsetDays));
};

export const readDailyQuizBundle = async (input: {
    dateKey?: string | null;
    language?: string | null;
    headers?: Record<string, string | undefined> | Headers;
}): Promise<DailyQuizBundleResult> => {
    try {
        const dateKey = normalizeText(input.dateKey, 40) || getDailyDateKey();
        const language = normalizeLanguage(input.language);
        const supabase = createServiceClient();
        const batch = await readPreparedBatch(supabase, dateKey);
        const status = normalizeText(batch.batch?.status, 40);
        const movies = toArray<unknown>(batch.batch?.movies)
            .map((movie) => normalizeMovie(movie))
            .filter((movie): movie is DailyQuizMovie => Boolean(movie));

        if (!batch.batch || batch.questions.length === 0 || movies.length === 0 || status !== 'published') {
            return {
                ok: false,
                error: 'Daily quiz bundle is not ready.',
                status: 404
            };
        }

        let attempts: DailyQuizAttemptRow[] = [];
        let progress: StoredDailyQuizProgress | null = null;
        const accessToken = getBearerToken(input.headers);
        if (accessToken) {
            const authUser = await readAuthUser(accessToken);
            if (authUser?.id) {
                const { data: attemptRows, error: attemptError } = await supabase
                    .from('daily_quiz_attempts')
                    .select('question_id,selected_option,is_correct,answered_at,movie_id')
                    .eq('batch_date', dateKey)
                    .eq('user_id', authUser.id)
                    .order('answered_at', { ascending: true });
                if (attemptError) {
                    throw new Error(attemptError.message);
                }
                attempts = (attemptRows || []) as DailyQuizAttemptRow[];

                const { data: progressRow, error: progressError } = await supabase
                    .from('daily_quiz_user_progress')
                    .select('batch_date,user_id,answered_count,correct_count,completed_movie_ids,streak_protected,streak_protected_at,xp_awarded,last_answered_at,metadata')
                    .eq('batch_date', dateKey)
                    .eq('user_id', authUser.id)
                    .maybeSingle();
                if (progressError && progressError.code !== 'PGRST116') {
                    throw new Error(progressError.message);
                }
                progress = progressRow ? normalizeStoredProgress(progressRow as DailyQuizProgressRow) : null;
            }
        }

        const attemptMap = new Map<string, DailyQuizAttemptRow>();
        for (const attempt of attempts) {
            const questionId = normalizeUuid(attempt.question_id);
            if (!questionId) continue;
            attemptMap.set(questionId, attempt);
        }

        const movieBlocks = movies
            .map((movie, movieOrder) => {
                const questions = batch.questions
                    .filter((question) => question.movieId === movie.id)
                    .sort((left, right) => left.questionOrder - right.questionOrder)
                    .map((question) => {
                        const attempt = attemptMap.get(question.id) || null;
                        const selectedOption = normalizeSelectedOption(attempt?.selected_option);
                        return {
                            id: question.id,
                            questionKey: question.questionKey,
                            questionOrder: question.questionOrder,
                            question: pickTranslation(question.questionTranslations, language),
                            options: (['a', 'b', 'c', 'd'] as const).map((key) => ({
                                key,
                                label: pickTranslation(question.optionsTranslations[key], language)
                            })),
                            attempt: attempt && selectedOption
                                ? {
                                      selectedOption,
                                      isCorrect: Boolean(attempt.is_correct),
                                      answeredAt: normalizeText(attempt.answered_at, 80) || new Date().toISOString(),
                                      explanation: pickTranslation(question.explanationTranslations, language)
                                  }
                                : null
                        };
                    });

                return {
                    movieId: movie.id,
                    movieTitle: movie.title,
                    movieOrder,
                    requiredCorrectCount: getRequiredCorrectCount(questions.length),
                    questions
                };
            })
            .filter((block) => block.questions.length > 0);

        return {
            ok: true,
            date: dateKey,
            status,
            movies,
            language,
            questionCount: batch.questions.length,
            questionsByMovie: movieBlocks,
            progress
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Daily quiz bundle failed.', 320),
            status: 500
        };
    }
};

export const submitDailyQuizAnswer = async (input: {
    headers?: Record<string, string | undefined> | Headers;
    dateKey?: string | null;
    questionId?: unknown;
    selectedOption?: unknown;
    language?: string | null;
}): Promise<SubmitAnswerResult> => {
    try {
        const accessToken = getBearerToken(input.headers);
        if (!accessToken) {
            return {
                ok: false,
                error: 'Missing bearer token.',
                status: 401
            };
        }

        const authUser = await readAuthUser(accessToken);
        if (!authUser?.id) {
            return {
                ok: false,
                error: 'Authentication failed.',
                status: 401
            };
        }

        const language = normalizeLanguage(input.language);
        const questionId = normalizeUuid(input.questionId);
        const selectedOption = normalizeSelectedOption(input.selectedOption);
        if (!questionId || !selectedOption) {
            return {
                ok: false,
                error: 'Question id or selected option is invalid.',
                status: 400
            };
        }

        const supabase = createServiceClient();
        const { data: questionRow, error: questionError } = await supabase
            .from('daily_movie_questions')
            .select('id,batch_date,movie_id,movie_title,movie_order,question_order,question_key,question_translations,options_translations,correct_option,explanation_translations,metadata')
            .eq('id', questionId)
            .maybeSingle();
        if (questionError && questionError.code !== 'PGRST116') {
            throw new Error(questionError.message);
        }
        if (!questionRow) {
            return {
                ok: false,
                error: 'Question was not found.',
                status: 404
            };
        }

        const question = readStoredQuestions([questionRow as DailyQuizQuestionRow])[0] || null;
        if (!question) {
            return {
                ok: false,
                error: 'Question payload is invalid.',
                status: 500
            };
        }

        const questionBatchDate = normalizeText((questionRow as DailyQuizQuestionRow).batch_date, 40) || '';
        if (!questionBatchDate) {
            return {
                ok: false,
                error: 'Question batch date is invalid.',
                status: 500
            };
        }
        const requestedDateKey = normalizeText(input.dateKey, 40);
        if (requestedDateKey && requestedDateKey !== questionBatchDate) {
            return {
                ok: false,
                error: 'Question does not belong to the requested daily quiz date.',
                status: 400
            };
        }

        const { data: batchRow, error: batchError } = await supabase
            .from('daily_quiz_batches')
            .select('status')
            .eq('date', questionBatchDate)
            .maybeSingle();
        if (batchError && batchError.code !== 'PGRST116') {
            throw new Error(batchError.message);
        }
        const batchStatus = normalizeText((batchRow as DailyQuizBatchRow | null)?.status, 40);
        if (batchStatus !== 'published') {
            return {
                ok: false,
                error: 'Daily quiz bundle is not ready.',
                status: 404
            };
        }

        const batchDate = questionBatchDate;
        const { data: existingAttempt, error: existingAttemptError } = await supabase
            .from('daily_quiz_attempts')
            .select('question_id,selected_option,is_correct,answered_at,movie_id')
            .eq('question_id', questionId)
            .eq('user_id', authUser.id)
            .maybeSingle();
        if (existingAttemptError && existingAttemptError.code !== 'PGRST116') {
            throw new Error(existingAttemptError.message);
        }

        let alreadyAnswered = false;
        let isCorrect = false;
        if (existingAttempt) {
            alreadyAnswered = true;
            isCorrect = Boolean((existingAttempt as DailyQuizAttemptRow).is_correct);
        } else {
            isCorrect = question.correctOption === selectedOption;
            const { error: insertError } = await supabase
                .from('daily_quiz_attempts')
                .insert({
                    batch_date: batchDate,
                    question_id: questionId,
                    user_id: authUser.id,
                    movie_id: question.movieId,
                    selected_option: selectedOption,
                    is_correct: isCorrect,
                    metadata: {
                        questionKey: question.questionKey
                    }
                });
            if (insertError) {
                throw new Error(insertError.message);
            }
        }

        const { data: progressRow, error: progressError } = await supabase
            .from('daily_quiz_user_progress')
            .select('batch_date,user_id,answered_count,correct_count,completed_movie_ids,streak_protected,streak_protected_at,xp_awarded,last_answered_at,metadata')
            .eq('batch_date', batchDate)
            .eq('user_id', authUser.id)
            .maybeSingle();
        if (progressError && progressError.code !== 'PGRST116') {
            throw new Error(progressError.message);
        }
        const previousProgress = normalizeStoredProgress((progressRow || null) as DailyQuizProgressRow | null);

        const { data: attemptRows, error: attemptRowsError } = await supabase
            .from('daily_quiz_attempts')
            .select('question_id,selected_option,is_correct,answered_at,movie_id')
            .eq('batch_date', batchDate)
            .eq('user_id', authUser.id)
            .order('answered_at', { ascending: true });
        if (attemptRowsError) {
            throw new Error(attemptRowsError.message);
        }

        const attempts = (attemptRows || []) as DailyQuizAttemptRow[];
        const { data: batchQuestionRows, error: batchQuestionError } = await supabase
            .from('daily_movie_questions')
            .select('id,batch_date,movie_id,movie_title,movie_order,question_order,question_key,question_translations,options_translations,correct_option,explanation_translations,metadata')
            .eq('batch_date', batchDate)
            .order('movie_order', { ascending: true })
            .order('question_order', { ascending: true });
        if (batchQuestionError) {
            throw new Error(batchQuestionError.message);
        }

        const batchQuestions = readStoredQuestions((batchQuestionRows || []) as DailyQuizQuestionRow[]);
        const nextProgress = deriveProgressFromAttempts(attempts, batchQuestions, previousProgress);
        const streakProtectedNow = nextProgress.completedMovieIds.length > 0 && !previousProgress.streakProtected;
        const xpDelta = alreadyAnswered ? 0 : computeQuizXpDelta(isCorrect, previousProgress, nextProgress);
        const xpSummary = xpDelta > 0 || streakProtectedNow
            ? await updateProfileXpStateForQuiz({
                  supabase,
                  userId: authUser.id,
                  email: authUser.email,
                  xpDelta,
                  dateKey: batchDate,
                  shouldProtectStreak: nextProgress.completedMovieIds.length > 0
              })
            : { totalXP: null, streak: null };

        const persistedProgress: StoredDailyQuizProgress = {
            ...nextProgress,
            streakProtected: nextProgress.completedMovieIds.length > 0,
            streakProtectedAt:
                nextProgress.completedMovieIds.length > 0
                    ? nextProgress.streakProtectedAt || new Date().toISOString()
                    : null,
            xpAwarded: previousProgress.xpAwarded + xpDelta,
            lastAnsweredAt: normalizeText(attempts[attempts.length - 1]?.answered_at, 80) || new Date().toISOString()
        };

        const { error: upsertProgressError } = await supabase
            .from('daily_quiz_user_progress')
            .upsert(
                {
                    batch_date: batchDate,
                    user_id: authUser.id,
                    answered_count: persistedProgress.answeredCount,
                    correct_count: persistedProgress.correctCount,
                    completed_movie_ids: persistedProgress.completedMovieIds,
                    streak_protected: persistedProgress.streakProtected,
                    streak_protected_at: persistedProgress.streakProtectedAt,
                    xp_awarded: persistedProgress.xpAwarded,
                    last_answered_at: persistedProgress.lastAnsweredAt,
                    metadata: persistedProgress.metadata,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'batch_date,user_id' }
            );
        if (upsertProgressError) {
            throw new Error(upsertProgressError.message);
        }

        return {
            ok: true,
            questionId,
            selectedOption,
            isCorrect,
            alreadyAnswered,
            explanation: pickTranslation(question.explanationTranslations, language),
            progress: persistedProgress,
            xp: {
                delta: xpDelta,
                total: xpSummary.totalXP,
                streak: xpSummary.streak,
                streakProtectedNow
            }
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Daily quiz answer failed.', 320),
            status: 500
        };
    }
};
