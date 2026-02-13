type ProfileOgCardInput = {
    handle?: string;
    name?: string;
    league?: string;
    xp?: number;
    streak?: number;
};

type FilmOgCardInput = {
    title?: string;
    year?: number | string;
    genre?: string;
    author?: string;
    slot?: string;
    quote?: string;
};

const normalizeText = (value: string | null | undefined, max = 80): string => {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const normalizeInt = (value: number | string | null | undefined): string => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.max(0, Math.floor(value)));
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) return String(Math.max(0, parsed));
    }
    return '0';
};

const getAppOrigin = (): string => {
    const envOrigin = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim();
    if (envOrigin) {
        return envOrigin.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }
    return '';
};

const buildApiUrl = (path: string, params: Record<string, string>): string => {
    const query = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(params)) {
        const value = rawValue.trim();
        if (value) {
            query.set(key, value);
        }
    }
    const suffix = query.toString();
    const relativePath = `${path}${suffix ? `?${suffix}` : ''}`;
    const origin = getAppOrigin();
    if (!origin) return relativePath;
    return `${origin}${relativePath}`;
};

export const buildProfileOgImageUrl = (input: ProfileOgCardInput): string => {
    return buildApiUrl('/api/og/profile', {
        handle: normalizeText(input.handle || 'observer', 24) || 'observer',
        name: normalizeText(input.name || '', 34),
        league: normalizeText(input.league || '', 24),
        xp: normalizeInt(input.xp),
        streak: normalizeInt(input.streak)
    });
};

export const buildFilmOgImageUrl = (input: FilmOgCardInput): string => {
    const year = normalizeInt(input.year);
    return buildApiUrl('/api/og/film', {
        title: normalizeText(input.title || 'Untitled Film', 64) || 'Untitled Film',
        year: year === '0' ? '' : year,
        genre: normalizeText(input.genre || '', 26),
        author: normalizeText(input.author || 'observer', 26),
        slot: normalizeText(input.slot || '', 24),
        quote: normalizeText(input.quote || '', 180)
    });
};
