import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_ARENA_RITUALS, type Ritual } from '../../data/mockArena';
import { RitualCard } from './RitualCard';
import { useXP } from '../../context/XPContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isSupabaseLive } from '../../lib/supabase';
import { TMDB_SEEDS } from '../../data/tmdbSeeds';

interface RitualRow {
    id: string;
    user_id: string | null;
    author: string | null;
    movie_title: string | null;
    poster_path: string | null;
    text: string | null;
    timestamp: string | null;
    league: string | null;
    year: string | null;
}

interface EchoRow {
    ritual_id: string;
    user_id: string;
}

interface ReplyRow {
    id: string;
    ritual_id: string;
    author: string | null;
    text: string | null;
    created_at: string | null;
}

const isSupabaseCapabilityError = (
    error: { code?: string | null; message?: string | null } | null | undefined
): boolean => {
    if (!error) return false;
    const code = (error.code || '').toUpperCase();
    const message = (error.message || '').toLowerCase();
    if (code === 'PGRST205' || code === '42P01' || code === '42501') return true;
    return (
        message.includes('relation "') ||
        message.includes('does not exist') ||
        message.includes('schema cache') ||
        message.includes('permission') ||
        message.includes('policy') ||
        message.includes('jwt') ||
        message.includes('forbidden')
    );
};

const MOVIE_ID_BY_TITLE = new Map(
    TMDB_SEEDS.map((movie) => [movie.title.trim().toLowerCase(), movie.id] as const)
);

const getMovieIdByTitle = (title: string): number => {
    const normalized = title.trim().toLowerCase();
    return MOVIE_ID_BY_TITLE.get(normalized) || 0;
};

const parseYear = (yearRaw: string | null): number | undefined => {
    if (!yearRaw) return undefined;
    const parsed = Number(yearRaw);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
};

const toRelativeTimestamp = (rawTimestamp: string): string => {
    const parsed = Date.parse(rawTimestamp);
    if (Number.isNaN(parsed)) return rawTimestamp;

    const now = Date.now();
    const diffMs = now - parsed;
    if (diffMs < 0) return 'Today';

    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const diffHours = Math.floor(diffMs / hourMs);
    if (diffHours < 1) return 'Just Now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffMs / dayMs)}d ago`;
};

type RitualReply = NonNullable<Ritual['replies']>[number];

const normalizeReplyRow = (row: ReplyRow): RitualReply | null => {
    if (!row.id || typeof row.id !== 'string') return null;
    if (!row.author || !row.text) return null;
    return {
        id: row.id,
        author: row.author,
        text: row.text,
        timestamp: row.created_at ? toRelativeTimestamp(row.created_at) : 'Just Now'
    };
};

