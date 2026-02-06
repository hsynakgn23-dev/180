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

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const IMAGE_SOURCE_PROXIES = ['https://images.weserv.nl/?url=', 'https://wsrv.nl/?url='];

const getEnv = (key: string, required = true): string => {
    const value = process.env[key];
    if (!value && required) throw new Error(`Missing env: ${key}`);
    return value || '';
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
    let contentType: string | null = null;
    let bytes: Uint8Array | null = null;
    let fetchError = 'fetch_failed';

    for (const sourceUrl of sources) {
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
        return { url: null, error: fetchError };
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

    const [w500Result, w200Result] = await Promise.all([
        uploadPoster(supabase, bucket, movie.id, movie.posterPath, 'w500'),
        uploadPoster(supabase, bucket, movie.id, movie.posterPath, 'w200')
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
        posterPath: w500Result.url || movie.posterPath,
        posterStoragePath: w500Result.url || null,
        posterThumbPath: w200Result.url || null,
        posterSource: w500Result.url ? 'storage' : 'tmdb'
    } as Movie & {
        posterStoragePath?: string | null;
        posterThumbPath?: string | null;
        posterSource?: string;
    };
};

const buildSeedMovies = (): Movie[] => {
    return DEFAULT_SEED_MOVIES.slice(0, 5).map((movie, index) => ({
        ...movie,
        slotLabel: DEFAULT_SLOT_LABELS[index] || movie.slotLabel,
        color: DEFAULT_GRADIENTS[index] || movie.color
    }));
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
        const forceValue = getQueryParam(req, 'force');
        const force = forceValue === '1' || forceValue === 'true';

        const { data: existing, error: readError } = await supabase
            .from('daily_showcase')
            .select('*')
            .eq('date', todayKey)
            .single();

        if (readError && readError.code !== 'PGRST116') {
            return sendJson(res, 500, { error: readError.message });
        }

        let movies: Movie[] = Array.isArray(existing?.movies) ? existing.movies : buildSeedMovies();
        const diagnostics: PosterDiagnostic[] = [];

        const isStorageBacked = movies.every((m: any) => typeof m.posterPath === 'string' && m.posterPath.includes('/storage/v1/object/public/'));
        if (existing?.movies && isStorageBacked && !force) {
            return sendJson(res, 200, { ok: true, reused: true, date: todayKey });
        }

        movies = await Promise.all(movies.map((movie) => ensurePosters(supabase, bucket, movie, diagnostics)));
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
