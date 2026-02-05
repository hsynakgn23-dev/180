const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const WESERV_BASE = 'https://images.weserv.nl/?url=';

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

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

export const toWeservUrl = (absoluteUrl: string | null | undefined): string | null => {
    if (!absoluteUrl) return null;
    if (absoluteUrl.startsWith(WESERV_BASE)) return absoluteUrl;
    return `${WESERV_BASE}${encodeURIComponent(absoluteUrl)}`;
};

export const isWeservUrl = (url: string | null | undefined): boolean => {
    return !!url && url.startsWith(WESERV_BASE);
};
