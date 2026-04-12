import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_ARENA_RITUALS, type Ritual } from '../../data/mockArena';
import { RitualCard } from './RitualCard';
import { useXP } from '../../context/XPContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isSupabaseLive } from '../../lib/supabase';
import { TMDB_SEEDS } from '../../data/tmdbSeeds';
import { useLanguage } from '../../context/LanguageContext';

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

type PartialRitualRow = Partial<RitualRow> & {
    id?: string;
};

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

type ProfileTarget = {
    userId?: string | null;
    username: string;
};

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

const normalizeRitualRow = (row: PartialRitualRow): RitualRow | null => {
    if (!row.id || typeof row.id !== 'string') return null;
    return {
        id: row.id,
        user_id: typeof row.user_id === 'string' ? row.user_id : null,
        author: typeof row.author === 'string' ? row.author : null,
        movie_title: typeof row.movie_title === 'string' ? row.movie_title : null,
        poster_path: typeof row.poster_path === 'string' ? row.poster_path : null,
        text: typeof row.text === 'string' ? row.text : null,
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
        league: typeof row.league === 'string' ? row.league : null,
        year: typeof row.year === 'string' ? row.year : null
    };
};

const RITUAL_SELECT_VARIANTS = [
    {
        select: 'id, user_id, author, movie_title, poster_path, text, timestamp, league, year',
        orderBy: 'timestamp'
    },
    {
        select: 'id, user_id, author, movie_title, poster_path, text, timestamp, league',
        orderBy: 'timestamp'
    },
    {
        select: 'id, user_id, author, movie_title, text, timestamp, league',
        orderBy: 'timestamp'
    },
    {
        select: 'id, user_id, author, movie_title, poster_path, text, timestamp:created_at, league, year',
        orderBy: 'created_at'
    },
    {
        select: 'id, user_id, author, movie_title, text, timestamp:created_at, league',
        orderBy: 'created_at'
    },
    {
        select: 'id, user_id, author, movie_title, poster_path, text, timestamp',
        orderBy: 'timestamp'
    },
    {
        select: 'id, user_id, author, movie_title, text, timestamp',
        orderBy: 'timestamp'
    },
    {
        select: 'id, user_id, author, movie_title, poster_path, text, timestamp:created_at',
        orderBy: 'created_at'
    },
    {
        select: 'id, user_id, author, movie_title, text, timestamp:created_at',
        orderBy: 'created_at'
    },
    {
        select: 'id, author, movie_title, poster_path, text, timestamp',
        orderBy: 'timestamp'
    },
    {
        select: 'id, author, movie_title, text, timestamp',
        orderBy: 'timestamp'
    },
    {
        select: 'id, author, movie_title, poster_path, text, timestamp:created_at',
        orderBy: 'created_at'
    },
    {
        select: 'id, author, movie_title, text, timestamp:created_at',
        orderBy: 'created_at'
    },
    {
        select: 'id, movie_title, text, timestamp',
        orderBy: 'timestamp'
    },
    {
        select: 'id, movie_title, text, timestamp:created_at',
        orderBy: 'created_at'
    }
] as const;

const toRelativeTimestamp = (
    rawTimestamp: string,
    labels: {
        timeToday: string;
        timeJustNow: string;
        timeHoursAgo: string;
        timeDaysAgo: string;
    }
): string => {
    const parsed = Date.parse(rawTimestamp);
    if (Number.isNaN(parsed)) return rawTimestamp;

    const now = Date.now();
    const diffMs = now - parsed;
    if (diffMs < 0) return labels.timeToday;

    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const diffHours = Math.floor(diffMs / hourMs);
    if (diffHours < 1) return labels.timeJustNow;
    if (diffHours < 24) return labels.timeHoursAgo.replace('{count}', String(diffHours));
    return labels.timeDaysAgo.replace('{count}', String(Math.floor(diffMs / dayMs)));
};

type RitualReply = NonNullable<Ritual['replies']>[number];

const normalizeReplyRow = (
    row: ReplyRow,
    labels: {
        timeToday: string;
        timeJustNow: string;
        timeHoursAgo: string;
        timeDaysAgo: string;
    }
): RitualReply | null => {
    if (!row.id || typeof row.id !== 'string') return null;
    if (!row.author || !row.text) return null;
    return {
        id: row.id,
        author: row.author,
        text: row.text,
        timestamp: row.created_at ? toRelativeTimestamp(row.created_at, labels) : labels.timeJustNow
    };
};

