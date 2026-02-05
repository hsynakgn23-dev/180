import React from 'react';
import type { Movie } from '../../data/mockMovies';
import { isWeservUrl, resolveImageUrl, toWeservUrl } from '../../lib/tmdbImage';

interface MovieDetailModalProps {
    movie: Movie;
    onClose: () => void;
    onStartRitual: () => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({ movie, onClose, onStartRitual }) => {

    const [imgSrc, setImgSrc] = React.useState<string | null>(() => resolveImageUrl(movie.posterPath, 'w500'));

    React.useEffect(() => {
        setImgSrc(resolveImageUrl(movie.posterPath, 'w500'));
    }, [movie.id, movie.posterPath]);

    const handleImageError = () => {
        if (imgSrc && !isWeservUrl(imgSrc)) {
            const fallback = toWeservUrl(imgSrc);
            if (fallback) {
                setImgSrc(fallback);
                return;
            }
        }
        setImgSrc(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop Blur */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-xl transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-[#121212] border border-white/5 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[600px] animate-slide-up">

                {/* Visual Side (Poster) - Hidden on very small screens or top on mobile */}
                <div className="md:w-2/5 h-64 md:h-auto relative bg-[#1A1A1A] shrink-0">
                    {imgSrc ? (
                        <img
                            src={imgSrc}
                            alt={movie.title}
                            referrerPolicy="origin"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={handleImageError}
                        />
                    ) : null}

                    {/* Fallback UI (Hidden by default unless error/no poster) */}
                    <div className={`${imgSrc ? 'hidden' : ''} absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#8A9A5B]/10`}>
                        <div className="w-12 h-px bg-[#8A9A5B] mb-4 opacity-50"></div>
                        <span className="text-[10px] uppercase tracking-widest text-[#8A9A5B]/60">
                            {movie.title}
                        </span>
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur px-3 py-1 text-xs font-bold text-[#8A9A5B] tracking-widest uppercase border border-white/5">
                        {movie.voteAverage?.toFixed(1) || 'N/A'}
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 md:hidden text-white drop-shadow-md text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Info Side */}
                <div className="flex-1 p-8 md:p-10 flex flex-col overflow-y-auto bg-[#121212]">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-[10px] font-bold tracking-[0.2em] text-[#8A9A5B] uppercase mb-2 opacity-80">
                                    {movie.genre} · {movie.year}
                                </h4>
                                <h2 className="text-3xl md:text-4xl font-serif text-[#E5E4E2] leading-tight mb-2">
                                    {movie.title}
                                </h2>
                                <p className="text-xs font-serif italic text-[#8A9A5B]/60">
                                    Directed by {movie.director}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="hidden md:block text-white/20 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Overview */}
                    <div className="mb-8 grow">
                        <p className="text-sm font-serif leading-relaxed text-[#E5E4E2]/80">
                            {movie.overview || "No details available."}
                        </p>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 gap-6 mb-10 text-xs border-t border-white/5 pt-6">
                        <div>
                            <span className="block text-[9px] font-bold tracking-[0.2em] text-[#8A9A5B]/40 uppercase mb-1">Cast</span>
                            <span className="font-serif text-[#E5E4E2]">
                                {movie.cast?.join(', ') || 'Unknown'}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[9px] font-bold tracking-[0.2em] text-[#8A9A5B]/40 uppercase mb-1">Language</span>
                            <span className="font-serif text-[#E5E4E2] uppercase">
                                {movie.originalLanguage || 'EN'}
                            </span>
                        </div>
                    </div>

                    {/* Action */}
                    <div className="mt-auto">
                        <button
                            onClick={onStartRitual}
                            className="w-full py-4 bg-[#8A9A5B] text-[#121212] text-xs font-bold tracking-[0.2em] uppercase hover:bg-[#9AB06B] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            Start Ritual
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
