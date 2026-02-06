import React, { useRef } from 'react';
import { useDailyMovies } from '../../hooks/useDailyMovies';
import { useXP } from '../../context/XPContext';
import { MovieCard } from './MovieCard';
import { CycleTime } from './CycleTime';

interface DailyShowcaseProps {
    onMovieSelect: (movie: any) => void;
}

export const DailyShowcase: React.FC<DailyShowcaseProps> = ({ onMovieSelect }) => {
    const { movies, loading } = useDailyMovies();
    const { dailyRitualsCount } = useXP();
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const scrollMovies = (direction: 'left' | 'right') => {
        const container = scrollerRef.current;
        if (!container) return;
        const amount = Math.round(container.clientWidth * 0.82);
        container.scrollBy({
            left: direction === 'right' ? amount : -amount,
            behavior: 'smooth'
        });
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto mb-24 h-96 flex items-center justify-center">
                <span className="text-sage/50 text-xs tracking-widest animate-pulse">GÜNLÜK 5'Lİ YÜKLENİYOR...</span>
            </div>
        );
    }

    return (
        <section className="max-w-6xl mx-auto mb-24">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end items-start gap-4 px-4 sm:px-6 mb-8 border-b border-gray-200/50 pb-4">
                <div>
                    <h3 className="text-sm font-bold tracking-widest text-sage uppercase">GÜNÜN FİLMLERİ</h3>
                    <span className="text-[10px] italic text-gray-400">Her gün özenle seçilen 5 film</span>
                </div>
                <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-2">
                    <CycleTime />
                    <div className="sm:hidden flex items-center gap-2 text-[9px] tracking-[0.16em] uppercase text-clay/80">
                        <span>Kartlari kaydir</span>
                        <button
                            type="button"
                            onClick={() => scrollMovies('left')}
                            className="h-6 w-6 rounded-full border border-clay/30 bg-[#171717] text-clay/80 hover:text-clay hover:border-clay/60 transition-colors"
                            aria-label="Scroll movies left"
                        >
                            &lt;
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollMovies('right')}
                            className="h-6 w-6 rounded-full border border-clay/30 bg-[#171717] text-clay/80 hover:text-clay hover:border-clay/60 transition-colors"
                            aria-label="Scroll movies right"
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>

            {/* Movies */}
            <div
                ref={scrollerRef}
                className="flex md:grid md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 px-4 sm:px-6 overflow-x-auto md:overflow-visible pb-2 md:pb-0 snap-x snap-mandatory md:snap-none scroll-pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {movies.map((movie, index) => {
                    // Mystery Slot Logic for 5th Movie (index 4)
                    const isMysterySlot = index === 4;
                    const isLocked = isMysterySlot && dailyRitualsCount === 0;

                    return (
                        <div key={movie.id} className="relative h-full min-w-[74vw] sm:min-w-[46vw] md:min-w-0 snap-start">
                            {/* Wrapper for Blur Transition */}
                            <div className={`h-full transition-all duration-1000 ease-in-out ${isLocked ? 'blur-sm grayscale opacity-50' : 'blur-0 grayscale-0 opacity-100'}`}>
                                <MovieCard
                                    movie={movie}
                                    index={index}
                                    onClick={() => {
                                        if (isLocked) return;
                                        onMovieSelect(movie);
                                    }}
                                />
                            </div>

                            {/* Lock Overlay with Smooth Fade Out */}
                            <div
                                className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center transition-all duration-1000 ease-in-out
                                    ${isLocked ? 'opacity-100 bg-[#FDFCF8]/10' : 'opacity-0 pointer-events-none'}
                                `}
                            >
                                <div className="w-10 h-10 text-[#2C2C2C] mb-3 opacity-80">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 17C13.1046 17 14 16.1046 14 15C14 13.8954 13.1046 13 12 13C10.8954 13 10 13.8954 10 15C10 16.1046 10.8954 17 12 17Z" />
                                        <path d="M18 10V8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8V10H4V22H20V10H18ZM12 4C14.2091 4 16 5.79086 16 8V10H8V8C8 5.79086 9.79086 4 12 4Z" />
                                    </svg>
                                </div>
                                <span className="text-[10px] md:text-xs font-bold tracking-[0.2em] text-[#2C2C2C] uppercase drop-shadow-sm">
                                    Kilidi Açmak İçin<br />1 Yorum Yap
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};


