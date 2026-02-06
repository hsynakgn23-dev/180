import { resolveImageCandidates } from './tmdbImage';

type PosterSize = 'w200' | 'w342' | 'w500' | 'w780' | 'original';

const STORAGE_EXTENSIONS = ['jpg', 'webp', 'png'] as const;

const dedupe = (values: string[]): string[] => {
    return Array.from(new Set(values.filter(Boolean)));
};

const getStorageBaseUrl = (): string | null => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url) return null;
    return url.endsWith('/') ? url.slice(0, -1) : url;
};

const getStorageBucket = (): string => {
    return import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'posters';
};

const buildStorageCandidates = (movieId: number | undefined, size: PosterSize): string[] => {
    if (!movieId) return [];
    const baseUrl = getStorageBaseUrl();
    if (!baseUrl) return [];

    const bucket = getStorageBucket();
    return STORAGE_EXTENSIONS.map(
        (ext) => `${baseUrl}/storage/v1/object/public/${bucket}/${movieId}/${size}.${ext}`
    );
};

export const resolvePosterCandidates = (
    movieId: number | undefined,
    posterPath: string | null | undefined,
    size: PosterSize
): string[] => {
    const storage = buildStorageCandidates(movieId, size);
    const external = resolveImageCandidates(posterPath, size);
    return dedupe([...storage, ...external]);
};

