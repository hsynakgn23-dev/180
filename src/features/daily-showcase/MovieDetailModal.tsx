import React from 'react';
import type { Movie } from '../../data/mockMovies';
import { useLanguage } from '../../context/LanguageContext';
import { PosterImage } from '../../components/PosterImage';
import { DailyQuizPanel } from './DailyQuizPanel';

interface MovieDetailModalProps {
    movie: Movie;
    onClose: () => void;
    onStartRitual: () => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({ movie, onClose, onStartRitual }) => {
    const { text } = useLanguage();
    const posterFallback = (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#8A9A5B]/10">
            <div className="w-12 h-px bg-[#8A9A5B] mb-4 opacity-50"></div>
            <span className="text-[10px] uppercase tracking-widest text-[#8A9A5B]/60">
                {movie.title}
            </span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-xl transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-[#121212] border border-white/5 shadow-2xl overflow-hidden flex flex-col md:max-w-4xl md:flex-row max-h-[90vh] md:max-h-[760px] animate-slide-up">
                <div className="md:w-2/5 h-64 md:h-auto relative bg-[#1A1A1A] shrink-0">
                    <PosterImage
                        movieId={movie.id}
                        posterPath={movie.posterPath}
                        size="large"
                        alt={movie.title}
                        priority
                        className="absolute inset-0 w-full h-full object-cover"
                        fallback={posterFallback}
                    />

                    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur px-3 py-1 text-xs font-bold text-[#8A9A5B] tracking-widest uppercase border border-white/5">
                        {movie.voteAverage?.toFixed(1) || 'N/A'}
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 md:hidden text-white drop-shadow-md text-xl"
                        aria-label={text.movieDetail.close}
                    >
                        &times;
                    </button>
                </div>

                <div className="flex-1 p-8 md:p-12 xl:p-14 flex flex-col overflow-y-auto bg-[#121212]">
                    <div className="mb-8 md:mb-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-[10px] font-bold tracking-[0.2em] text-[#8A9A5B] uppercase mb-2 opacity-80">
                                    {movie.genre} / {movie.year}
                                </h4>
                                <h2 className="text-3xl md:text-4xl font-serif text-[#E5E4E2] leading-tight mb-2">
                                    {movie.title}
                                </h2>
                                <p className="text-xs font-serif italic text-[#8A9A5B]/60">
                                    {text.movieDetail.directedBy} {movie.director}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="hidden md:block text-white/20 hover:text-white transition-colors"
                                aria-label={text.movieDetail.close}
                            >
                                &times;
                            </button>
                        </div>
                    </div>

                    <div className="mb-8 grow md:mb-10">
                        <p className="max-w-2xl text-sm font-serif leading-relaxed text-[#E5E4E2]/80 md:text-[15px] md:leading-8">
                            {movie.overview || text.movieDetail.noDetails}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-10 text-xs border-t border-white/5 pt-6 md:gap-8 md:mb-12 md:pt-8 md:text-sm">
                        <div>
                            <span className="block text-[9px] font-bold tracking-[0.2em] text-[#8A9A5B]/40 uppercase mb-1">{text.movieDetail.cast}</span>
                            <span className="font-serif leading-6 text-[#E5E4E2] md:leading-7">
                                {movie.cast?.join(', ') || text.movieDetail.unknown}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[9px] font-bold tracking-[0.2em] text-[#8A9A5B]/40 uppercase mb-1">{text.movieDetail.language}</span>
                            <span className="font-serif text-[#E5E4E2] uppercase">
                                {movie.originalLanguage || 'EN'}
                            </span>
                        </div>
                    </div>

                    <DailyQuizPanel movie={movie} onStartComment={onStartRitual} />
                </div>
            </div>
        </div>
    );
};

