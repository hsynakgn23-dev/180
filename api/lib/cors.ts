type HeaderBag = Record<string, string | undefined> | Headers | undefined;

type ApiRequestLike = {
    headers?: HeaderBag;
};

type CorsOptions = {
    headers: string;
    methods: string;
};

const DEFAULT_ALLOWED_ORIGINS = [
    'https://180absolutecinema.com',
    'https://www.180absolutecinema.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:8090',
    'http://127.0.0.1:8090',
    'http://localhost:19006',
    'http://127.0.0.1:19006',
];

const readHeader = (headers: HeaderBag, key: string): string => {
    if (!headers) return '';
    if (typeof (headers as Headers).get === 'function') {
        return String((headers as Headers).get(key) || '').trim();
    }

    const objectHeaders = headers as Record<string, string | undefined>;
    return String(objectHeaders[key.toLowerCase()] || objectHeaders[key] || '').trim();
};

const normalizeOrigin = (value: string): string => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';

    try {
        return new URL(normalized).origin;
    } catch {
        return '';
    }
};

const resolveConfiguredOrigins = (): string[] =>
    [
        process.env.PUBLIC_APP_URL,
        process.env.VITE_PUBLIC_APP_URL,
        process.env.EXPO_PUBLIC_WEB_APP_URL,
        process.env.EXPO_PUBLIC_WEB_BASE_URL,
    ]
        .map((value) => normalizeOrigin(String(value || '')))
        .filter(Boolean);

const getAllowedOrigins = (): string[] =>
    Array.from(new Set([...resolveConfiguredOrigins(), ...DEFAULT_ALLOWED_ORIGINS]));

export const resolveAllowedOrigin = (req: ApiRequestLike): string => {
    const allowedOrigins = getAllowedOrigins();
    const requestOrigin = normalizeOrigin(readHeader(req.headers, 'origin'));

    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        return requestOrigin;
    }

    return allowedOrigins[0] || 'https://www.180absolutecinema.com';
};

export const createCorsHeaders = (
    req: ApiRequestLike,
    options: CorsOptions
): Record<string, string> => ({
    'access-control-allow-origin': resolveAllowedOrigin(req),
    'access-control-allow-methods': options.methods,
    'access-control-allow-headers': options.headers,
    'access-control-max-age': '86400',
    vary: 'Origin',
});
