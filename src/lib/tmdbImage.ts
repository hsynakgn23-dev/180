const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const WESERV_BASE = 'https://images.weserv.nl/?url=';
const DEFAULT_PROXIES = ['https://images.weserv.nl/?url=', 'https://wsrv.nl/?url='];
const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);
const isProtocolRelativeUrl = (value: string) => value.startsWith('//');

const getSupabaseBaseUrl = (): string => {
    const raw = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

const getWindowOrigin = (): string => {
    if (typeof window === 'undefined' || !window.location?.origin) return '';
    return String(window.location.origin || '').trim().replace(/\/+$/, '');
};

const resolveStorageRelativeUrl = (value: string): string | null => {
    const normalized = value.trim();
    if (!normalized) return null;

    let storagePath = '';
    if (normalized.startsWith(STORAGE_PUBLIC_PATH)) {
        storagePath = normalized;
    } else if (normalized.startsWith(STORAGE_PUBLIC_PATH.slice(1))) {
        storagePath = `/${normalized}`;
    } else {
        return null;
    }

    const baseUrl = getSupabaseBaseUrl() || getWindowOrigin();
    if (!baseUrl) return null;
    return `${baseUrl}${storagePath}`;
};

const getImageMode = (): 'direct-first' | 'proxy-first' | 'proxy-only' => {
    const raw = (import.meta.env.VITE_IMAGE_MODE || 'direct-first').toLowerCase();
    if (raw === 'direct-first' || raw === 'proxy-first' || raw === 'proxy-only') return raw;
    return 'proxy-first';
};

const getProxyList = (): string[] => {
    const raw = import.meta.env.VITE_IMAGE_PROXIES;
    const list: string[] = raw ? raw.split(',') : DEFAULT_PROXIES;
    return list.map((item: string) => item.trim()).filter(Boolean);
};

const buildProxyUrl = (proxyBase: string, targetUrl: string): string => {
    if (proxyBase.includes('{url}')) {
        return proxyBase.replace('{url}', encodeURIComponent(targetUrl));
    }
    return `${proxyBase}${encodeURIComponent(targetUrl)}`;
};

export const resolveImageUrl = (
    pathOrUrl: string | null | undefined,
    size: 'w200' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string | null => {
    if (!pathOrUrl) return null;
    let value = pathOrUrl.trim();
    if (!value) return null;

    if (value.startsWith(WESERV_BASE)) {
        value = decodeURIComponent(value.slice(WESERV_BASE.length));
    }

    if (isProtocolRelativeUrl(value)) {
        return `https:${value}`;
    }

    const storageAbsolute = resolveStorageRelativeUrl(value);
    if (storageAbsolute) {
        return storageAbsolute;
    }

    if (isAbsoluteUrl(value)) {
        const tmdbMatch = value.match(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\/(.+)$/i);
        if (tmdbMatch) {
            return `${TMDB_IMAGE_BASE}/${size}/${tmdbMatch[1]}`;
        }
        const sizeMatch = value.match(/\/(w200|w342|w500|w780|original)(\.[a-zA-Z0-9]+)(\?.*)?$/);
        if (sizeMatch) {
            const currentSize = sizeMatch[1];
            if (currentSize !== size) {
                return value.replace(`/${currentSize}${sizeMatch[2]}`, `/${size}${sizeMatch[2]}`);
            }
        }
        return value;
    }

    const clean = value.startsWith('/') ? value : `/${value}`;
    return `${TMDB_IMAGE_BASE}/${size}${clean}`;
};

export const resolveImageCandidates = (
    pathOrUrl: string | null | undefined,
    size: 'w200' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string[] => {
    const direct = resolveImageUrl(pathOrUrl, size);
    if (!direct) return [];

    const proxies = getProxyList();
    const proxyUrls = proxies.map((proxy) => buildProxyUrl(proxy, direct));
    const mode = getImageMode();

    let candidates: string[];
    if (mode === 'proxy-only') {
        candidates = proxyUrls;
    } else if (mode === 'direct-first') {
        candidates = [direct, ...proxyUrls];
    } else {
        candidates = [...proxyUrls, direct];
    }

    return Array.from(new Set(candidates));
};

export const toWeservUrl = (absoluteUrl: string | null | undefined): string | null => {
    if (!absoluteUrl) return null;
    if (absoluteUrl.startsWith(WESERV_BASE)) return absoluteUrl;
    return `${WESERV_BASE}${encodeURIComponent(absoluteUrl)}`;
};

export const isWeservUrl = (url: string | null | undefined): boolean => {
    return !!url && url.startsWith(WESERV_BASE);
};
