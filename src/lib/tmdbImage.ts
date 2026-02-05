const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const WESERV_BASE = 'https://images.weserv.nl/?url=';
const DEFAULT_PROXIES = ['https://images.weserv.nl/?url=', 'https://wsrv.nl/?url='];

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const getImageMode = (): 'direct-first' | 'proxy-first' | 'proxy-only' => {
    const raw = (import.meta.env.VITE_IMAGE_MODE || 'proxy-first').toLowerCase();
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

    if (isAbsoluteUrl(value)) {
        const tmdbMatch = value.match(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\/(.+)$/i);
        if (tmdbMatch) {
            return `${TMDB_IMAGE_BASE}/${size}/${tmdbMatch[1]}`;
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
