import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDailyMovies } from '../../hooks/useDailyMovies';
import { useXP } from '../../context/XPContext';
import { MovieCard } from './MovieCard';
import { CycleTime } from './CycleTime';
import type { Movie } from '../../data/mockMovies';
import { useLanguage } from '../../context/LanguageContext';
import {
    LETTERBOXD_IMPORT_UPDATED_EVENT,
    readStoredLetterboxdImport
} from '../../lib/letterboxdImport';

interface DailyShowcaseProps {
    onMovieSelect: (movie: Movie) => void;
}

export const DailyShowcase: React.FC<DailyShowcaseProps> = ({ onMovieSelect }) => {
    const { text } = useLanguage();
    const { dailyRituals, dailyRitualsCount, user } = useXP();
    const [importRevision, setImportRevision] = useState(0);

    useEffect(() => {
        const handleImportUpdate = () => {
            setImportRevision((prev) => prev + 1);
        };
        window.addEventListener(LETTERBOXD_IMPORT_UPDATED_EVENT, handleImportUpdate);
        return () => window.removeEventListener(LETTERBOXD_IMPORT_UPDATED_EVENT, handleImportUpdate);
    }, []);

    const importedHistory = useMemo(
        () => readStoredLetterboxdImport(user?.id || user?.email || ''),
        [user?.id, user?.email, importRevision]
    );

    const [todaysCommentedMovieIds, setTodaysCommentedMovieIds] = useState<number[]>([]);
    const [previouslyCommentedMovieIds, setPreviouslyCommentedMovieIds] = useState<number[]>([]);
    const [previouslyCommentedMovieTitles, setPreviouslyCommentedMovieTitles] = useState<string[]>([]);

    const { movies, loading, dateKey } = useDailyMovies({
        excludedMovieIds: previouslyCommentedMovieIds,
        excludedMovieTitles: previouslyCommentedMovieTitles,
        personalizationSeed: user?.id || user?.email || 'guest'
    });

    useEffect(() => {
        const nextTodaysCommentedMovieIds = Array.from(
            new Set(
                dailyRituals
                    .filter((ritual) => ritual.date === dateKey)
                    .map((ritual) => ritual.movieId)
                    .filter((movieId) => Number.isInteger(movieId) && movieId > 0)
            )
        );
        setTodaysCommentedMovieIds(nextTodaysCommentedMovieIds);

        const fromRitualMovieIds = dailyRituals
            .filter((ritual) => ritual.date < dateKey)
            .map((ritual) => ritual.movieId)
            .filter((movieId) => Number.isInteger(movieId) && movieId > 0);
        setPreviouslyCommentedMovieIds(Array.from(new Set([...fromRitualMovieIds, ...(importedHistory?.movieIds || [])])));

        const fromRitualTitles = dailyRituals
            .filter((ritual) => ritual.date < dateKey)
            .map((ritual) => ritual.movieTitle || '')
            .map((value) => value.trim())
            .filter(Boolean);
        setPreviouslyCommentedMovieTitles(Array.from(new Set([...fromRitualTitles, ...(importedHistory?.titleKeys || [])])));
    }, [dailyRituals, dateKey, importedHistory?.movieIds, importedHistory?.titleKeys]);

    const dailyStructuredData = useMemo(() => {
        if (!movies.length) return null;

        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://180absolutecinema.com';
        const itemListElement = movies.map((movie, index) => {
            const movieSchema: Record<string, unknown> = {
                '@type': 'Movie',
                name: movie.title,
                genre: movie.genre || undefined,
                image: movie.posterPath || undefined,
                dateCreated: movie.year ? String(movie.year) : undefined,
                director: movie.director
                    ? {
                          '@type': 'Person',
                          name: movie.director
                      }
                    : undefined
            };

            if (typeof movie.voteAverage === 'number' && Number.isFinite(movie.voteAverage) && movie.voteAverage > 0) {
                movieSchema.aggregateRating = {
                    '@type': 'AggregateRating',
                    ratingValue: movie.voteAverage.toFixed(1),
                    bestRating: '10'
                };
            }

            return {
                '@type': 'ListItem',
                position: index + 1,
                url: `${origin}/#/film/${movie.id}`,
                item: movieSchema
            };
        });

        return {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `180 Daily 5 - ${dateKey}`,
            description: 'Curated Daily 5 movie selection.',
            numberOfItems: itemListElement.length,
            itemListOrder: 'http://schema.org/ItemListOrderAscending',
            itemListElement
        };
    }, [dateKey, movies]);

    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const syncScrollState = () => {
        const container = scrollerRef.current;
        if (!container) return;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        setCanScrollLeft(container.scrollLeft > 6);
        setCanScrollRight(container.scrollLeft < maxScrollLeft - 6);
    };

    const scrollMovies = (direction: 'left' | 'right') => {
        const container = scrollerRef.current;
        if (!container) return;
        const firstCard = container.querySelector<HTMLElement>('[data-movie-card="true"]');
        const styles = getComputedStyle(container);
        const gapValue = parseFloat(styles.columnGap || styles.gap || '0');
        const amount = firstCard
            ? Math.round(firstCard.clientWidth + gapValue)
            : Math.round(container.clientWidth * 0.82);
        container.scrollBy({
            left: direction === 'right' ? amount : -amount,
            behavior: 'smooth'
        });
        window.setTimeout(syncScrollState, 260);
    };

    useEffect(() => {
        syncScrollState();
        const container = scrollerRef.current;
        if (!container) return;

        const onScroll = () => syncScrollState();
        container.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', syncScrollState);

        return () => {
            container.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', syncScrollState);
        };
    }, [movies.length]);

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto mb-24 h-96 flex items-center justify-center">
                <span className="text-sage/50 text-xs tracking-widest animate-pulse">{text.daily.loading}</span>
            </div>
        );
    }

    return (
        <section className="max-w-6xl mx-auto mb-24">
            {dailyStructuredData ? (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(dailyStructuredData) }}
                />
            ) : null}

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end items-start gap-4 px-4 sm:px-6 mb-8 border-b border-gray-200/50 pb-4">
                <div>
                    <h3 className="text-sm font-bold tracking-widest text-sage uppercase">{text.daily.title}</h3>
                    <span className="text-[10px] italic text-gray-400">{text.daily.subtitle}</span>
                </div>
                <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-2">
                    <CycleTime />
                    <div className="sm:hidden flex items-center gap-2 text-[9px] tracking-[0.16em] uppercase text-clay/80">
                        <span>{text.daily.swipeHint}</span>
                        <button
                            type="button"
                            onClick={() => scrollMovies('left')}
                            disabled={!canScrollLeft}
                            className="h-6 w-6 rounded-full border border-clay/30 bg-[#171717] text-clay/80 hover:text-clay hover:border-clay/60 transition-colors disabled:opacity-35 disabled:hover:border-clay/30 disabled:hover:text-clay/80"
                            aria-label={text.daily.scrollLeftAria}
                        >
                            &lt;
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollMovies('right')}
                            disabled={!canScrollRight}
                            className="h-6 w-6 rounded-full border border-clay/30 bg-[#171717] text-clay/80 hover:text-clay hover:border-clay/60 transition-colors disabled:opacity-35 disabled:hover:border-clay/30 disabled:hover:text-clay/80"
                            aria-label={text.daily.scrollRightAria}
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>

            <div
                ref={scrollerRef}
                className="flex md:grid md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 px-4 sm:px-6 overflow-x-auto md:overflow-visible pb-2 md:pb-0 snap-x snap-mandatory md:snap-none scroll-pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {movies.map((movie, index) => {
                    const isMysterySlot = index === 4;
                    const isLocked = isMysterySlot && dailyRitualsCount === 0;
                    const isWatchedToday = todaysCommentedMovieIds.includes(movie.id);

                    return (
                        <div key={movie.id} data-movie-card="true" className="relative h-full min-w-[74vw] sm:min-w-[46vw] md:min-w-0 snap-start">
                            <div className={`h-full transition-all duration-1000 ease-in-out ${isLocked ? 'blur-sm grayscale opacity-50' : 'blur-0 grayscale-0 opacity-100'}`}>
                                <MovieCard
                                    movie={movie}
                                    index={index}
                                    isWatchedToday={isWatchedToday}
                                    onClick={() => {
                                        if (isLocked) return;
                                        onMovieSelect(movie);
                                    }}
                                />
                            </div>

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
                                    {text.daily.lockLine1}
                                    <br />
                                    {text.daily.lockLine2}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
