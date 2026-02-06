import { createClient } from '@supabase/supabase-js';
import { TMDB_SEEDS } from '../../src/data/tmdbSeeds';
import { DAILY_SLOTS, FALLBACK_GRADIENTS } from '../../src/data/dailyConfig';

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

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

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

const ensureBucket = async (supabase: ReturnType<typeof createClient>, bucket: string) => {
    const { data, error } = await supabase.storage.getBucket(bucket);
    if (data && !error) return;

    const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: true
    });
    if (createError) {
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

const extFromContentType = (contentType: string | null): string => {
    if (!contentType) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    return 'jpg';
};

const uploadPoster = async (
    supabase: ReturnType<typeof createClient>,
    bucket: string,
    movieId: number,
    posterPath: string,
    size: 'w200' | 'w500'
): Promise<string | null> => {
    const sourceUrl = toImageUrl(posterPath, size);
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type');
    const ext = extFromContentType(contentType);
    const arrayBuffer = await res.arrayBuffer();
    const filePath = `${movieId}/${size}.${ext}`;

    const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, new Uint8Array(arrayBuffer), {
            contentType: contentType || 'image/jpeg',
            cacheControl: '31536000',
            upsert: true
        });

    if (error) return null;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
};

const ensurePosters = async (
    supabase: ReturnType<typeof createClient>,
    bucket: string,
    movie: Movie
): Promise<Movie> => {
    if (!movie.posterPath) return movie;

    const [w500Url, w200Url] = await Promise.all([
        uploadPoster(supabase, bucket, movie.id, movie.posterPath, 'w500'),
        uploadPoster(supabase, bucket, movie.id, movie.posterPath, 'w200')
    ]);

    return {
        ...movie,
        posterPath: w500Url || movie.posterPath,
        posterStoragePath: w500Url || null,
        posterThumbPath: w200Url || null,
        posterSource: w500Url ? 'storage' : 'tmdb'
    } as Movie & {
        posterStoragePath?: string | null;
        posterThumbPath?: string | null;
        posterSource?: string;
    };
};

const buildSeedMovies = (): Movie[] => {
    return TMDB_SEEDS.slice(0, 5).map((movie, index) => ({
        ...movie,
        slotLabel: DAILY_SLOTS[index].label,
        color: FALLBACK_GRADIENTS[index]
    }));
};

export default async function handler(req: any, res: any) {
    try {
        console.log('[daily-cron] start');
        if (req.query?.ping === '1') {
            return res.status(200).json({ ok: true, runtime: 'node', time: new Date().toISOString() });
        }
        if (req.query?.env === '1') {
            return res.status(200).json({
                ok: true,
                hasSupabaseUrl: !!process.env.SUPABASE_URL,
                hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                hasBucket: !!process.env.SUPABASE_STORAGE_BUCKET,
                hasCronSecret: !!process.env.CRON_SECRET || !!process.env.VERCEL_CRON_SECRET
            });
        }
        const secret = getCronSecret();
        const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : null;
        if (secret) {
            const auth = req.headers.authorization || '';
            if (auth !== `Bearer ${secret}` && querySecret !== secret) {
                console.warn('[daily-cron] unauthorized');
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }

        const supabaseUrl = getEnv('SUPABASE_URL');
        const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
        console.log('[daily-cron] env ok');
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        });

        const bucket = getBucketName();
        console.log('[daily-cron] bucket', bucket);
        await ensureBucket(supabase, bucket);
        const todayKey = new Date().toISOString().split('T')[0];
        const force = req.query.force === '1' || req.query.force === 'true';

        const { data: existing, error: readError } = await supabase
            .from('daily_showcase')
            .select('*')
            .eq('date', todayKey)
            .single();

        if (readError && readError.code !== 'PGRST116') {
            return res.status(500).json({ error: readError.message });
        }

        let movies: Movie[] = Array.isArray(existing?.movies) ? existing.movies : buildSeedMovies();

        const isStorageBacked = movies.every((m: any) => typeof m.posterPath === 'string' && m.posterPath.includes('/storage/v1/object/public/'));
        if (existing?.movies && isStorageBacked && !force) {
            return res.status(200).json({ ok: true, reused: true, date: todayKey });
        }

        movies = await Promise.all(movies.map((movie) => ensurePosters(supabase, bucket, movie)));

        const { error: upsertError } = await supabase
            .from('daily_showcase')
            .upsert({ date: todayKey, movies }, { onConflict: 'date' });

        if (upsertError) {
            return res.status(500).json({ error: upsertError.message });
        }

        return res.status(200).json({ ok: true, updated: true, date: todayKey, count: movies.length });
    } catch (error: any) {
        console.error('[daily-cron] error', error);
        return res.status(500).json({ error: error.message || 'Unexpected error' });
    }
}
