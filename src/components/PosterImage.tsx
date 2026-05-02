import React, { useEffect, useMemo, useState } from 'react';
import { resolvePosterCandidates } from '../lib/posterCandidates';

export type PosterImageSize = 'small' | 'large';

export type PosterImageProps = Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    'src' | 'srcSet' | 'sizes' | 'loading'
> & {
    movieId?: number | null;
    posterPath?: string | null;
    size?: PosterImageSize;
    priority?: boolean;
    blurHash?: string | null;
    fallback?: React.ReactNode;
    fallbackClassName?: string;
    onExhausted?: () => void;
    loading?: 'lazy' | 'eager';
};

const POSTER_SIZE_MAP: Record<PosterImageSize, 'w342' | 'w500'> = {
    small: 'w342',
    large: 'w500',
};

const isOriginalCandidate = (value: string): boolean => /\/original(?:\/|[.?#]|$)/i.test(value);

const preferWebp = (candidates: string[]): string[] =>
    [...candidates].sort((left, right) => Number(/\.webp(?:[?#]|$)/i.test(right)) - Number(/\.webp(?:[?#]|$)/i.test(left)));

const resolvePosterImageCandidates = (
    movieId: number | null | undefined,
    posterPath: string | null | undefined,
    size: PosterImageSize,
): string[] =>
    preferWebp(
        resolvePosterCandidates(movieId ?? undefined, posterPath, POSTER_SIZE_MAP[size]).filter(
            (candidate) => !isOriginalCandidate(candidate),
        ),
    );

export const PosterImage: React.FC<PosterImageProps> = ({
    movieId,
    posterPath,
    size = 'small',
    priority = false,
    blurHash,
    fallback,
    fallbackClassName,
    onExhausted,
    onError,
    onLoad,
    alt,
    className,
    decoding = 'async',
    referrerPolicy = 'origin',
    loading,
    ...imgProps
}) => {
    const candidates = useMemo(
        () => resolvePosterImageCandidates(movieId, posterPath, size),
        [movieId, posterPath, size],
    );
    const [candidateIndex, setCandidateIndex] = useState(0);

    useEffect(() => {
        setCandidateIndex(0);
    }, [candidates]);

    const currentSrc = candidates[candidateIndex] ?? null;

    if (!currentSrc) {
        return fallback ? (
            <>{fallback}</>
        ) : (
            <div className={fallbackClassName} aria-label={alt} data-blur-hash={blurHash || undefined} />
        );
    }

    return (
        <img
            {...imgProps}
            src={currentSrc}
            alt={alt}
            className={className}
            loading={loading || (priority ? 'eager' : 'lazy')}
            decoding={decoding}
            referrerPolicy={referrerPolicy}
            data-blur-hash={blurHash || undefined}
            onLoad={onLoad}
            onError={(event) => {
                const nextIndex = candidateIndex + 1;
                if (nextIndex < candidates.length) {
                    setCandidateIndex(nextIndex);
                    return;
                }
                onExhausted?.();
                onError?.(event);
            }}
        />
    );
};

export default PosterImage;
