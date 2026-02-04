import React, { useState } from 'react';
import type { Movie } from '../../data/mockMovies';

interface MovieCardProps {
    movie: Movie;
    index: number;
    onClick: () => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, index, onClick }) => {
    const [error, setError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Safe URL Construct
    const getPosterUrl = () => {
        if (!movie.posterPath) return null;
        // Simple, robust construction
        const baseUrl = 'https://image.tmdb.org/t/p/w500';
        const fullUrl = movie.posterPath.startsWith('/') ? `${baseUrl}${movie.posterPath}` : `${baseUrl}/${movie.posterPath}`;

        // Proxy to bypass Vercel/TMDB 403 blocks
        return `https://images.weserv.nl/?url=${encodeURIComponent(fullUrl)}`;
    };

    return (
        <div
            onClick={onClick}
            className="group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/20 bg-[#121212] border border-white/5"
        >
            {/* Background / Poster */}
            <div className={`absolute inset-0 transition-all duration-700 bg-gradient-to-br ${movie.color}`}>
                {!error && movie.posterPath ? (
                    <>
                        {/* Shimmer Loading State */}
                        {!imageLoaded && (
                            <div className="absolute inset-0 bg-white/5 animate-pulse z-10" />
                        )}

                        <img
                            src={getPosterUrl() || ''}
                            alt={movie.title}
                            // Global <meta name="referrer" content="no-referrer" /> handles privacy
                            // Removing individual attributes to avoid conflict
                            onLoad={() => setImageLoaded(true)}
                            onError={(e) => {
                                console.error(`FAILED_URL: ${e.currentTarget.src}`);
                                setError(true);
                            }}
                            className={`w-full h-full object-cover transition-all duration-[1500ms] ease-out
                                ${imageLoaded ? 'opacity-90 group-hover:opacity-100 group-hover:scale-110' : 'opacity-0'}
                            `}
                        />
                    </>
                ) : (
                    /* Fallback / Error State: Sage Minimalist Placeholder */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#8A9A5B]/10">
                        <div className="w-12 h-px bg-[#8A9A5B] mb-4 opacity-50"></div>
                        <h3 className="text-xl font-serif font-bold text-[#8A9A5B] opacity-80 leading-tight mb-2">
                            {movie.title}
                        </h3>
                        <span className="text-[10px] uppercase tracking-widest text-[#8A9A5B]/60 animate-pulse">
                            Loading Film...
                        </span>
                    </div>
                )}

                {/* Gradient Overlays for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
            </div>

            {/* Noise Texture Overlay (Optional, for texture) - DISABLED to prevent 402 error */}
            {/* <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" /> */}

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
                        <span>•</span>
                        <span>{movie.genre}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
