import React, { useEffect, useMemo, useState } from 'react';
import { MOCK_ARENA_RITUALS, type Ritual } from '../../data/mockArena';
import { RitualCard } from './RitualCard';
import { useXP } from '../../context/XPContext';

const CUSTOM_RITUALS_STORAGE_KEY = 'RITUAL_FEED_CUSTOM_V1';
const MAX_NOTE_CHARS = 180;

const loadCustomRituals = (): Ritual[] => {
    try {
        const raw = localStorage.getItem(CUSTOM_RITUALS_STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
            .map((item, index) => ({
                id: typeof item.id === 'string' ? item.id : `custom-fallback-${index}`,
                movieId: typeof item.movieId === 'number' ? item.movieId : 0,
                movieTitle: typeof item.movieTitle === 'string' ? item.movieTitle : 'Unknown Title',
                year: typeof item.year === 'number' ? item.year : undefined,
                posterPath: typeof item.posterPath === 'string' ? item.posterPath : undefined,
                author: typeof item.author === 'string' ? item.author : 'You',
                text: typeof item.text === 'string' ? item.text : '',
                echoes: typeof item.echoes === 'number' ? item.echoes : 0,
                isEchoedByMe: false,
                timestamp: typeof item.timestamp === 'string' ? item.timestamp : 'Just Now',
                league: typeof item.league === 'string' ? item.league : 'Bronze',
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
                isCustom: true,
                replies: Array.isArray(item.replies) ? item.replies : []
            }))
            .filter((ritual) => ritual.movieId > 0 && ritual.text.trim().length > 0);
    } catch {
        return [];
    }
};

export const Arena: React.FC = () => {
    const { user, league } = useXP();
    const [rituals, setRituals] = useState<Ritual[]>(() => [...loadCustomRituals(), ...MOCK_ARENA_RITUALS]);
    const [filter, setFilter] = useState<'all' | 'today'>('all');
    const [sortMode, setSortMode] = useState<'latest' | 'echoes'>('latest');
    const [query, setQuery] = useState('');
    const [selectedMovieId, setSelectedMovieId] = useState<number>(() => MOCK_ARENA_RITUALS[0]?.movieId || 157336);
    const [draft, setDraft] = useState('');

    const movieOptions = useMemo(() => {
        const map = new Map<number, { movieId: number; movieTitle: string; year?: number; posterPath?: string }>();
        rituals.forEach((ritual) => {
            if (!map.has(ritual.movieId)) {
                map.set(ritual.movieId, {
                    movieId: ritual.movieId,
                    movieTitle: ritual.movieTitle,
                    year: ritual.year,
                    posterPath: ritual.posterPath
                });
            }
        });
        return Array.from(map.values());
    }, [rituals]);

    useEffect(() => {
        if (!movieOptions.some((movie) => movie.movieId === selectedMovieId) && movieOptions[0]) {
            setSelectedMovieId(movieOptions[0].movieId);
        }
    }, [movieOptions, selectedMovieId]);

    useEffect(() => {
        const customRituals = rituals
            .filter((ritual) => ritual.isCustom)
            .map((ritual) => ({
                ...ritual,
                featuredMarks: undefined
            }));
        try {
            localStorage.setItem(CUSTOM_RITUALS_STORAGE_KEY, JSON.stringify(customRituals));
        } catch {
            // Ignore local storage write failures (private mode / quota).
        }
    }, [rituals]);

    const filteredRituals = useMemo(() => {
        const queryText = query.trim().toLowerCase();
        let items = rituals.filter((ritual) => {
            if (filter === 'today' && ritual.timestamp.includes('d ago')) return false;
            if (!queryText) return true;
            return (
                ritual.author.toLowerCase().includes(queryText) ||
                ritual.movieTitle.toLowerCase().includes(queryText) ||
                ritual.text.toLowerCase().includes(queryText)
            );
        });

        if (sortMode === 'echoes') {
            items = [...items].sort((a, b) => b.echoes - a.echoes);
        }

        return items;
    }, [filter, query, rituals, sortMode]);

    const charsLeft = MAX_NOTE_CHARS - draft.length;
    const selectedMovie = movieOptions.find((movie) => movie.movieId === selectedMovieId);

    const handlePost = () => {
        const text = draft.trim();
        if (!text) return;

        const newRitual: Ritual = {
            id: `custom-${Date.now()}`,
            movieId: selectedMovieId,
            movieTitle: selectedMovie?.movieTitle || 'Unknown Title',
            year: selectedMovie?.year,
            posterPath: selectedMovie?.posterPath,
            author: user?.name || 'You',
            text,
            echoes: 0,
            isEchoedByMe: false,
            timestamp: 'Just Now',
            league,
            createdAt: Date.now(),
            isCustom: true,
            replies: []
        };

        setRituals((prev) => [newRitual, ...prev]);
        setDraft('');
        setFilter('today');
    };

    return (
        <section className="max-w-4xl mx-auto px-6 mb-32 animate-slide-up">
            <div className="flex flex-col items-center mb-10 opacity-70">
                <div className="w-px h-12 bg-sage/20 mb-4" />
                <h2 className="text-xs font-bold tracking-[0.3em] text-sage uppercase">
                    Ritual Feed
                </h2>
                <p className="mt-2 text-[10px] tracking-[0.18em] uppercase text-[#E5E4E2]/40">
                    Write quickly. Read clearly.
                </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-5 mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <h3 className="text-[10px] tracking-[0.22em] uppercase text-sage font-bold">
                        Quick Comment
                    </h3>
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] uppercase tracking-[0.18em] text-gray-500">Movie</label>
                        <select
                            value={selectedMovieId}
                            onChange={(e) => setSelectedMovieId(Number(e.target.value))}
                            className="bg-[#141414] border border-white/10 text-[11px] text-[#E5E4E2] px-2 py-1 rounded outline-none focus:border-sage/40"
                        >
                            {movieOptions.map((movie) => (
                                <option key={movie.movieId} value={movie.movieId}>
                                    {movie.movieTitle}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <textarea
                    value={draft}
                    onChange={(e) => {
                        if (e.target.value.length <= MAX_NOTE_CHARS) {
                            setDraft(e.target.value);
                        }
                    }}
                    placeholder="Leave a short thought..."
                    className="w-full h-24 bg-[#121212] border border-white/10 rounded p-3 text-sm text-[#E5E4E2] placeholder:text-gray-600 outline-none focus:border-sage/40 resize-none"
                />

                <div className="mt-3 flex items-center justify-between">
                    <span className={`text-[10px] tracking-widest ${charsLeft < 20 ? 'text-red-400' : 'text-gray-500'}`}>
                        {draft.length}/{MAX_NOTE_CHARS}
                    </span>
                    <button
                        onClick={handlePost}
                        disabled={!draft.trim()}
                        className="px-4 py-2 bg-sage text-[#121212] text-[10px] tracking-[0.2em] uppercase font-bold rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#9AB06B] transition-colors"
                    >
                        Post
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 border-b border-sage/10 pb-3">
                <div className="flex gap-6">
                    <button
                        onClick={() => setFilter('all')}
                        className={`text-[10px] uppercase tracking-widest transition-colors ${filter === 'all' ? 'text-sage font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('today')}
                        className={`text-[10px] uppercase tracking-widest transition-colors ${filter === 'today' ? 'text-sage font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Today
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search comments..."
                        className="w-44 bg-[#121212] border border-white/10 text-[11px] text-[#E5E4E2] px-3 py-1.5 rounded outline-none focus:border-sage/40"
                    />
                    <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as 'latest' | 'echoes')}
                        className="bg-[#141414] border border-white/10 text-[11px] text-[#E5E4E2] px-2 py-1.5 rounded outline-none focus:border-sage/40"
                    >
                        <option value="latest">Latest</option>
                        <option value="echoes">Most Echoed</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-col">
                {filteredRituals.length > 0 ? (
                    filteredRituals.map((ritual) => (
                        <RitualCard key={ritual.id} ritual={ritual} />
                    ))
                ) : (
                    <div className="text-center py-10 text-[10px] text-gray-500 uppercase tracking-[0.18em] border border-white/5 rounded">
                        No comments found for this filter.
                    </div>
                )}
            </div>

            <div className="mt-12 text-center">
                <span className="text-[10px] tracking-[0.2em] text-[#E5E4E2]/20 uppercase">
                    End of Ritual Feed
                </span>
            </div>
        </section>
    );
};
