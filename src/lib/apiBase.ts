const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

const normalizeBase = (value: unknown): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return trimTrailingSlashes(text);
};

const normalizePath = (value: string): string => (value.startsWith('/') ? value : `/${value}`);

export const getConfiguredApiBase = (): string =>
    normalizeBase(import.meta.env.VITE_API_BASE_URL);

export const getPublicAppOrigin = (): string => {
    const configured = normalizeBase(import.meta.env.VITE_PUBLIC_APP_URL);
    if (configured) {
        return configured;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        return normalizeBase(window.location.origin);
    }

    return '';
};

export const buildApiUrl = (path: string): string => {
    const normalizedPath = normalizePath(path);
    const apiBase = getConfiguredApiBase();
    if (!apiBase) return normalizedPath;
    return `${apiBase}${normalizedPath}`;
};

export const buildAbsoluteApiUrl = (path: string): string => {
    const normalizedPath = normalizePath(path);
    const apiBase = getConfiguredApiBase();
    if (apiBase) return `${apiBase}${normalizedPath}`;

    const appOrigin = getPublicAppOrigin();
    if (appOrigin) return `${appOrigin}${normalizedPath}`;

    return normalizedPath;
};
