import { isSupabaseLive, supabase } from './supabase';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;

export type FetchWithAuthOptions = RequestInit & { isWrite?: boolean };

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const getAccessToken = async (): Promise<string | null> => {
    if (!isSupabaseLive() || !supabase) return null;
    try {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
    } catch {
        return null;
    }
};

const refreshAccessToken = async (): Promise<string | null> => {
    if (!isSupabaseLive() || !supabase) return null;
    try {
        await supabase.auth.refreshSession();
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
    } catch {
        return null;
    }
};

const buildIdempotencyKey = (): string => {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
        return cryptoApi.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const mergeHeaders = (
    base: HeadersInit | undefined,
    extras: Record<string, string>
): Record<string, string> => {
    const merged: Record<string, string> = {};
    if (base) {
        if (base instanceof Headers) {
            base.forEach((value, key) => {
                merged[key] = value;
            });
        } else if (Array.isArray(base)) {
            for (const [key, value] of base) merged[key] = value;
        } else {
            Object.assign(merged, base as Record<string, string>);
        }
    }
    Object.assign(merged, extras);
    return merged;
};

export const fetchWithAuth = async (
    url: string,
    options: FetchWithAuthOptions = {}
): Promise<Response> => {
    const { isWrite = false, ...init } = options;
    const idempotencyKey = isWrite ? buildIdempotencyKey() : null;

    let token = await getAccessToken();
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const extras: Record<string, string> = {};
        if (token) extras['Authorization'] = `Bearer ${token}`;
        if (idempotencyKey) extras['Idempotency-Key'] = idempotencyKey;

        const headers = mergeHeaders(init.headers, extras);

        try {
            const response = await fetch(url, { ...init, headers });

            if (response.status === 401 && attempt < MAX_ATTEMPTS) {
                const refreshed = await refreshAccessToken();
                if (refreshed && refreshed !== token) {
                    token = refreshed;
                    continue;
                }
                return response;
            }

            if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
                await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
                continue;
            }

            return response;
        } catch (error) {
            lastError = error;
            if (attempt < MAX_ATTEMPTS) {
                await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
                continue;
            }
        }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error('Request failed after max attempts.');
};
