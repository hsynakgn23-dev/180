import React, { useEffect, useMemo, useState } from 'react';
import { InfoFooter } from '../../components/InfoFooter';
import { LEAGUES_DATA, LEAGUE_NAMES, useXP } from '../../context/XPContext';
import { useLanguage } from '../../context/LanguageContext';
import { TMDB_SEEDS } from '../../data/tmdbSeeds';
import { resolvePosterCandidates } from '../../lib/posterCandidates';
import { isSupabaseLive, supabase } from '../../lib/supabase';

export interface PublicProfileTarget {
    userId?: string | null;
    username?: string | null;
}

interface PublicProfileViewProps {
    target: PublicProfileTarget;
    onClose: () => void;
    onHome?: () => void;
}

type RitualRow = {
    id: string;
    user_id: string | null;
    author: string | null;
    movie_title: string | null;
    poster_path: string | null;
    text: string | null;
    timestamp: string | null;
    league: string | null;
    year: string | null;
};

type PublicRitual = {
    id: string;
    movieId: number;
    movieTitle: string;
    posterPath?: string;
    text: string;
    timestamp: string;
    createdAt: number;
    league: string;
};

type FollowCountState = {
    followers: number;
    following: number;
};

type PublicProfileData = {
    userId?: string | null;
    displayName: string;
    username: string;
    fullName: string;
    gender: string;
    birthDate: string;
    bio: string;
    avatarId: string;
    avatarUrl?: string;
    xp: number;
    league: string;
    streak: number;
    daysPresent: number;
    rituals: PublicRitual[];
    followCounts: FollowCountState;
};

const LEVEL_THRESHOLD = 500;

const MOVIE_ID_BY_TITLE = new Map(
    TMDB_SEEDS.map((movie) => [movie.title.trim().toLowerCase(), movie.id] as const)
);

const normalizeHandle = (value: string | null | undefined): string => (value || '').trim().toLowerCase();

const getMovieIdByTitle = (title: string): number => MOVIE_ID_BY_TITLE.get(title.trim().toLowerCase()) || 0;

const toRelativeTimestamp = (rawTimestamp: string): string => {
    const parsed = Date.parse(rawTimestamp);
    if (Number.isNaN(parsed)) return rawTimestamp;
    const diffMs = Date.now() - parsed;
    if (diffMs < 0) return 'Today';

    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const diffHours = Math.floor(diffMs / hourMs);
    if (diffHours < 1) return 'Just Now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffMs / dayMs)}d ago`;
};

