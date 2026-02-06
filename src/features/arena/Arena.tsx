import React, { useMemo, useState } from 'react';
import { MOCK_ARENA_RITUALS, type Ritual } from '../../data/mockArena';
import { RitualCard } from './RitualCard';
import { useXP } from '../../context/XPContext';

const getRitualTimeScore = (ritual: Ritual): number => {
    if (typeof ritual.createdAt === 'number' && Number.isFinite(ritual.createdAt)) {
        return ritual.createdAt;
    }

    const normalized = ritual.timestamp.trim().toLowerCase();
    if (normalized === 'just now' || normalized === 'today') return Date.now();

    const hoursMatch = normalized.match(/^(\d+)h ago$/);
    if (hoursMatch) {
        return Date.now() - Number(hoursMatch[1]) * 60 * 60 * 1000;
    }

    const daysMatch = normalized.match(/^(\d+)d ago$/);
    if (daysMatch) {
        return Date.now() - Number(daysMatch[1]) * 24 * 60 * 60 * 1000;
    }

    const parsed = Date.parse(ritual.timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateAsRitualTimestamp = (dateStr: string): string => {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const ritualDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.floor((todayStart - ritualDay) / (24 * 60 * 60 * 1000));

    if (diffDays <= 0) return 'Today';
    return `${diffDays}d ago`;
};

export const Arena: React.FC = () => {
    const { dailyRituals, user, league, deleteRitual } = useXP();
    const [filter, setFilter] = useState<'all' | 'today'>('all');
    const [sortMode, setSortMode] = useState<'latest' | 'echoes'>('latest');
    const [query, setQuery] = useState('');

    const handleDelete = (ritualId: string) => {
        const normalized = ritualId.startsWith('log-') ? ritualId.slice(4) : ritualId;
        deleteRitual(String(normalized));
    };

    const rituals = useMemo<Ritual[]>(() => {
        const mine: Ritual[] = dailyRituals.map((ritual) => ({
            id: `log-${ritual.id}`,
            movieId: ritual.movieId,
            movieTitle: ritual.movieTitle || `Film #${ritual.movieId}`,
            posterPath: ritual.posterPath,
            author: user?.name || 'You',
            text: ritual.text,
            echoes: 0,
            isEchoedByMe: false,
            timestamp: formatDateAsRitualTimestamp(ritual.date),
            league,
            createdAt: new Date(`${ritual.date}T12:00:00`).getTime(),
            isCustom: true,
            replies: []
        }));

        return [...mine, ...MOCK_ARENA_RITUALS];
    }, [dailyRituals, league, user?.name]);

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
            return items;
        }

        return [...items].sort((a, b) => getRitualTimeScore(b) - getRitualTimeScore(a));
    }, [filter, query, rituals, sortMode]);

    return (
        <section className="max-w-4xl mx-auto px-0 sm:px-6 mb-32 animate-slide-up">
            <div className="flex flex-col items-center mb-10 opacity-70 px-4 sm:px-0">
                <div className="w-px h-12 bg-sage/20 mb-4" />
                <h2 className="text-xs font-bold tracking-[0.3em] text-sage uppercase">
                    Ritual Feed
                </h2>
                <p className="mt-2 text-[10px] tracking-[0.18em] uppercase text-[#E5E4E2]/40">
                    Comments are submitted from film cards only.
                </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 border-b border-sage/10 pb-3 px-4 sm:px-0">
                <div className="flex gap-4 sm:gap-6">
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

                <div className="flex w-full md:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search comments..."
                        className="w-full sm:w-56 md:w-44 bg-[#121212] border border-white/10 text-[11px] text-[#E5E4E2] px-3 py-1.5 rounded outline-none focus:border-sage/40"
                    />
                    <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as 'latest' | 'echoes')}
                        className="w-full sm:w-auto bg-[#141414] border border-white/10 text-[11px] text-[#E5E4E2] px-2 py-1.5 rounded outline-none focus:border-sage/40"
                    >
                        <option value="latest">Latest</option>
                        <option value="echoes">Most Echoed</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-col">
                {filteredRituals.length > 0 ? (
                    filteredRituals.map((ritual) => (
                        <RitualCard
                            key={ritual.id}
                            ritual={ritual}
                            onDelete={ritual.isCustom ? () => handleDelete(ritual.id) : undefined}
                        />
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
