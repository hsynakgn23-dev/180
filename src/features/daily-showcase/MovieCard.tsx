import React, { useState } from 'react';
import type { Movie } from '../../data/mockMovies';
import { resolvePosterCandidates } from '../../lib/posterCandidates';
import { searchPosterPath } from '../../lib/tmdbApi';

interface MovieCardProps {
    movie: Movie;
    index: number;
    isWatchedToday?: boolean;
    onClick: () => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, index, isWatchedToday = false, onClick }) => {
    const isDev = import.meta.env.DEV;
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [candidates, setCandidates] = useState<string[]>([]);
    const [candidateIndex, setCandidateIndex] = useState(0);

    const applyCandidates = (nextCandidates: string[]) => {
        setCandidates(nextCandidates);
        setCandidateIndex(0);
        setImageLoaded(false);
        setImgSrc(nextCandidates[0] ?? null);
        setHasError(nextCandidates.length === 0);
    };

    React.useEffect(() => {
        setIsRetrying(false);
        setHasError(false);
        setImageLoaded(false);

        const nextCandidates = resolvePosterCandidates(movie.id, movie.posterPath, 'w500');
        applyCandidates(nextCandidates);
        if (!nextCandidates.length) {
            handleRetry();
        }
    }, [movie.id, movie.posterPath, movie.title]);

    const handleRetry = async () => {
        if (isRetrying) {
            setHasError(true);
            return;
        }

        setIsRetrying(true);
        setHasError(false);
        if (isDev) {
            console.log(`[Image Recovery] Attempting to fetch fresh poster for: ${movie.title}`);
        }

        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        if (!apiKey || apiKey === 'YOUR_TMDB_API_KEY') {
            setIsRetrying(false);
            setHasError(true);
            return;
        }

        try {
            const posterPath = await searchPosterPath(movie.title, apiKey);
            if (posterPath) {
                if (isDev) {
                    console.log(`[Image Recovery] Found new poster: ${posterPath}`);
                }
                const nextCandidates = resolvePosterCandidates(movie.id, posterPath, 'w500');
                if (nextCandidates.length) {
                    applyCandidates(nextCandidates);
                    setIsRetrying(false);
                    return;
                }
            }
            setHasError(true);
        } catch (e) {
            console.error("Recovery failed", e);
            setHasError(true);
        } finally {
            setIsRetrying(false);
        }
    };

    const handleImageError = () => {
        const nextIndex = candidateIndex + 1;
        if (nextIndex < candidates.length) {
            setCandidateIndex(nextIndex);
            setImageLoaded(false);
            setHasError(false);
            setImgSrc(candidates[nextIndex]);
            return;
        }
        handleRetry();
    };

    return (
        <div
            onClick={onClick}
            className="group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/20 bg-[#121212] border border-white/5"
        >
            {/* Background / Poster */}
            <div className={`absolute inset-0 transition-all duration-700 bg-gradient-to-br ${movie.color}`}>
                {!hasError && imgSrc ? (
                    <>
                        {/* Shimmer Loading State */}
                        {!imageLoaded && (
                            <div className="absolute inset-0 bg-white/5 animate-pulse z-10" />
                        )}

                        <img
                            src={imgSrc}
                            alt={movie.title}
                            referrerPolicy="origin"
                            onLoad={() => setImageLoaded(true)}
                            onError={handleImageError}
                            className={`w-full h-full object-cover transition-all duration-[1500ms] ease-out
                                ${imageLoaded ? 'opacity-90 group-hover:opacity-100 group-hover:scale-110' : 'opacity-0'}
                            `}
                        />
                    </>
                ) : (
                    /* Premium Fallback State: "Absolute Cinema" Style */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#151515] border border-[#8A9A5B]/20">
                        {/* Camera Icon */}
                        <div className="mb-4 text-[#8A9A5B]/80 opacity-80">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21 7L13 7L13 17L21 17L21 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M18 7V5H6V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M18 17V19H6V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M3 7L11 7L11 17L3 17L3 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M11 12H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>

                        <div className="w-8 h-px bg-[#8A9A5B] mb-3 opacity-40"></div>

                        <h3 className="text-lg font-serif font-bold text-[#E5E4E2] leading-tight mb-1">
                            {movie.title}
                        </h3>

                        <span className="text-[9px] uppercase tracking-[0.25em] text-[#8A9A5B]/60 font-medium animate-pulse">
                            {isRetrying ? 'Searching Archive...' : 'Image Unavailable'}
                        </span>
                    </div>
                )}

                {/* Gradient Overlays for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
            </div>

            {/* Content Container */}
            <div className="absolute inset-0 p-6 flex flex-col justify-between text-white">

                {/* Top: Index & Slot Label */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono tracking-widest border border-white/30 px-2 py-1 rounded-full w-fit opacity-60 group-hover:opacity-100 transition-opacity">
                            0{index + 1}
                        </span>
                        {movie.slotLabel && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8A9A5B] opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-75">
                                {movie.slotLabel}
                            </span>
                        )}
                    </div>
                    {isWatchedToday && (
                        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                            <span>✓</span>
                            <span>Izlendi</span>
                        </div>
                    )}
                </div>

                {/* Bottom: Info */}
                <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                    {/* Tagline - Hidden by default, slides in */}
                    <p className="text-[10px] uppercase tracking-widest mb-2 opacity-0 -translate-y-2 group-hover:opacity-80 group-hover:translate-y-0 transition-all duration-500 delay-100 font-medium text-white/90">
                        {movie.director}
                    </p>

                    <h3 className="text-2xl md:text-3xl font-serif leading-tight mb-1 font-medium drop-shadow-md">
                        {movie.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs font-light text-white/70 overflow-hidden h-0 group-hover:h-auto group-hover:mt-2 transition-all duration-500 opacity-0 group-hover:opacity-100 delay-200">
                        <span>{movie.year}</span>
                        <span>|</span>
                        <span>{movie.genre}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