const toDateKey = (rawTimestamp: string | null | undefined): string | null => {
    if (!rawTimestamp) return null;
    const parsed = new Date(rawTimestamp);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDayIndex = (dateKey: string): number | null => {
    const [year, month, day] = dateKey.split('-').map((value) => Number(value));
    if ([year, month, day].some((value) => Number.isNaN(value))) return null;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
};

const computeStreak = (dateKeys: string[]): number => {
    if (dateKeys.length === 0) return 0;
    const sortedUnique = Array.from(new Set(dateKeys)).sort((a, b) => b.localeCompare(a));
    const first = parseDayIndex(sortedUnique[0]);
    if (first === null) return 0;
    let streak = 1;
    let prev = first;
    for (let i = 1; i < sortedUnique.length; i += 1) {
        const current = parseDayIndex(sortedUnique[i]);
        if (current === null) continue;
        if (prev - current === 1) {
            streak += 1;
            prev = current;
            continue;
        }
        break;
    }
    return streak;
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

const CommentFilmPoster: React.FC<{ movieId: number; posterPath?: string; title: string; className?: string }> = ({ movieId, posterPath, title, className }) => {
    const [candidateIndex, setCandidateIndex] = useState(0);
    const candidates = useMemo(
        () => resolvePosterCandidates(movieId, posterPath, 'w200'),
        [movieId, posterPath]
    );

    useEffect(() => {
        setCandidateIndex(0);
    }, [movieId, posterPath]);

    const currentSrc = candidates[candidateIndex] ?? null;

    if (!currentSrc) {
        return (
            <div className={`w-16 h-24 bg-white/5 border border-white/10 rounded-md flex items-center justify-center text-[9px] uppercase tracking-[0.18em] text-sage/60 ${className || ''}`}>
                {title.slice(0, 2)}
            </div>
        );
    }

    return (
        <img
            src={currentSrc}
            alt={title}
            referrerPolicy="origin"
            className={`w-16 h-24 object-cover rounded-md border border-white/10 bg-[#0f0f0f] ${className || ''}`}
            onError={() => {
                const next = candidateIndex + 1;
                if (next < candidates.length) {
                    setCandidateIndex(next);
                }
            }}
        />
    );
};

const RITUAL_SELECT_VARIANTS = [
    { select: 'id, user_id, author, movie_title, poster_path, text, timestamp, league, year', orderBy: 'timestamp' },
    { select: 'id, user_id, author, movie_title, poster_path, text, created_at, league, year', orderBy: 'created_at' },
    { select: 'id, user_id, author, movie_title, text, timestamp, league', orderBy: 'timestamp' },
    { select: 'id, user_id, author, movie_title, text, created_at, league', orderBy: 'created_at' }
] as const;

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({ target, onClose, onHome }) => {
    const { text } = useLanguage();
    const { user, isFollowingUser, toggleFollowUser } = useXP();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<PublicProfileData | null>(null);
    const [isFollowBusy, setIsFollowBusy] = useState(false);

    useEffect(() => {
        let active = true;

        const fetchProfile = async () => {
            if (!isSupabaseLive() || !supabase) {
                if (!active) return;
                setError('Public profile requires Supabase.');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            const normalizedUsername = (target.username || '').trim();
            let ritualRows: RitualRow[] = [];
            let lastError: { code?: string | null; message?: string | null } | null = null;

            for (const variant of RITUAL_SELECT_VARIANTS) {
                let query = supabase
                    .from('rituals')
                    .select(variant.select)
                    .order(variant.orderBy, { ascending: false })
                    .limit(300);

                if (target.userId) {
                    query = query.eq('user_id', target.userId);
                } else if (normalizedUsername) {
                    query = query.ilike('author', normalizedUsername);
                }

                const { data, error: ritualsError } = await query;
                if (ritualsError) {
                    lastError = ritualsError;
                    if (isSupabaseCapabilityError(ritualsError)) continue;
                    break;
                }

                const typedRows = Array.isArray(data)
                    ? (data as unknown as Array<Record<string, unknown>>)
                    : [];
                ritualRows = typedRows
                    .map((row) => ({
                        id: typeof row.id === 'string' ? row.id : '',
                        user_id: typeof row.user_id === 'string' ? row.user_id : null,
                        author: typeof row.author === 'string' ? row.author : null,
                        movie_title: typeof row.movie_title === 'string' ? row.movie_title : null,
                        poster_path: typeof row.poster_path === 'string' ? row.poster_path : null,
                        text: typeof row.text === 'string' ? row.text : null,
                        timestamp: typeof row.timestamp === 'string'
                            ? row.timestamp
                            : typeof row.created_at === 'string'
                                ? row.created_at
                                : null,
                        league: typeof row.league === 'string' ? row.league : null,
                        year: typeof row.year === 'string' ? row.year : null
                    }))
                    .filter((row) => row.id && row.movie_title && row.text);
                lastError = null;
                break;
            }

            if (lastError && ritualRows.length === 0) {
                if (!active) return;
                setError('Profile data could not be loaded.');
                setIsLoading(false);
                return;
            }

            const resolvedUserId = target.userId || ritualRows.find((row) => row.user_id)?.user_id || null;
            const displayName = ritualRows[0]?.author || normalizedUsername || 'Observer';
            const rituals: PublicRitual[] = ritualRows.map((row) => {
                const rawTimestamp = row.timestamp || new Date().toISOString();
                return {
                    id: row.id,
                    movieId: getMovieIdByTitle(row.movie_title || ''),
                    movieTitle: row.movie_title || 'Unknown Title',
                    posterPath: row.poster_path || undefined,
                    text: row.text || '',
                    timestamp: toRelativeTimestamp(rawTimestamp),
                    createdAt: Date.parse(rawTimestamp),
                    league: row.league || 'Bronze'
                };
            });

            let fullName = '';
            let username = normalizedUsername || displayName;
            let gender = '';
            let birthDate = '';
            let bio = 'A silent observer.';
            let avatarId = 'geo_1';
            let avatarUrl: string | undefined;
            let xp = 0;
            let streak = 0;
            let daysPresent = Array.from(new Set(ritualRows.map((row) => toDateKey(row.timestamp)).filter(Boolean))).length;
            let league = rituals[0]?.league || 'Bronze';
            let followingCount = 0;
            let followersCount = 0;

            if (resolvedUserId) {
                const { data: profileRow, error: profileError } = await supabase
                    .from('profiles')
                    .select('display_name, xp_state')
                    .eq('user_id', resolvedUserId)
                    .maybeSingle();

                if (!profileError && profileRow?.xp_state && typeof profileRow.xp_state === 'object') {
                    const xpState = profileRow.xp_state as Record<string, unknown>;
                    fullName = typeof xpState.fullName === 'string' ? xpState.fullName : '';
                    username = typeof xpState.username === 'string' && xpState.username.trim()
                        ? xpState.username
                        : username;
                    gender = typeof xpState.gender === 'string' ? xpState.gender : '';
                    birthDate = typeof xpState.birthDate === 'string' ? xpState.birthDate : '';
                    bio = typeof xpState.bio === 'string' && xpState.bio.trim() ? xpState.bio : bio;
                    avatarId = typeof xpState.avatarId === 'string' ? xpState.avatarId : avatarId;
                    avatarUrl = typeof xpState.avatarUrl === 'string' ? xpState.avatarUrl : undefined;
                    xp = typeof xpState.totalXP === 'number' ? xpState.totalXP : 0;
                    streak = typeof xpState.streak === 'number' ? xpState.streak : 0;
                    daysPresent = Array.isArray(xpState.activeDays) ? xpState.activeDays.length : daysPresent;
                    followingCount = Array.isArray(xpState.following) ? xpState.following.length : 0;
                    if (typeof profileRow.display_name === 'string' && profileRow.display_name.trim()) {
                        username = username || profileRow.display_name;
                    }
                } else if (profileError && !isSupabaseCapabilityError(profileError)) {
                    console.error('[PublicProfile] failed to read profile row', profileError);
                }

                const [followingCountRes, followersCountRes] = await Promise.all([
                    supabase
                        .from('user_follows')
                        .select('*', { head: true, count: 'exact' })
                        .eq('follower_user_id', resolvedUserId),
                    supabase
                        .from('user_follows')
                        .select('*', { head: true, count: 'exact' })
                        .eq('followed_user_id', resolvedUserId)
                ]);

                if (!followingCountRes.error && typeof followingCountRes.count === 'number') {
                    followingCount = followingCountRes.count;
                }
                if (!followersCountRes.error && typeof followersCountRes.count === 'number') {
                    followersCount = followersCountRes.count;
                }
            }

            if (streak === 0) {
                const dateKeys = ritualRows
                    .map((row) => toDateKey(row.timestamp))
                    .filter((value): value is string => Boolean(value));
                streak = computeStreak(dateKeys);
            }

            if (xp > 0) {
                const leagueIndex = Math.min(Math.floor(xp / LEVEL_THRESHOLD), LEAGUE_NAMES.length - 1);
                league = LEAGUE_NAMES[leagueIndex] || league;
            }

            const resolvedProfile: PublicProfileData = {
                userId: resolvedUserId,
                displayName,
                username,
                fullName,
                gender,
                birthDate,
                bio,
                avatarId,
                avatarUrl,
                xp,
                league,
                streak,
                daysPresent,
                rituals,
                followCounts: {
                    followers: followersCount,
                    following: followingCount
                }
            };

            if (!active) return;
            setProfile(resolvedProfile);
            setIsLoading(false);
        };

        void fetchProfile();
        return () => {
            active = false;
        };
    }, [target.userId, target.username]);

    const isOwnProfile = useMemo(() => {
        if (!profile || !user) return false;
        if (profile.userId && user.id && profile.userId === user.id) return true;
        return normalizeHandle(profile.displayName) === normalizeHandle(user.name);
    }, [profile, user]);

    const isFollowing = useMemo(() => {
        if (!profile) return false;
        return isFollowingUser(profile.userId, profile.username || profile.displayName);
    }, [isFollowingUser, profile]);

    const commentsCount = profile?.rituals.length || 0;
    const uniqueFilmsCount = useMemo(() => {
        if (!profile) return 0;
        return new Set(profile.rituals.map((ritual) => ritual.movieTitle.toLowerCase().trim())).size;
    }, [profile]);

    const mostCommentedMovie = useMemo(() => {
        if (!profile) return null;
        const counter = new Map<string, number>();
        for (const ritual of profile.rituals) {
            const key = ritual.movieTitle.trim();
            counter.set(key, (counter.get(key) || 0) + 1);
        }
        let best: { title: string; count: number } | null = null;
        for (const [title, count] of counter.entries()) {
            if (!best || count > best.count) {
                best = { title, count };
            }
        }
        return best;
    }, [profile]);

    const leagueInfo = profile ? LEAGUES_DATA[profile.league] : null;
    const leagueIndex = profile ? LEAGUE_NAMES.indexOf(profile.league) : 0;
    const currentLevelStart = Math.max(0, leagueIndex) * LEVEL_THRESHOLD;
    const progressPercentage = profile
        ? Math.min(100, Math.max(0, ((profile.xp - currentLevelStart) / LEVEL_THRESHOLD) * 100))
        : 0;
    const nextLevelXP = currentLevelStart + LEVEL_THRESHOLD;

    const handleFollowToggle = async () => {
        if (!profile || isOwnProfile || isFollowBusy) return;
        setIsFollowBusy(true);
        const wasFollowing = isFollowing;
        const result = await toggleFollowUser({
            userId: profile.userId ?? null,
            username: profile.username || profile.displayName
        });

        if (result.ok) {
            setProfile((prev) => {
                if (!prev) return prev;
                const delta = wasFollowing ? -1 : 1;
                return {
                    ...prev,
                    followCounts: {
                        ...prev.followCounts,
                        followers: Math.max(0, prev.followCounts.followers + delta)
                    }
                };
            });
        }
        setIsFollowBusy(false);
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[#E5E4E2] flex flex-col">
            <div className="px-4 sm:px-6 md:px-12 pt-8 pb-6">
                <header className="flex flex-wrap items-start justify-between gap-3 mb-8 border-b border-white/5 pb-4">
                    <button
                        type="button"
                        onClick={() => (onHome ? onHome() : onClose())}
                        className="inline-flex flex-col items-start"
                        aria-label={text.profile.backHome}
                        title={text.profile.backHome}
                    >
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-sage mb-2 drop-shadow-sm">180</h1>
                        <p className="text-clay font-medium tracking-[0.2em] text-xs md:text-sm uppercase">{text.app.brandSubtitle}</p>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[10px] uppercase tracking-[0.16em] text-gray-400 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                </header>

                {isLoading ? (
                    <div className="text-center py-20 text-[11px] uppercase tracking-[0.2em] text-gray-500 border border-white/10 rounded-xl">
                        Loading profile...
                    </div>
                ) : error || !profile ? (
                    <div className="text-center py-20 text-[11px] uppercase tracking-[0.2em] text-red-300 border border-red-300/30 rounded-xl">
                        {error || 'Profile could not be loaded.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
                        <div className="space-y-6">
                            <div className="bg-white/5 border border-white/5 rounded-xl p-4 sm:p-6 animate-slide-up">
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border border-gray-200/10 flex items-center justify-center bg-white/5 shadow-sm mb-4 overflow-hidden">
                                        {profile.avatarUrl ? (
                                            <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl text-sage/50 font-serif italic ${profile.avatarId === 'geo_1' ? 'bg-sage/10' : profile.avatarId === 'geo_2' ? 'bg-clay/10' : 'bg-gray-50/5'}`}>
                                                {profile.avatarId === 'geo_1' ? 'I' : profile.avatarId === 'geo_2' ? 'II' : profile.avatarId === 'geo_3' ? 'III' : 'IV'}
                                            </div>
                                        )}
                                    </div>

                                    <h2 className="text-lg sm:text-xl tracking-[0.14em] sm:tracking-widest font-bold text-[#E5E4E2]/90 mb-2 text-center break-words max-w-full">
                                        {(profile.displayName || profile.username).toUpperCase()}
                                    </h2>
                                    <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-1 text-center break-all max-w-full px-2">
                                        @{profile.username || profile.displayName}
                                    </p>
                                    <p className="text-[10px] text-gray-500 mb-4 text-center break-words">
                                        {(profile.fullName || text.profile.missingName)} | {(profile.gender || text.profile.missingGender)} | {(profile.birthDate || text.profile.missingBirthDate)}
                                    </p>

                                    {!isOwnProfile && (
                                        <button
                                            type="button"
                                            onClick={() => void handleFollowToggle()}
                                            disabled={isFollowBusy}
                                            className={`mb-4 px-4 py-2 rounded border text-[10px] uppercase tracking-[0.16em] transition-colors ${isFollowing
                                                ? 'border-sage/50 text-sage bg-sage/10 hover:bg-sage/15'
                                                : 'border-white/15 text-white/80 hover:border-sage/40 hover:text-sage'
                                                } disabled:opacity-60`}
                                        >
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </button>
                                    )}

                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-4 text-[9px] uppercase tracking-[0.14em]">
                                        <span className="text-[#E5E4E2]/80">Following: {profile.followCounts.following}</span>
                                        <span className="text-[#E5E4E2]/80">Followers: {profile.followCounts.followers}</span>
                                    </div>

                                    <p className="text-xs font-serif italic text-sage/60 text-center max-w-xs leading-relaxed">
                                        "{profile.bio}"
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-xl p-4 sm:p-6 animate-fade-in">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase mb-4">{text.profile.stats}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-2xl sm:text-3xl font-bold text-sage">{profile.streak || 0}</span>
                                        <span className="text-[9px] tracking-wider text-gray-500 uppercase">{text.profileWidget.streak}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-2xl sm:text-3xl font-bold text-sage">{profile.daysPresent}</span>
                                        <span className="text-[9px] tracking-wider text-gray-500 uppercase">{text.profile.days}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-2xl sm:text-3xl font-bold text-sage">{commentsCount}</span>
                                        <span className="text-[9px] tracking-wider text-gray-500 uppercase">{text.profile.comments}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-2xl sm:text-3xl font-bold text-sage">{profile.followCounts.following}</span>
                                        <span className="text-[9px] tracking-wider text-gray-500 uppercase">Following</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-2xl sm:text-3xl font-bold text-sage">{profile.followCounts.followers}</span>
                                        <span className="text-[9px] tracking-wider text-gray-500 uppercase">Followers</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white/5 border border-white/5 rounded-xl p-4 sm:p-6 animate-fade-in">
                                <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                    <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">{text.profile.activity}</h3>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">{text.profile.profileFeed}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">{text.profile.comments}</div>
                                        <div className="text-2xl font-bold text-sage">{commentsCount}</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">{text.profile.films}</div>
                                        <div className="text-2xl font-bold text-sage">{uniqueFilmsCount}</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">League</div>
                                        <div className="text-sm font-bold text-[#E5E4E2] uppercase">
                                            {leagueInfo?.name || profile.league}
                                        </div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">{text.profile.mostCommented}</div>
                                        <div className="text-sm font-bold text-[#E5E4E2] line-clamp-1">
                                            {mostCommentedMovie?.title || text.profile.noRecords}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-gray-400">
                                        <span>XP: {Math.floor(profile.xp)}</span>
                                        <span>Next: {Math.max(nextLevelXP, profile.xp)}</span>
                                    </div>
                                    <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-sage transition-all duration-700" style={{ width: `${progressPercentage}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-xl p-4 sm:p-6 animate-fade-in">
                                <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                    <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">{text.profile.filmArchive}</h3>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">
                                        {commentsCount} {text.profile.comments}
                                    </span>
                                </div>

                                {profile.rituals.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {profile.rituals.slice(0, 20).map((ritual) => (
                                            <article
                                                key={ritual.id}
                                                className="group relative rounded-lg overflow-hidden border border-white/10 hover:border-sage/40 transition-all"
                                            >
                                                <CommentFilmPoster
                                                    movieId={ritual.movieId}
                                                    posterPath={ritual.posterPath}
                                                    title={ritual.movieTitle}
                                                    className="w-full h-36 sm:h-40 md:h-44 rounded-none border-0"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-left">
                                                    <p className="text-[9px] font-bold tracking-wide uppercase text-white/90 line-clamp-2">
                                                        {ritual.movieTitle}
                                                    </p>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-[10px] text-gray-600 font-serif italic border border-dashed border-gray-800 rounded">
                                        {text.profile.noFilmComments}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-xl p-4 sm:p-6 animate-fade-in">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase mb-4">{text.profile.commentsAndReplies}</h3>
                                <div className="space-y-3 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                                    {profile.rituals.length > 0 ? (
                                        profile.rituals.slice(0, 40).map((ritual) => (
                                            <article key={`ritual-${ritual.id}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                    <p className="text-[10px] uppercase tracking-[0.12em] text-sage/85 break-words">{ritual.movieTitle}</p>
                                                    <p className="text-[9px] text-gray-500">{ritual.timestamp}</p>
                                                </div>
                                                <p className="text-[11px] sm:text-xs font-serif italic text-[#E5E4E2]/90 leading-relaxed">
                                                    "{ritual.text}"
                                                </p>
                                            </article>
                                        ))
                                    ) : (
                                        <p className="text-[10px] italic text-gray-500">{text.profile.noFilmComments}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <InfoFooter
                className="w-full mt-auto"
                panelWrapperClassName="px-4 sm:px-6 md:px-12 pb-4"
                footerClassName="py-8 px-4 sm:px-6 md:px-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20"
            />
        </div>
    );
};