const mapDbRitual = (
    row: RitualRow,
    options: {
        currentUserId?: string;
        echoes: number;
        isEchoedByMe: boolean;
        replies: RitualReply[];
        authorFallback: string;
        movieTitleFallback: string;
        timeLabels: {
            timeToday: string;
            timeJustNow: string;
            timeHoursAgo: string;
            timeDaysAgo: string;
        };
    }
): Ritual => {
    const movieTitle = row.movie_title || options.movieTitleFallback;
    const rawTimestamp = row.timestamp || new Date().toISOString();
    return {
        id: row.id,
        userId: row.user_id,
        movieId: getMovieIdByTitle(movieTitle),
        movieTitle,
        year: parseYear(row.year),
        posterPath: row.poster_path || undefined,
        author: row.author || options.authorFallback,
        text: row.text || '',
        echoes: options.echoes,
        isEchoedByMe: options.isEchoedByMe,
        timestamp: toRelativeTimestamp(rawTimestamp, options.timeLabels),
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

const parseEnglishRelativeTimestampMs = (rawTimestamp: string): number | null => {
    const normalized = rawTimestamp.trim().toLowerCase();
    if (normalized === 'just now' || normalized === 'today') return Date.now();

    const hoursMatch = normalized.match(/^(\d+)h ago$/);
    if (hoursMatch) {
        return Date.now() - Number(hoursMatch[1]) * 60 * 60 * 1000;
    }

    const daysMatch = normalized.match(/^(\d+)d ago$/);
    if (daysMatch) {
        return Date.now() - Number(daysMatch[1]) * 24 * 60 * 60 * 1000;
    }

    const parsed = Date.parse(rawTimestamp);
    return Number.isNaN(parsed) ? null : parsed;
};

const localizeEnglishRelativeTimestamp = (
    rawTimestamp: string,
    labels: {
        timeToday: string;
        timeJustNow: string;
        timeHoursAgo: string;
        timeDaysAgo: string;
    }
): string => {
    const normalized = rawTimestamp.trim().toLowerCase();
    if (normalized === 'today') return labels.timeToday;
    if (normalized === 'just now') return labels.timeJustNow;

    const hoursMatch = normalized.match(/^(\d+)h ago$/);
    if (hoursMatch) {
        return labels.timeHoursAgo.replace('{count}', hoursMatch[1]);
    }

    const daysMatch = normalized.match(/^(\d+)d ago$/);
    if (daysMatch) {
        return labels.timeDaysAgo.replace('{count}', daysMatch[1]);
    }

    return rawTimestamp;
};

const formatDateAsRitualTimestamp = (
    dateStr: string,
    labels: {
        timeToday: string;
        timeDaysAgo: string;
    }
): string => {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const ritualDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.floor((todayStart - ritualDay) / (24 * 60 * 60 * 1000));

    if (diffDays <= 0) return labels.timeToday;
    return labels.timeDaysAgo.replace('{count}', String(diffDays));
};

const normalizeRitualText = (value: string): string => value.trim().toLowerCase();
const normalizeRitualTitle = (value: string): string => value.trim().toLowerCase();
const getRitualDayKey = (ritual: Ritual): string => {
    if (typeof ritual.createdAt === 'number' && Number.isFinite(ritual.createdAt)) {
        const date = new Date(ritual.createdAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return ritual.timestamp.trim().toLowerCase();
};

const buildArenaDedupKey = (ritual: Ritual): string => {
    const dayKey = getRitualDayKey(ritual);
    const normalizedText = normalizeRitualText(ritual.text);
    const normalizedTitle = normalizeRitualTitle(ritual.movieTitle);
    const normalizedAuthor = (ritual.author || '').trim().toLowerCase();
    return `${dayKey}|${normalizedTitle}|${normalizedText}|${normalizedAuthor}`;
};

export const Arena: React.FC = () => {
    const { text, format } = useLanguage();
    const { dailyRituals, user, username, league, deleteRitual } = useXP();
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
    const [hotStreakNowMs, setHotStreakNowMs] = useState(0);
    const lastNotifiedErrorRef = useRef<string | null>(null);
    const relativeTimeLabels = useMemo(
        () => ({
            timeToday: text.profile.timeToday,
            timeJustNow: text.profile.timeJustNow,
            timeHoursAgo: text.profile.timeHoursAgo,
            timeDaysAgo: text.profile.timeDaysAgo
        }),
        [text.profile.timeDaysAgo, text.profile.timeHoursAgo, text.profile.timeJustNow, text.profile.timeToday]
    );

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
        const updateNow = () => setHotStreakNowMs(Date.now());
        updateNow();
        const timer = window.setInterval(updateNow, 60 * 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const client = supabase;
        if (!canUseRemoteFeed || !client) {
            setIsRemoteLoading(false);
            return;
        }

        let active = true;
        const fetchRitualRows = async (): Promise<{ rows: RitualRow[]; error: { code?: string | null; message?: string | null } | null }> => {
            let lastError: { code?: string | null; message?: string | null } | null = null;
            for (const variant of RITUAL_SELECT_VARIANTS) {
                const { data, error } = await client
                    .from('rituals')
                    .select(variant.select)
                    .order(variant.orderBy, { ascending: false })
                    .limit(120);

                if (error) {
                    lastError = error;
                    if (isSupabaseCapabilityError(error)) {
                        continue;
                    }
                    return { rows: [], error };
                }

                const normalizedRows = (Array.isArray(data) ? data : [])
                    .map((row) => normalizeRitualRow(row as PartialRitualRow))
                    .filter((row): row is RitualRow => Boolean(row));
                return { rows: normalizedRows, error: null };
            }
            return { rows: [], error: lastError };
        };

        const fetchRituals = async () => {
            const { rows, error } = await fetchRitualRows();

            if (!active) return;

            if (error) {
                console.error('[Arena] failed to fetch rituals', error);
                if (isSupabaseCapabilityError(error)) {
                    setForceLocalFeed(true);
                    reportFeedError(text.arena.feedFallback);
                    setRemoteRituals([]);
                    setIsRemoteLoading(false);
                    return;
                }
                reportFeedError(text.arena.feedLoadFailed);
                setRemoteRituals([]);
                setIsRemoteLoading(false);
                return;
            }

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
                    reportFeedError(text.arena.reactionLoadFailed);
                    hasSubFetchError = true;
                } else {
                    echoRows = Array.isArray(echoesData) ? (echoesData as EchoRow[]) : [];
                }

                if (repliesError) {
                    console.error('[Arena] failed to fetch ritual replies', repliesError);
                    reportFeedError(text.arena.replyLoadFailed);
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
                const normalized = normalizeReplyRow(row, relativeTimeLabels);
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
                        replies: repliesByRitual.get(row.id) || [],
                        authorFallback: text.profileWidget.observer,
                        movieTitleFallback: format(text.profile.filmFallback, { id: row.id }),
                        timeLabels: relativeTimeLabels
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
    }, [canUseRemoteFeed, relativeTimeLabels, reportFeedError, text, user?.id]);

    const handleDelete = (ritualId: string) => {
        if (canUseRemoteFeed && supabase) {
            void supabase
                .from('rituals')
                .delete()
                .eq('id', ritualId)
                .then(({ error }) => {
                    if (error) {
                        console.error('[Arena] failed to delete ritual', error);
                        reportFeedError(text.arena.deleteFailed);
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
            userId: user?.id || null,
            movieId: ritual.movieId,
            movieTitle: ritual.movieTitle || format(text.profile.filmFallback, { id: ritual.movieId }),
            posterPath: ritual.posterPath,
            author: user?.name || text.ritualCard.you,
            text: ritual.text,
            echoes: 0,
            isEchoedByMe: false,
            timestamp: formatDateAsRitualTimestamp(ritual.date, {
                timeToday: text.profile.timeToday,
                timeDaysAgo: text.profile.timeDaysAgo
            }),
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
                remoteRituals.map((ritual) => buildArenaDedupKey(ritual))
            );
            const localOnlyMine = mine.filter(
                (ritual) => !remoteKeys.has(buildArenaDedupKey(ritual))
            );

            return [...localOnlyMine, ...remoteRituals];
        }

        const localizedMockRituals = MOCK_ARENA_RITUALS.map((ritual) => {
            const fallbackCreatedAt = parseEnglishRelativeTimestampMs(ritual.timestamp);
            return {
                ...ritual,
                timestamp: localizeEnglishRelativeTimestamp(ritual.timestamp, relativeTimeLabels),
                createdAt: ritual.createdAt ?? fallbackCreatedAt ?? undefined
            };
        });

        return [...mine, ...localizedMockRituals];
    }, [canUseRemoteFeed, dailyRituals, format, league, localRepliesByRitualId, relativeTimeLabels, remoteRituals, text.profile.filmFallback, text.profile.timeDaysAgo, text.profile.timeToday, text.ritualCard.you, user?.id, user?.name]);

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

    const hotStreakAuthors = useMemo(() => {
        const cutoff = hotStreakNowMs - 2 * 24 * 60 * 60 * 1000;
        const countsByAuthor = new Map<string, number>();

        for (const ritual of rituals) {
            const authorKey = (ritual.author || '').trim().toLowerCase();
            if (!authorKey) continue;
            if (getRitualTimeScore(ritual) < cutoff) continue;
            countsByAuthor.set(authorKey, (countsByAuthor.get(authorKey) || 0) + 1);
        }

        return new Set(
            Array.from(countsByAuthor.entries())
                .filter(([, count]) => count >= 3)
                .map(([author]) => author)
        );
    }, [hotStreakNowMs, rituals]);

    const selfHandle = (username || user?.name || text.ritualCard.you).trim();

    const handleOpenAuthorProfile = (target: ProfileTarget) => {
        if (!target.username?.trim()) return;
        const key = target.userId
            ? `id:${target.userId}`
            : `name:${target.username.trim()}`;
        const encoded = encodeURIComponent(key);
        const query = target.username.trim()
            ? `?name=${encodeURIComponent(target.username.trim())}`
            : '';
        window.location.hash = `/u/${encoded}${query}`;
    };

    return (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 mb-32 animate-slide-up overflow-x-hidden">

            {/* Hero Header */}
            <div className="relative flex flex-col items-center mb-10 pt-2">
                {/* Decorative top line */}
                <div className="w-px h-10 bg-gradient-to-b from-transparent to-sage/30 mb-5" />

                {/* Icon */}
                <div className="w-10 h-10 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(138,154,91,0.15)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-sage">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="12" cy="4.5" r="1" fill="currentColor" />
                        <circle cx="12" cy="19.5" r="1" fill="currentColor" />
                        <circle cx="4.5" cy="12" r="1" fill="currentColor" />
                        <circle cx="19.5" cy="12" r="1" fill="currentColor" />
                    </svg>
                </div>

                <h2 className="text-[11px] font-bold tracking-[0.4em] text-sage uppercase mb-2">
                    {text.arena.title}
                </h2>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#E5E4E2]/30">
                    {text.arena.subtitle}
                </p>

                {/* Stats row */}
                {!isRemoteLoading && (
                    <div className="mt-5 flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-[15px] font-bold text-[#E5E4E2]/70 tabular-nums">
                                {filteredRituals.length}
                            </div>
                            <div className="text-[9px] uppercase tracking-[0.18em] text-[#E5E4E2]/25 mt-0.5">
                                {text.arena.all}
                            </div>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="text-center">
                            <div className="text-[15px] font-bold text-[#E5E4E2]/70 tabular-nums">
                                {hotStreakAuthors.size}
                            </div>
                            <div className="text-[9px] uppercase tracking-[0.18em] text-[#E5E4E2]/25 mt-0.5">
                                {text.arena.hotStreakBadge}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Self handle + find my posts */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#E5E4E2]/40 break-all">
                    {format(text.arena.selfHandleLabel, { handle: selfHandle })}
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setQuery(user?.name || selfHandle);
                        setSortMode('latest');
                    }}
                    className="text-[10px] uppercase tracking-[0.16em] text-[#E5E4E2]/30 hover:text-sage transition-colors self-start sm:self-auto"
                >
                    {text.arena.findMyComments}
                </button>
            </div>

            {/* Sticky filter + search bar */}
            <div className="sticky top-14 sm:top-20 z-30 mb-5 -mx-4 sm:mx-0 px-4 sm:px-0">
                <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d]/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all duration-200 ${
                                filter === 'all'
                                    ? 'bg-sage/20 text-sage font-bold shadow-[0_0_12px_rgba(138,154,91,0.2)]'
                                    : 'text-[#E5E4E2]/40 hover:text-[#E5E4E2]/70'
                            }`}
                        >
                            {text.arena.all}
                        </button>
                        <button
                            onClick={() => setFilter('today')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all duration-200 ${
                                filter === 'today'
                                    ? 'bg-sage/20 text-sage font-bold shadow-[0_0_12px_rgba(138,154,91,0.2)]'
                                    : 'text-[#E5E4E2]/40 hover:text-[#E5E4E2]/70'
                            }`}
                        >
                            {text.arena.today}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                        {/* Search */}
                        <div className="relative flex-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E5E4E2]/30">
                                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={text.arena.searchPlaceholder}
                                className="w-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-[#E5E4E2]/80 placeholder-[#E5E4E2]/20 pl-8 pr-4 py-2 rounded-xl outline-none focus:border-sage/30 focus:ring-1 focus:ring-sage/15 transition-all"
                            />
                        </div>

                        {/* Sort */}
                        <select
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value as 'latest' | 'echoes')}
                            className="bg-white/[0.04] border border-white/[0.06] text-[10px] text-[#E5E4E2]/60 px-3 py-2 rounded-xl outline-none focus:border-sage/30 transition-all cursor-pointer appearance-none shrink-0"
                        >
                            <option value="latest">{text.arena.sortLatest}</option>
                            <option value="echoes">{text.arena.sortMostLiked}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Feed */}
            <div className="flex flex-col gap-0">
                {feedError && (
                    <div className="mb-4 py-3 px-4 text-[10px] text-red-300/80 uppercase tracking-[0.14em] border border-red-400/20 rounded-2xl bg-red-500/5 text-center">
                        {feedError}
                    </div>
                )}

                {isRemoteLoading && canUseRemoteFeed ? (
                    <div className="flex flex-col gap-3 mt-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f]/80 p-5 animate-pulse">
                                <div className="flex gap-4">
                                    <div className="w-11 h-[62px] rounded-lg bg-white/[0.04] shrink-0" />
                                    <div className="grow space-y-2.5 pt-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-28 h-3 bg-white/[0.06] rounded-full" />
                                            <div className="w-8 h-3 bg-white/[0.04] rounded-full" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-14 h-4 bg-white/[0.04] rounded-full" />
                                            <div className="w-20 h-3 bg-white/[0.03] rounded-full" />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2 pl-[60px]">
                                    <div className="w-full h-2.5 bg-white/[0.04] rounded-full" />
                                    <div className="w-11/12 h-2.5 bg-white/[0.04] rounded-full" />
                                    <div className="w-3/4 h-2.5 bg-white/[0.03] rounded-full" />
                                </div>
                                <div className="mt-4 pt-3 border-t border-white/[0.03] pl-[60px] flex gap-5">
                                    <div className="w-16 h-2.5 bg-white/[0.04] rounded-full" />
                                    <div className="w-12 h-2.5 bg-white/[0.04] rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredRituals.length > 0 ? (
                    filteredRituals.map((ritual) => (
                        <RitualCard
                            key={ritual.id}
                            ritual={ritual}
                            isHotStreak={hotStreakAuthors.has((ritual.author || '').trim().toLowerCase())}
                            onDelete={ritual.isCustom ? () => handleDelete(ritual.id) : undefined}
                            onOpenAuthorProfile={handleOpenAuthorProfile}
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
                    <div className="flex flex-col items-center py-16 gap-3">
                        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#E5E4E2]/20">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        </div>
                        <span className="text-[10px] text-[#E5E4E2]/25 uppercase tracking-[0.2em]">
                            {text.arena.empty}
                        </span>
                    </div>
                )}
            </div>

            {/* End of feed */}
            <div className="mt-12 flex flex-col items-center gap-3">
                <div className="w-px h-8 bg-gradient-to-b from-white/10 to-transparent" />
                <span className="text-[9px] tracking-[0.3em] text-[#E5E4E2]/15 uppercase">
                    {text.arena.end}
                </span>
            </div>
        </section>
    );
};