const mapDbRitual = (
    row: RitualRow,
    options: {
        currentUserId?: string;
        echoes: number;
        isEchoedByMe: boolean;
        replies: RitualReply[];
    }
): Ritual => {
    const movieTitle = row.movie_title || 'Unknown Title';
    const rawTimestamp = row.timestamp || new Date().toISOString();
    return {
        id: row.id,
        movieId: getMovieIdByTitle(movieTitle),
        movieTitle,
        year: parseYear(row.year),
        posterPath: row.poster_path || undefined,
        author: row.author || 'Observer',
        text: row.text || '',
        echoes: options.echoes,
        isEchoedByMe: options.isEchoedByMe,
        timestamp: toRelativeTimestamp(rawTimestamp),
        league: row.league || 'Bronze',
        createdAt: Date.parse(rawTimestamp),
        isCustom: Boolean(options.currentUserId && row.user_id && row.user_id === options.currentUserId),
        replies: options.replies
    };
};

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
    const { addNotification } = useNotifications();
    const [filter, setFilter] = useState<'all' | 'today'>('all');
    const [sortMode, setSortMode] = useState<'latest' | 'echoes'>('latest');
    const [query, setQuery] = useState('');
    const supabaseEnabled = isSupabaseLive() && !!supabase;
    const [forceLocalFeed, setForceLocalFeed] = useState(false);
    const canUseRemoteFeed = supabaseEnabled && !forceLocalFeed;
    const [remoteRituals, setRemoteRituals] = useState<Ritual[]>(() => (supabaseEnabled ? [] : MOCK_ARENA_RITUALS));
    const [localRepliesByRitualId, setLocalRepliesByRitualId] = useState<Record<string, RitualReply[]>>({});
    const [isRemoteLoading, setIsRemoteLoading] = useState(canUseRemoteFeed);
    const [feedError, setFeedError] = useState<string | null>(null);
    const lastNotifiedErrorRef = useRef<string | null>(null);

    const reportFeedError = useCallback((message: string) => {
        setFeedError(message);
        if (lastNotifiedErrorRef.current === message) return;
        lastNotifiedErrorRef.current = message;
        addNotification({
            type: 'system',
            message
        });
    }, [addNotification]);

    useEffect(() => {
        const validIds = new Set(dailyRituals.map((ritual) => `log-${ritual.id}`));
        setLocalRepliesByRitualId((prev) => {
            const nextEntries = Object.entries(prev).filter(([ritualId]) => validIds.has(ritualId));
            if (nextEntries.length === Object.keys(prev).length) return prev;
            return Object.fromEntries(nextEntries);
        });
    }, [dailyRituals]);

    useEffect(() => {
        const client = supabase;
        if (!canUseRemoteFeed || !client) {
            setIsRemoteLoading(false);
            return;
        }

        let active = true;
        const fetchRituals = async () => {
            const { data, error } = await client
                .from('rituals')
                .select('id, user_id, author, movie_title, poster_path, text, timestamp, league, year')
                .order('timestamp', { ascending: false })
                .limit(120);

            if (!active) return;

            if (error) {
                console.error('[Arena] failed to fetch rituals', error);
                if (isSupabaseCapabilityError(error)) {
                    setForceLocalFeed(true);
                    reportFeedError('Global ritual feed su an kullanilamiyor. Yerel feed gosteriliyor.');
                    setRemoteRituals([]);
                    setIsRemoteLoading(false);
                    return;
                }
                reportFeedError('Ritual feed su anda yuklenemiyor. Baglantiyi kontrol edip tekrar dene.');
                setRemoteRituals([]);
                setIsRemoteLoading(false);
                return;
            }

            const rows = Array.isArray(data) ? (data as RitualRow[]) : [];
            const ritualIds = rows.map((row) => row.id);
            let echoRows: EchoRow[] = [];
            let replyRows: ReplyRow[] = [];
            let hasSubFetchError = false;

            if (ritualIds.length > 0) {
                const [{ data: echoesData, error: echoesError }, { data: repliesData, error: repliesError }] = await Promise.all([
                    client
                        .from('ritual_echoes')
                        .select('ritual_id, user_id')
                        .in('ritual_id', ritualIds),
                    client
                        .from('ritual_replies')
                        .select('id, ritual_id, author, text, created_at')
                        .in('ritual_id', ritualIds)
                        .order('created_at', { ascending: true })
                ]);

                if (echoesError) {
                    console.error('[Arena] failed to fetch ritual echoes', echoesError);
                    reportFeedError('Echo verileri senkronize edilemedi. Akisi yenileyip tekrar dene.');
                    hasSubFetchError = true;
                } else {
                    echoRows = Array.isArray(echoesData) ? (echoesData as EchoRow[]) : [];
                }

                if (repliesError) {
                    console.error('[Arena] failed to fetch ritual replies', repliesError);
                    reportFeedError('Yanit verileri senkronize edilemedi. Akisi yenileyip tekrar dene.');
                    hasSubFetchError = true;
                } else {
                    replyRows = Array.isArray(repliesData) ? (repliesData as ReplyRow[]) : [];
                }
            }

            const echoCountByRitual = new Map<string, number>();
            const echoedByMe = new Set<string>();
            for (const row of echoRows) {
                echoCountByRitual.set(row.ritual_id, (echoCountByRitual.get(row.ritual_id) || 0) + 1);
                if (user?.id && row.user_id === user.id) {
                    echoedByMe.add(row.ritual_id);
                }
            }

            const repliesByRitual = new Map<string, RitualReply[]>();
            for (const row of replyRows) {
                const normalized = normalizeReplyRow(row);
                if (!normalized) continue;
                const current = repliesByRitual.get(row.ritual_id) || [];
                current.push(normalized);
                repliesByRitual.set(row.ritual_id, current);
            }

            setRemoteRituals(
                rows.map((row) =>
                    mapDbRitual(row, {
                        currentUserId: user?.id,
                        echoes: echoCountByRitual.get(row.id) || 0,
                        isEchoedByMe: echoedByMe.has(row.id),
                        replies: repliesByRitual.get(row.id) || []
                    })
                )
            );
            if (!hasSubFetchError) {
                setFeedError(null);
                lastNotifiedErrorRef.current = null;
            }
            setIsRemoteLoading(false);
        };

        void fetchRituals();

        const channel = client
            .channel('rituals-feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rituals' }, () => {
                void fetchRituals();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_echoes' }, () => {
                void fetchRituals();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_replies' }, () => {
                void fetchRituals();
            })
            .subscribe();

        const pollId = window.setInterval(() => {
            void fetchRituals();
        }, 30000);

        return () => {
            active = false;
            window.clearInterval(pollId);
            void client.removeChannel(channel);
        };
    }, [canUseRemoteFeed, reportFeedError, user?.id]);

    const handleDelete = (ritualId: string) => {
        if (canUseRemoteFeed && supabase) {
            void supabase
                .from('rituals')
                .delete()
                .eq('id', ritualId)
                .then(({ error }) => {
                    if (error) {
                        console.error('[Arena] failed to delete ritual', error);
                        reportFeedError('Ritual silinemedi. Tekrar dene.');
                        return;
                    }
                    setRemoteRituals((prev) => prev.filter((ritual) => ritual.id !== ritualId));
                });
            return;
        }

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
            replies: localRepliesByRitualId[`log-${ritual.id}`] || []
        }));

        if (canUseRemoteFeed) {
            if (remoteRituals.length === 0) {
                return mine;
            }

            const remoteKeys = new Set(
                remoteRituals.map((ritual) => `${ritual.movieId}|${ritual.text.trim().toLowerCase()}`)
            );
            const localOnlyMine = mine.filter(
                (ritual) => !remoteKeys.has(`${ritual.movieId}|${ritual.text.trim().toLowerCase()}`)
            );

            return [...localOnlyMine, ...remoteRituals];
        }

        return [...mine, ...MOCK_ARENA_RITUALS];
    }, [canUseRemoteFeed, dailyRituals, league, localRepliesByRitualId, remoteRituals, user?.name]);

    const filteredRituals = useMemo(() => {
        const queryText = query.trim().toLowerCase();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let items = rituals.filter((ritual) => {
            if (filter === 'today' && getRitualTimeScore(ritual) < todayStart) return false;
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
                {feedError && (
                    <div className="mb-3 text-center py-3 px-3 text-[10px] text-red-300 uppercase tracking-[0.14em] border border-red-400/30 rounded bg-red-500/5">
                        {feedError}
                    </div>
                )}
                {isRemoteLoading && canUseRemoteFeed ? (
                    <div className="text-center py-10 text-[10px] text-gray-500 uppercase tracking-[0.18em] border border-white/5 rounded">
                        Loading global ritual feed...
                    </div>
                ) : filteredRituals.length > 0 ? (
                    filteredRituals.map((ritual) => (
                        <RitualCard
                            key={ritual.id}
                            ritual={ritual}
                            onDelete={ritual.isCustom ? () => handleDelete(ritual.id) : undefined}
                            onLocalRepliesChange={ritual.id.startsWith('log-')
                                ? (ritualId, replies) => {
                                    setLocalRepliesByRitualId((prev) => ({
                                        ...prev,
                                        [ritualId]: replies
                                    }));
                                }
                                : undefined
                            }
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
