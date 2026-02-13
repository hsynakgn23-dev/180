type DailyCacheRecord = {
    date: string;
    movies: unknown[];
    cachedAt: string;
};

type MemoryCacheEntry = {
    expiresAt: number;
    record: DailyCacheRecord;
};

type DailyCacheHit = {
    movies: unknown[];
    source: 'memory' | 'redis';
};

const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000;
const DAILY_CACHE_KEY_PREFIX = 'daily_showcase_v1:';

const getMemoryStore = (): Map<string, MemoryCacheEntry> => {
    const globalScope = globalThis as typeof globalThis & {
        __absoluteCinemaDailyCache?: Map<string, MemoryCacheEntry>;
    };
    if (!globalScope.__absoluteCinemaDailyCache) {
        globalScope.__absoluteCinemaDailyCache = new Map<string, MemoryCacheEntry>();
    }
    return globalScope.__absoluteCinemaDailyCache;
};

const getRedisConfig = (): { baseUrl: string; token: string } | null => {
    const baseUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
    const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
    if (!baseUrl || !token) return null;
    return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        token
    };
};

const isValidDateKey = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildCacheKey = (dateKey: string): string => `${DAILY_CACHE_KEY_PREFIX}${dateKey}`;

const normalizeRecord = (input: unknown): DailyCacheRecord | null => {
    const record = input as Partial<DailyCacheRecord> | null | undefined;
    if (!record || typeof record !== 'object') return null;
    if (typeof record.date !== 'string' || !isValidDateKey(record.date)) return null;
    if (!Array.isArray(record.movies)) return null;
    return {
        date: record.date,
        movies: record.movies,
        cachedAt: typeof record.cachedAt === 'string' ? record.cachedAt : new Date().toISOString()
    };
};

const getFromMemory = (dateKey: string): DailyCacheRecord | null => {
    const store = getMemoryStore();
    const key = buildCacheKey(dateKey);
    const hit = store.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
    }
    return hit.record;
};

const setToMemory = (dateKey: string, record: DailyCacheRecord, ttlMs = MEMORY_CACHE_TTL_MS) => {
    const store = getMemoryStore();
    store.set(buildCacheKey(dateKey), {
        expiresAt: Date.now() + ttlMs,
        record
    });
};

const getFromRedis = async (dateKey: string): Promise<DailyCacheRecord | null> => {
    const config = getRedisConfig();
    if (!config) return null;

    try {
        const response = await fetch(`${config.baseUrl}/get/${encodeURIComponent(buildCacheKey(dateKey))}`, {
            headers: {
                Authorization: `Bearer ${config.token}`
            }
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { result?: unknown };
        if (typeof payload.result !== 'string' || !payload.result) return null;
        const parsed = JSON.parse(payload.result) as unknown;
        return normalizeRecord(parsed);
    } catch {
        return null;
    }
};

const setToRedis = async (dateKey: string, record: DailyCacheRecord, ttlSeconds: number): Promise<boolean> => {
    const config = getRedisConfig();
    if (!config) return false;

    try {
        const serialized = JSON.stringify(record);
        const endpoint = `${config.baseUrl}/set/${encodeURIComponent(buildCacheKey(dateKey))}/${encodeURIComponent(serialized)}?EX=${Math.max(60, Math.floor(ttlSeconds))}`;
        const response = await fetch(endpoint, {
            headers: {
                Authorization: `Bearer ${config.token}`
            }
        });
        return response.ok;
    } catch {
        return false;
    }
};

export const getCachedDailyMovies = async (dateKey: string): Promise<DailyCacheHit | null> => {
    if (!isValidDateKey(dateKey)) return null;

    const memoryRecord = getFromMemory(dateKey);
    if (memoryRecord) {
        return { movies: memoryRecord.movies, source: 'memory' };
    }

    const redisRecord = await getFromRedis(dateKey);
    if (!redisRecord) return null;

    setToMemory(dateKey, redisRecord);
    return { movies: redisRecord.movies, source: 'redis' };
};

export const setCachedDailyMovies = async (dateKey: string, movies: unknown[], ttlSeconds = 26 * 60 * 60): Promise<boolean> => {
    if (!isValidDateKey(dateKey) || !Array.isArray(movies) || movies.length === 0) return false;

    const record: DailyCacheRecord = {
        date: dateKey,
        movies,
        cachedAt: new Date().toISOString()
    };

    setToMemory(dateKey, record, Math.min(MEMORY_CACHE_TTL_MS, ttlSeconds * 1000));
    await setToRedis(dateKey, record, ttlSeconds);
    return true;
};
