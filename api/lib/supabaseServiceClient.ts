import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const isSupabaseSecretApiKey = (value: string): boolean => {
    const normalized = String(value || '').trim();
    return normalized.startsWith('sb_secret_');
};

const createSupabaseSecretFetch = (serviceRoleKey: string): typeof fetch => {
    const normalizedKey = String(serviceRoleKey || '').trim();

    return async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!isSupabaseSecretApiKey(normalizedKey)) {
            return fetch(input, init);
        }

        const nextHeaders = new Headers();
        const requestInput = input instanceof Request ? input : null;

        if (requestInput) {
            requestInput.headers.forEach((value, key) => {
                nextHeaders.set(key, value);
            });
        }

        const initHeaders = new Headers(init?.headers);
        initHeaders.forEach((value, key) => {
            nextHeaders.set(key, value);
        });

        const apikey = nextHeaders.get('apikey') || normalizedKey;
        const authorization = nextHeaders.get('authorization');
        if (authorization && authorization === `Bearer ${apikey}`) {
            nextHeaders.delete('authorization');
        }
        if (!nextHeaders.has('apikey')) {
            nextHeaders.set('apikey', normalizedKey);
        }

        if (requestInput) {
            return fetch(
                new Request(requestInput, {
                    ...init,
                    headers: nextHeaders
                })
            );
        }

        return fetch(input, {
            ...init,
            headers: nextHeaders
        });
    };
};

export const createSupabaseServiceClient = (
    url: string,
    serviceRoleKey: string
): SupabaseClient => {
    return createClient(url, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        },
        global: {
            fetch: createSupabaseSecretFetch(serviceRoleKey)
        }
    });
};
