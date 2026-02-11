import React, { useEffect, useMemo, useState } from 'react';
import { useXP, LEAGUES_DATA, LEAGUE_NAMES } from '../../context/XPContext';
import { MAJOR_MARKS } from '../../data/marksData';
import { SettingsModal } from './SettingsModal';
import { resolvePosterCandidates } from '../../lib/posterCandidates';
import { PROGRESS_EASING, getProgressFill, getProgressTransitionMs } from '../../lib/progressVisuals';
import { GearIcon } from '../../components/icons/GearIcon';
import { MarkBadge } from '../marks/MarkBadge';
import { supabase, isSupabaseLive } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { getRegistrationGenderLabel } from '../../i18n/localization';
import { InfoFooter } from '../../components/InfoFooter';

interface ProfileViewProps {
    onClose: () => void;
    onHome?: () => void;
    startInSettings?: boolean;
}

type FilmCommentSummary = {
    movieId: number;
    title: string;
    count: number;
    lastDate: string;
    lastText: string;
    genre?: string;
    posterPath?: string;
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

type FilmCommentEntry = {
    id: string;
    date: string;
    text: string;
    genre?: string;
    movieTitle: string;
    posterPath?: string;
};

type RitualRow = {
    id: string | null;
    movie_title: string | null;
    text: string | null;
    timestamp: string | null;
};

type ReplyRow = {
    id: string;
    ritual_id: string;
    author: string | null;
    text: string | null;
    created_at: string | null;
};

type FilmReplyEntry = {
    id: string;
    author: string;
    text: string;
    timestamp: string;
};

type SharePlatform = 'instagram' | 'tiktok' | 'x';
type ShareGoal = 'comment' | 'streak';

const buildCommentKey = (movieTitle: string, text: string, date: string): string => {
    return `${movieTitle.trim()}::${text.trim()}::${date.trim()}`;
};

const getTodayDateKey = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

    const diffMs = Date.now() - parsed;
    if (diffMs < 0) return labels.timeToday;

    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const diffHours = Math.floor(diffMs / hourMs);
    if (diffHours < 1) return labels.timeJustNow;
    if (diffHours < 24) {
        return labels.timeHoursAgo.replace('{count}', String(diffHours));
    }
    return labels.timeDaysAgo.replace('{count}', String(Math.floor(diffMs / dayMs)));
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

export const ProfileView: React.FC<ProfileViewProps> = ({ onClose, onHome, startInSettings = false }) => {
    const { text, format, markCopy, markCategory, leagueCopy, language } = useLanguage();
    const {
        xp,
        league,
        progressPercentage,
        marks,
        daysPresent,
        streak,
        following,
        featuredMarks,
        toggleFeaturedMark,
        dailyRituals,
        nextLevelXP,
        fullName,
        username,
        gender,
        birthDate,
        bio,
        avatarId,
        updateIdentity,
        awardShareXP,
        deleteRitual,
        user,
        logout,
        updateAvatar,
        avatarUrl
    } = useXP();
    const [isVisible, setIsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [tempBio, setTempBio] = useState(bio);
    const [tempAvatar, setTempAvatar] = useState(avatarId);
    const [showSettings, setShowSettings] = useState(false);
    const [shareStatus, setShareStatus] = useState<string | null>(null);
    const [shareGoal, setShareGoal] = useState<ShareGoal>('comment');
    const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
    const [repliesByCommentKey, setRepliesByCommentKey] = useState<Record<string, FilmReplyEntry[]>>({});
    const [isRepliesLoading, setIsRepliesLoading] = useState(false);
    const [followCounts, setFollowCounts] = useState<{ followers: number; following: number }>({
        followers: 0,
        following: Array.isArray(following) ? following.length : 0
    });
    const progressFill = getProgressFill(progressPercentage);
    const progressTransitionMs = getProgressTransitionMs(progressPercentage);
    const currentLeagueLabel = leagueCopy(league)?.name || league;
    const nextLeagueKey = LEAGUE_NAMES[LEAGUE_NAMES.indexOf(league) + 1];
    const nextLeagueLabel = nextLeagueKey
        ? leagueCopy(nextLeagueKey)?.name || LEAGUES_DATA[nextLeagueKey]?.name || 'Max'
        : 'Max';
    const genderLabel = gender ? getRegistrationGenderLabel(language, gender) : '';

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleDeleteRitual = (ritualId: string) => {
        deleteRitual(String(ritualId));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    updateAvatar(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // Calculate DNA (Genre Stats)
    const genreCounts: Record<string, number> = {};
    let totalGenres = 0;
    dailyRituals.forEach(r => {
        if (r.genre) {
            genreCounts[r.genre] = (genreCounts[r.genre] || 0) + 1;
            totalGenres++;
        }
    });

    // Sort by count and take top 3
    const topGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    const commentedFilms = useMemo<FilmCommentSummary[]>(() => {
        const filmMap = new Map<number, FilmCommentSummary>();
        for (const ritual of dailyRituals) {
            const existing = filmMap.get(ritual.movieId);
            if (!existing) {
                filmMap.set(ritual.movieId, {
                    movieId: ritual.movieId,
                    title: ritual.movieTitle || `Film #${ritual.movieId}`,
                    count: 1,
                    lastDate: ritual.date,
                    lastText: ritual.text,
                    genre: ritual.genre,
                    posterPath: ritual.posterPath
                });
                continue;
            }
            existing.count += 1;
            if (ritual.date >= existing.lastDate) {
                existing.lastDate = ritual.date;
                existing.lastText = ritual.text;
                existing.genre = ritual.genre || existing.genre;
                existing.posterPath = ritual.posterPath || existing.posterPath;
                existing.title = ritual.movieTitle || existing.title;
            }
        }

        return Array.from(filmMap.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.lastDate.localeCompare(a.lastDate);
        });
    }, [dailyRituals]);

    const mostWrittenFilm = commentedFilms[0];
    const todayDateKey = getTodayDateKey();
    const latestRitual = dailyRituals[0];
    const latestTodayRitual = useMemo(
        () => dailyRituals.find((ritual) => ritual.date === todayDateKey) || null,
        [dailyRituals, todayDateKey]
    );
    const activeRitualForShare = latestTodayRitual || latestRitual;
    const hasCommentToday = Boolean(latestTodayRitual);
    const isStreakCompletedToday = hasCommentToday && (streak || 0) > 0;
    const shareGoalReady = shareGoal === 'comment' ? hasCommentToday : isStreakCompletedToday;
    const streakSharePreview = language === 'tr'
        ? `Bugunku streak tamamlandi: ${streak || 0} gun`
        : language === 'es'
            ? `Racha completada hoy: ${streak || 0} dias`
            : language === 'fr'
                ? `Serie terminee aujourd'hui : ${streak || 0} jours`
                : `Today's streak is complete: ${streak || 0} days`;
    const latestCommentPreview = useMemo(() => {
        const raw = activeRitualForShare?.text?.trim() || '';
        if (!raw) {
            return language === 'tr'
                ? 'Bugun yorum yazip paylasarak bonus XP kazan.'
                : language === 'es'
                    ? 'Escribe un comentario hoy y compartelo para ganar XP extra.'
                    : language === 'fr'
                        ? 'Ecris un commentaire aujourd\'hui et partage-le pour gagner du XP bonus.'
                        : 'Post a comment today and share it to earn bonus XP.';
        }
        if (raw.length <= 120) return raw;
        return `${raw.slice(0, 120).trimEnd()}...`;
    }, [activeRitualForShare?.text, language]);

    const shareCopy = useMemo(() => {
        if (language === 'tr') {
            return {
                title: 'Paylasim Bonusu',
                subtitle: 'Minimal yorumunu veya bugunku streakini paylas, bonus XP kazan.',
                commentMode: 'Yorum Paylas',
                streakMode: 'Streak Paylas',
                commentHint: 'Bugun yazdigin yorumu paylasirsan bonus XP alirsin.',
                streakHint: 'Bugunku seriyi tamamlayip paylasirsan bonus XP alirsin.',
                shareInstagram: 'Instagram',
                shareTiktok: 'TikTok',
                shareX: 'X',
                rewardHint: 'Gunluk ilk uygun paylasim +18 XP',
                commentLocked: 'Yorum paylasimi icin once bugun yorum yaz.',
                streakLocked: 'Streak paylasimi icin once bugunku rituelini tamamla.',
                failedHint: 'Paylasim hazirlanamadi. Tekrar dene.',
                claimedHint: 'Bugun paylasim bonusu zaten alindi.'
            };
        }
        if (language === 'es') {
            return {
                title: 'Bonus por Compartir',
                subtitle: 'Comparte tu comentario minimal o la racha de hoy y gana XP extra.',
                commentMode: 'Compartir Comentario',
                streakMode: 'Compartir Racha',
                commentHint: 'Comparte el comentario de hoy para ganar XP extra.',
                streakHint: 'Completa la racha de hoy y compartela para ganar XP extra.',
                shareInstagram: 'Instagram',
                shareTiktok: 'TikTok',
                shareX: 'X',
                rewardHint: 'Primer compartido valido del dia: +18 XP',
                commentLocked: 'Escribe un comentario hoy antes de reclamar XP por compartir.',
                streakLocked: 'Completa el ritual de hoy antes de reclamar XP por racha.',
                failedHint: 'No se pudo preparar el compartido. Intenta otra vez.',
                claimedHint: 'El bonus de compartido de hoy ya fue reclamado.'
            };
        }
        if (language === 'fr') {
            return {
                title: 'Bonus de Partage',
                subtitle: 'Partage ton commentaire minimal ou ta serie du jour et gagne du XP bonus.',
                commentMode: 'Partager Commentaire',
                streakMode: 'Partager Serie',
                commentHint: 'Partage le commentaire du jour pour gagner du XP bonus.',
                streakHint: 'Termine la serie du jour puis partage pour gagner du XP bonus.',
                shareInstagram: 'Instagram',
                shareTiktok: 'TikTok',
                shareX: 'X',
                rewardHint: 'Premier partage valide du jour : +18 XP',
                commentLocked: 'Ecris un commentaire aujourd\'hui avant le bonus de partage.',
                streakLocked: 'Termine le rituel du jour avant le bonus de serie.',
                failedHint: 'Impossible de preparer le partage. Reessaie.',
                claimedHint: 'Le bonus de partage du jour est deja pris.'
            };
        }
        return {
            title: 'Share Bonus',
            subtitle: 'Share your minimal comment or today\'s streak and earn bonus XP.',
            commentMode: 'Share Comment',
            streakMode: 'Share Streak',
            commentHint: 'Share today\'s comment to earn bonus XP.',
            streakHint: 'Complete today\'s streak, then share to earn bonus XP.',
            shareInstagram: 'Instagram',
            shareTiktok: 'TikTok',
            shareX: 'X',
            rewardHint: 'First eligible share of the day: +18 XP',
            commentLocked: 'Write a comment today before claiming comment-share XP.',
            streakLocked: 'Complete today\'s ritual before claiming streak-share XP.',
            failedHint: 'Could not prepare share. Try again.',
            claimedHint: 'Today\'s share bonus has already been claimed.'
        };
    }, [language]);

    const buildSharePayload = (platform: SharePlatform, goal: ShareGoal): string => {
        const displayName = user?.name || text.profile.curatorFallback;
        const handle = username || text.profile.observerHandle;
        const platformTag = platform === 'x' ? '#X' : platform === 'tiktok' ? '#TikTok' : '#Instagram';

        if (goal === 'streak') {
            return [
                '180 Absolute Cinema',
                `${displayName} (@${handle})`,
                streakSharePreview,
                `${currentLeagueLabel} - ${Math.floor(xp)} XP`,
                `${platformTag} #180AbsoluteCinema`
            ].join('\n');
        }

        return [
            '180 Absolute Cinema',
            `${displayName} (@${handle})`,
            `${currentLeagueLabel} - ${Math.floor(xp)} XP`,
            `"${latestCommentPreview}"`,
            `${platformTag} #180AbsoluteCinema`
        ].join('\n');
    };

    const copyToClipboard = async (value: string): Promise<boolean> => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    const handleShare = async (platform: SharePlatform, goal: ShareGoal) => {
        const isReady = goal === 'comment' ? hasCommentToday : isStreakCompletedToday;
        if (!isReady) {
            setShareStatus(goal === 'comment' ? shareCopy.commentLocked : shareCopy.streakLocked);
            return;
        }

        const payload = buildSharePayload(platform, goal);
        const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const pageUrl = `${originUrl}/`;

        try {
            if (platform === 'x') {
                const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(payload)}&url=${encodeURIComponent(pageUrl)}`;
                window.open(shareUrl, '_blank', 'noopener,noreferrer');
            } else {
                await copyToClipboard(`${payload}\n${pageUrl}`);
                const target = platform === 'instagram'
                    ? 'https://www.instagram.com/'
                    : 'https://www.tiktok.com/';
                window.open(target, '_blank', 'noopener,noreferrer');
            }

            const rewardResult = awardShareXP(platform, goal);
            if (rewardResult.ok) {
                setShareStatus(shareCopy.rewardHint);
            } else {
                setShareStatus(shareCopy.claimedHint);
            }
        } catch {
            setShareStatus(shareCopy.failedHint);
        }
    };
    const ritualEntriesByMovie = useMemo(() => {
        const byMovie = new Map<number, FilmCommentEntry[]>();
        for (const ritual of dailyRituals) {
            const entries = byMovie.get(ritual.movieId) || [];
            entries.push({
                id: String(ritual.id),
                date: ritual.date,
                text: ritual.text,
                genre: ritual.genre,
                movieTitle: ritual.movieTitle,
                posterPath: ritual.posterPath
            });
            byMovie.set(ritual.movieId, entries);
        }
        for (const [, entries] of byMovie) {
            entries.sort((a, b) => b.date.localeCompare(a.date));
        }
        return byMovie;
    }, [dailyRituals]);

    const selectedFilm = useMemo(
        () => commentedFilms.find((film) => film.movieId === selectedMovieId) || null,
        [commentedFilms, selectedMovieId]
    );

    const selectedFilmComments = useMemo(
        () => (selectedMovieId ? ritualEntriesByMovie.get(selectedMovieId) || [] : []),
        [ritualEntriesByMovie, selectedMovieId]
    );

    useEffect(() => {
        setIsVisible(true);
        setTempBio(bio);
        setTempAvatar(avatarId);
        return () => setIsVisible(false);
    }, [bio, avatarId]);

    useEffect(() => {
        if (startInSettings) {
            setShowSettings(true);
        }
    }, [startInSettings]);

    useEffect(() => {
        if (!selectedMovieId) return;
        if (!commentedFilms.some((film) => film.movieId === selectedMovieId)) {
            setSelectedMovieId(null);
        }
    }, [commentedFilms, selectedMovieId]);

    useEffect(() => {
        if (!selectedMovieId) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedMovieId(null);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedMovieId]);

    useEffect(() => {
        if (!shareStatus) return;
        const timeoutId = window.setTimeout(() => setShareStatus(null), 5000);
        return () => window.clearTimeout(timeoutId);
    }, [shareStatus]);

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        if (selectedMovieId) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = originalOverflow;
        }
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [selectedMovieId]);

    useEffect(() => {
        if (!selectedMovieId) {
            setRepliesByCommentKey({});
            setIsRepliesLoading(false);
            return;
        }

        const client = supabase;
        if (!isSupabaseLive() || !client || !user?.id || selectedFilmComments.length === 0) {
            setRepliesByCommentKey({});
            setIsRepliesLoading(false);
            return;
        }

        const commentKeySet = new Set(
            selectedFilmComments.map((entry) => buildCommentKey(entry.movieTitle, entry.text, entry.date))
        );

        const movieTitles = Array.from(
            new Set(selectedFilmComments.map((entry) => entry.movieTitle.trim()).filter(Boolean))
        );

        if (movieTitles.length === 0) {
            setRepliesByCommentKey({});
            setIsRepliesLoading(false);
            return;
        }

        let canceled = false;
        setIsRepliesLoading(true);

        const loadReplies = async () => {
            try {
                const ritualReadVariants = [
                    { select: 'id, movie_title, text, timestamp' },
                    { select: 'id, movie_title, text, timestamp:created_at' }
                ] as const;
                let ritualsData: RitualRow[] = [];
                let ritualsError: { code?: string | null; message?: string | null } | null = null;

                for (const variant of ritualReadVariants) {
                    const { data, error } = await client
                        .from('rituals')
                        .select(variant.select)
                        .eq('user_id', user.id)
                        .in('movie_title', movieTitles);

                    if (error) {
                        ritualsError = error;
                        if (isSupabaseCapabilityError(error)) {
                            continue;
                        }
                        break;
                    }

                    ritualsData = Array.isArray(data) ? (data as RitualRow[]) : [];
                    ritualsError = null;
                    break;
                }

                if (canceled) return;

                if (ritualsError) {
                    setRepliesByCommentKey({});
                    setIsRepliesLoading(false);
                    return;
                }

                const ritualIdsByCommentKey = new Map<string, string[]>();
                for (const row of ritualsData) {
                    if (!row.id || !row.movie_title || !row.text || !row.timestamp) continue;

                    const dateKey = row.timestamp.slice(0, 10);
                    const commentKey = buildCommentKey(row.movie_title, row.text, dateKey);
                    if (!commentKeySet.has(commentKey)) continue;

                    const current = ritualIdsByCommentKey.get(commentKey) || [];
                    current.push(row.id);
                    ritualIdsByCommentKey.set(commentKey, current);
                }

                const ritualIds = Array.from(
                    new Set(Array.from(ritualIdsByCommentKey.values()).flat().filter(Boolean))
                );

                if (ritualIds.length === 0) {
                    setRepliesByCommentKey({});
                    setIsRepliesLoading(false);
                    return;
                }

                const { data: repliesData, error: repliesError } = await client
                    .from('ritual_replies')
                    .select('id, ritual_id, author, text, created_at')
                    .in('ritual_id', ritualIds)
                    .order('created_at', { ascending: true });

                if (canceled) return;

                if (repliesError || !Array.isArray(repliesData)) {
                    setRepliesByCommentKey({});
                    setIsRepliesLoading(false);
                    return;
                }

                const repliesByRitual = new Map<string, FilmReplyEntry[]>();
                for (const row of repliesData as ReplyRow[]) {
                    if (!row.id || !row.ritual_id || !row.text) continue;
                    const normalized: FilmReplyEntry = {
                        id: row.id,
                        author: row.author || text.profile.observerHandle,
                        text: row.text,
                        timestamp: row.created_at
                            ? toRelativeTimestamp(row.created_at, {
                                timeToday: text.profile.timeToday,
                                timeJustNow: text.profile.timeJustNow,
                                timeHoursAgo: text.profile.timeHoursAgo,
                                timeDaysAgo: text.profile.timeDaysAgo
                            })
                            : text.profile.timeJustNow
                    };
                    const current = repliesByRitual.get(row.ritual_id) || [];
                    current.push(normalized);
                    repliesByRitual.set(row.ritual_id, current);
                }

                const next: Record<string, FilmReplyEntry[]> = {};
                for (const [commentKey, ids] of ritualIdsByCommentKey.entries()) {
                    next[commentKey] = ids.flatMap((ritualId) => repliesByRitual.get(ritualId) || []);
                }

                setRepliesByCommentKey(next);
                setIsRepliesLoading(false);
            } catch {
                if (canceled) return;
                setRepliesByCommentKey({});
                setIsRepliesLoading(false);
            }
        };

        void loadReplies();

        return () => {
            canceled = true;
        };
    }, [
        selectedMovieId,
        selectedFilmComments,
        user?.id,
        text.profile.observerHandle,
        text.profile.timeToday,
        text.profile.timeJustNow,
        text.profile.timeHoursAgo,
        text.profile.timeDaysAgo
    ]);

    useEffect(() => {
        let active = true;
        const fallbackFollowingCount = Array.isArray(following) ? following.length : 0;
        const client = supabase;

        if (!user?.id || !isSupabaseLive() || !client) {
            setFollowCounts({
                followers: 0,
                following: fallbackFollowingCount
            });
            return () => {
                active = false;
            };
        }

        const fetchFollowCounts = async () => {
            const [followingRes, followersRes] = await Promise.all([
                client
                    .from('user_follows')
                    .select('*', { head: true, count: 'exact' })
                    .eq('follower_user_id', user.id),
                client
                    .from('user_follows')
                    .select('*', { head: true, count: 'exact' })
                    .eq('followed_user_id', user.id)
            ]);

            if (!active) return;

            if (
                followingRes.error ||
                followersRes.error ||
                typeof followingRes.count !== 'number' ||
                typeof followersRes.count !== 'number'
            ) {
                setFollowCounts({
                    followers: 0,
                    following: fallbackFollowingCount
                });
                return;
            }

            setFollowCounts({
                followers: followersRes.count,
                following: followingRes.count
            });
        };

        void fetchFollowCounts();
        return () => {
            active = false;
        };
    }, [following, user?.id]);

    const handleHome = () => {
        setSelectedMovieId(null);
        setIsVisible(false);
        const next = onHome || onClose;
        setTimeout(next, 500);
    };

    const handleSaveIdentity = () => {
        updateIdentity(tempBio, tempAvatar);
        setIsEditing(false);
    };

    // Helper: Sort marks by category
    const categories = ['Presence', 'Writing', 'Rhythm', 'Discovery', 'Ritual', 'Social', 'Legacy'] as const;

    return (
        <div
            className={`fixed inset-0 z-50 bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center overflow-y-auto transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Top Right Controls */}
            <div className="absolute top-3 right-3 sm:top-8 sm:right-8 z-50 flex items-center gap-2 sm:gap-2.5">
                <button
                    onClick={handleHome}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-sage/30 hover:border-clay/60 text-clay/80 hover:text-clay transition-colors flex items-center justify-center bg-[#1A1A1A]/85"
                    aria-label={text.profile.backHome}
                    title={text.profile.backHome}
                >
                    <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
                        <path d="M3 11.5L12 4L21 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6.5 10.5V20H17.5V10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 20V14H14V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <button
                    onClick={() => setShowSettings(true)}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-sage/30 hover:border-clay/60 text-clay/80 hover:text-clay transition-colors flex items-center justify-center bg-[#1A1A1A]/85"
                    title={text.profile.openSettings}
                    aria-label={text.profile.openSettings}
                >
                    <GearIcon className="w-[18px] h-[18px]" />
                </button>
                <button
                    onClick={logout}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-red-500/35 hover:border-red-400/70 text-red-400/75 hover:text-red-300 transition-colors flex items-center justify-center bg-[#1A1A1A]/85"
                    aria-label={text.profile.logout}
                    title={text.profile.logout}
                >
                    <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
                        <path d="M10 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 16L20 12L14 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>

            {/* Content Container - Two Column Layout */}
            <div className="w-full max-w-7xl px-4 sm:px-6 md:px-12 pb-16 pt-20 sm:pt-24">
                {/* Header - 180 Absolute Cinema */}
                <header className="mb-12 text-center animate-fade-in">
                    <button
                        type="button"
                        onClick={handleHome}
                        className="inline-flex flex-col items-center"
                        aria-label={text.profile.backHome}
                        title={text.profile.backHome}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-sage mb-3 drop-shadow-sm">180</h1>
                        <p className="text-clay font-medium tracking-[0.2em] text-xs md:text-sm uppercase">{text.app.brandSubtitle}</p>
                    </button>
                </header>

                {/* Two Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 xl:gap-10">
                    {/* LEFT COLUMN - User Card, DNA, Stats */}
                    <div className="space-y-7">
                        {/* User Identity Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-slide-up">
                            <div className="flex flex-col items-center">
                                {/* Avatar with Settings Icon */}
                                <div className="relative mb-5">
                                    <div
                                        className="w-24 h-24 rounded-full border border-gray-200/10 flex items-center justify-center bg-white/5 shadow-sm relative group overflow-hidden"
                                        onClick={() => isEditing && fileInputRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                        />

                                        {isEditing && (
                                            <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[9px] uppercase tracking-widest text-white/80 font-bold">{text.profile.upload}</span>
                                            </div>
                                        )}

                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="User Avatar"
                                                className="w-full h-full object-cover transition-all duration-700 hover:scale-105"
                                            />
                                        ) : (
                                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl text-sage/50 font-serif italic ${avatarId === 'geo_1' ? 'bg-sage/10' : avatarId === 'geo_2' ? 'bg-clay/10' : 'bg-gray-50/5'}`}>
                                                {avatarId === 'geo_1' ? 'I' : avatarId === 'geo_2' ? 'II' : avatarId === 'geo_3' ? 'III' : 'IV'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Settings Icon */}
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#1A1A1A] hover:bg-clay/10 rounded-full flex items-center justify-center border border-sage/20 hover:border-clay/30 transition-all hover:scale-110"
                                        title={text.profile.openSettings}
                                    >
                                        <GearIcon className="w-4 h-4 text-clay/80" />
                                    </button>
                                </div>

                                {/* Username & Bio */}
                                <h2 className="text-lg sm:text-xl tracking-[0.14em] sm:tracking-widest font-bold leading-tight text-[#E5E4E2]/90 mb-3 text-center break-words max-w-full">
                                    {user?.name ? user.name.toUpperCase() : text.profile.curatorFallback}
                                </h2>
                                <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-2 text-center break-all max-w-full px-2">
                                    @{username || text.profile.observerHandle}
                                </p>
                                <div className="mb-5 text-[10px] text-gray-500 text-center leading-relaxed space-y-1">
                                    <p className="break-words">{fullName || text.profile.missingName}</p>
                                    <p className="break-words">
                                        {genderLabel || text.profile.missingGender} | {birthDate || text.profile.missingBirthDate}
                                    </p>
                                </div>

                                <div className="mb-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 text-[10px] uppercase tracking-[0.14em]">
                                    <span className="text-[#E5E4E2]/80">Following: {followCounts.following}</span>
                                    <span className="text-[#E5E4E2]/80">Followers: {followCounts.followers}</span>
                                </div>

                                {isEditing ? (
                                    <div className="flex flex-col items-center gap-2 w-full mb-5">
                                        <textarea
                                            value={tempBio}
                                            onChange={(e) => setTempBio(e.target.value)}
                                            maxLength={180}
                                            className="w-full bg-[#1A1A1A] border border-sage/30 p-2 text-xs text-center font-serif text-[#E5E4E2] focus:outline-none focus:border-sage rounded"
                                            rows={2}
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveIdentity} className="text-[9px] uppercase tracking-widest text-[#121212] bg-sage px-3 py-1 rounded font-bold hover:opacity-90">
                                                {text.profile.save}
                                            </button>
                                            <button onClick={() => setIsEditing(false)} className="text-[9px] uppercase tracking-widest text-gray-500 px-3 py-1 hover:text-white">
                                                {text.profile.cancel}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 mb-5 group cursor-pointer" onClick={() => setIsEditing(true)}>
                                        <p className="text-xs font-serif italic text-sage/60 text-center max-w-xs leading-relaxed">
                                            "{bio}"
                                        </p>
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] tracking-[0.2em] text-gray-600 uppercase">
                                            {text.profile.editIdentity}
                                        </span>
                                    </div>
                                )}

                                {/* League & XP */}
                                <div className="text-xs tracking-[0.2em] text-[#E5E4E2]/60 mb-5 uppercase">
                                    {currentLeagueLabel} - {Math.floor(xp)} XP
                                </div>

                                {/* XP Progress Bar */}
                                <div className="w-full">
                                    <div className="flex justify-between items-end mb-2 text-[9px]">
                                        <span className="font-bold text-sage tracking-wider uppercase">
                                            {nextLeagueLabel}
                                        </span>
                                        <span className="font-mono text-sage/60">
                                            {Math.floor(nextLevelXP - xp)} XP
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-[#1A1A1A] rounded-full overflow-hidden border border-white/5 relative">
                                        <div
                                            className="h-full relative"
                                            style={{
                                                width: `${progressPercentage}%`,
                                                background: progressFill,
                                                transitionProperty: 'width, background',
                                                transitionDuration: `${progressTransitionMs}ms`,
                                                transitionTimingFunction: PROGRESS_EASING
                                            }}
                                        >
                                            <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/50 blur-[1px] animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cinematic DNA Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase mb-4">{text.profile.genreDistribution}</h3>

                            <div className="flex justify-center items-end h-32 gap-4 bg-white/5 border border-white/5 rounded p-4 relative overflow-hidden">
                                {topGenres.length > 0 ? (
                                    topGenres.map(([genre, count]) => {
                                        const percentage = (count / totalGenres);
                                        const height = Math.max(20, percentage * 100);

                                        return (
                                            <div key={genre} className="flex flex-col items-center gap-2 z-10 flex-1 group/bar">
                                                <div className="relative w-full flex justify-center items-end h-full">
                                                    <div
                                                        className="w-2 bg-sage shadow-[0_0_10px_rgba(138,154,91,0.5)] transition-all duration-1000 ease-out relative rounded-t-sm group-hover/bar:w-3"
                                                        style={{ height: `${height}%` }}
                                                    >
                                                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/50 blur-[2px] animate-pulse"></div>
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[9px] font-bold text-[#E5E4E2] tracking-wider uppercase">
                                                        {genre}
                                                    </div>
                                                    <div className="text-[8px] font-mono text-gray-500">
                                                        {Math.round(percentage * 100)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex items-end justify-center gap-1 h-full">
                                        {[...Array(8)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-sage/20 rounded-t animate-pulse"
                                                style={{
                                                    height: `${20 + Math.random() * 60}%`,
                                                    animationDelay: `${i * 0.1}s`,
                                                    animationDuration: `${1 + Math.random()}s`
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-5 sm:p-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase mb-5">{text.profile.stats}</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 text-center">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-3xl sm:text-4xl font-bold text-sage">{streak || 0}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">{text.profileWidget.streak}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-3xl sm:text-4xl font-bold text-sage">{daysPresent}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">{text.profile.days}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-3xl sm:text-4xl font-bold text-sage">{dailyRituals.length}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">{text.profile.rituals}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-3xl sm:text-4xl font-bold text-sage">{followCounts.following}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">Following</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-3xl sm:text-4xl font-bold text-sage">{followCounts.followers}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">Followers</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Activity & Vault */}
                    <div className="space-y-7">
                        {/* Activity Pulse */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">{text.profile.activity}</h3>
                                <span className="text-[9px] tracking-wider text-gray-500 uppercase">
                                    {text.profile.profileFeed}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">{text.profile.comments}</div>
                                    <div className="text-2xl font-bold text-sage">{dailyRituals.length}</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">{text.profile.films}</div>
                                    <div className="text-2xl font-bold text-sage">{commentedFilms.length}</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">{text.profile.topGenre}</div>
                                    <div className="text-sm font-bold text-[#E5E4E2] uppercase">
                                        {topGenres[0]?.[0] || text.profile.noRecords}
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">{text.profile.mostCommented}</div>
                                    <div className="text-sm font-bold text-[#E5E4E2] line-clamp-1">
                                        {mostWrittenFilm?.title || text.profile.noRecords}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Social Share Card */}
                        <div className="relative overflow-hidden rounded-xl border border-sage/20 bg-gradient-to-br from-[#111814] via-[#161616] to-[#2a1f1a] p-6 animate-fade-in shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-sage/15 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-clay/20 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold tracking-[0.06em] uppercase text-white">{shareCopy.title}</h3>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-clay/80">{shareCopy.rewardHint}</span>
                                </div>

                                <p className="text-[11px] text-white/70 mb-4">{shareCopy.subtitle}</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setShareGoal('comment')}
                                        className={`px-3 py-2 rounded-lg border text-[10px] uppercase tracking-[0.18em] transition-colors ${
                                            shareGoal === 'comment'
                                                ? 'border-sage/60 bg-sage/10 text-sage'
                                                : 'border-white/15 bg-white/5 text-white hover:border-sage/50 hover:text-sage'
                                        }`}
                                    >
                                        {shareCopy.commentMode}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShareGoal('streak')}
                                        className={`px-3 py-2 rounded-lg border text-[10px] uppercase tracking-[0.18em] transition-colors ${
                                            shareGoal === 'streak'
                                                ? 'border-sage/60 bg-sage/10 text-sage'
                                                : 'border-white/15 bg-white/5 text-white hover:border-sage/50 hover:text-sage'
                                        }`}
                                    >
                                        {shareCopy.streakMode}
                                    </button>
                                </div>

                                <p className="text-[11px] text-white/70 mb-4">
                                    {shareGoal === 'comment' ? shareCopy.commentHint : shareCopy.streakHint}
                                </p>

                                <div className="rounded-xl border border-white/15 bg-black/30 p-4 mb-5">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">
                                        @{username || text.profile.observerHandle}
                                    </p>
                                    {shareGoal === 'comment' ? (
                                        <p className="text-sm text-white/90 leading-relaxed font-serif italic">"{latestCommentPreview}"</p>
                                    ) : (
                                        <p className="text-sm text-white/90 leading-relaxed font-serif italic">{streakSharePreview}</p>
                                    )}
                                    <p className={`mt-4 text-[10px] uppercase tracking-[0.16em] ${
                                        shareGoalReady ? 'text-sage/80' : 'text-clay/80'
                                    }`}>
                                        {shareGoalReady
                                            ? shareCopy.rewardHint
                                            : shareGoal === 'comment'
                                                ? shareCopy.commentLocked
                                                : shareCopy.streakLocked}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleShare('instagram', shareGoal)}
                                        disabled={!shareGoalReady}
                                        className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.18em] text-white hover:border-sage/50 hover:text-sage transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                                    >
                                        {shareCopy.shareInstagram}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleShare('tiktok', shareGoal)}
                                        disabled={!shareGoalReady}
                                        className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.18em] text-white hover:border-sage/50 hover:text-sage transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                                    >
                                        {shareCopy.shareTiktok}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleShare('x', shareGoal)}
                                        disabled={!shareGoalReady}
                                        className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.18em] text-white hover:border-sage/50 hover:text-sage transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                                    >
                                        {shareCopy.shareX}
                                    </button>
                                </div>

                                {shareStatus && (
                                    <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-sage/90">{shareStatus}</p>
                                )}
                            </div>
                        </div>

                        {/* Film Journal Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-4 sm:p-6 animate-fade-in">
                            <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">{text.profile.filmArchive}</h3>
                                <span className="text-[9px] tracking-wider text-gray-500">
                                    {format(text.profile.filmCount, { count: commentedFilms.length })}
                                </span>
                            </div>

                            {commentedFilms.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {commentedFilms.map((film) => {
                                            const selected = selectedMovieId === film.movieId;
                                            return (
                                                <article
                                                    key={film.movieId}
                                                    onClick={() => setSelectedMovieId(film.movieId)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedMovieId(film.movieId);
                                                        }
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`group relative rounded-lg overflow-hidden border transition-all ${selected
                                                        ? 'border-sage/70 ring-1 ring-sage/40 shadow-[0_0_24px_rgba(138,154,91,0.15)]'
                                                        : 'border-white/10 hover:border-sage/40'
                                                        }`}
                                                    title={format(text.profile.openFilmDetails, { title: film.title })}
                                                    aria-label={format(text.profile.openFilmDetails, { title: film.title })}
                                                >
                                                    <CommentFilmPoster
                                                        movieId={film.movieId}
                                                        posterPath={film.posterPath}
                                                        title={film.title}
                                                        className="w-full h-36 sm:h-40 md:h-44 rounded-none border-0"
                                                    />
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-left">
                                                        <p className="text-[9px] font-bold tracking-wide uppercase text-white/90 line-clamp-2">
                                                            {film.title}
                                                        </p>
                                                        <p className="text-[9px] font-mono text-sage/90 mt-1">{format(text.profile.commentCount, { count: film.count })}</p>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-[10px] text-gray-600 font-serif italic border border-dashed border-gray-800 rounded">
                                    {text.profile.noFilmComments} {text.profile.noFilmCommentsHint}
                                </div>
                            )}
                        </div>

                        {/* The Vault Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">{text.profile.marksArchive}</h3>
                                <span className="text-[9px] tracking-wider text-gray-500">
                                    {format(text.profile.featured, { count: featuredMarks.length })}
                                </span>
                            </div>

                            {categories.map(category => (
                                <div key={category} className="mb-8">
                                    <div className="text-[9px] tracking-[0.2em] text-gray-500 uppercase mb-3 pl-1">
                                        {markCategory(category)} {text.profile.markCategorySuffix}
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-x-2 sm:gap-x-3 gap-y-4 sm:gap-y-5">
                                        {MAJOR_MARKS.filter(m => m.category === category).map(mark => {
                                            const isUnlocked = marks.includes(mark.id);
                                            const isFeatured = featuredMarks.includes(mark.id);
                                            const isClay = ['180_exact', 'genre_discovery', 'echo_initiate'].includes(mark.id);
                                            const localizedMark = markCopy(mark.id);

                                            return (
                                                <div
                                                    key={mark.id}
                                                    className="relative group flex flex-col items-center justify-start min-h-[112px] cursor-pointer px-1"
                                                    onClick={() => {
                                                        if (isUnlocked) toggleFeaturedMark(mark.id);
                                                    }}
                                                >
                                                    <div
                                                        className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all duration-700 bg-[var(--color-bg)] z-10
                                                            ${isUnlocked
                                                                ? isFeatured
                                                                    ? 'border-sage/60 text-sage shadow-[0_0_15px_rgba(138,154,91,0.1)] scale-105'
                                                                    : isClay
                                                                        ? 'border-clay/40 text-clay/80'
                                                                        : 'border-sage/40 text-sage/80'
                                                                : 'border-sage/10 text-sage/20'
                                                            }
                                                        `}
                                                    >
                                                        <MarkBadge
                                                            mark={mark}
                                                            size={18}
                                                            alt={localizedMark.title}
                                                            imageClassName={`w-8 h-8 rounded-lg object-cover ${isUnlocked ? 'opacity-95' : 'opacity-30 grayscale'}`}
                                                        />

                                                        {isFeatured && (
                                                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-sage rounded-full animate-pulse" />
                                                        )}
                                                    </div>

                                                    <div className="mt-2 flex flex-col items-center gap-1.5 w-full">
                                                        <span className={`text-[9px] font-sans font-bold tracking-wider uppercase text-center leading-none ${isUnlocked ? 'text-[#E5E4E2]/90' : 'text-[#E5E4E2]/60'}`}>
                                                            {localizedMark.title}
                                                        </span>
                                                        <span className={`text-[9px] text-center leading-[1.25] max-w-[116px] ${isUnlocked ? 'text-[#E5E4E2]/72' : 'text-[#E5E4E2]/46'}`}>
                                                            {text.profile.requirement}: {localizedMark.description || mark.description}
                                                        </span>
                                                        <span className={`text-[8px] tracking-[0.14em] uppercase ${isUnlocked ? 'text-clay/70' : 'text-gray-600'}`}>
                                                            {isUnlocked ? text.profile.unlocked : text.profile.locked}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div>

            <InfoFooter
                className="w-full mt-auto"
                panelWrapperClassName="px-4 sm:px-6 md:px-12 pb-4"
                footerClassName="py-8 px-4 sm:px-6 md:px-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20"
            />

            {selectedMovieId && selectedFilm && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
                    <button
                        type="button"
                        onClick={() => setSelectedMovieId(null)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        aria-label={text.profile.closeMovieModal}
                    />

                    <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-xl border border-white/10 bg-[#121212] shadow-2xl flex flex-col md:flex-row">
                        <div className="md:w-[280px] lg:w-[320px] shrink-0 bg-[#1A1A1A] relative">
                            <CommentFilmPoster
                                movieId={selectedFilm.movieId}
                                posterPath={selectedFilm.posterPath}
                                title={selectedFilm.title}
                                className="w-full h-64 md:h-full rounded-none border-0"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-4">
                                <p className="text-xs tracking-[0.18em] uppercase text-sage/80">{selectedFilm.genre || text.profile.unknownGenre}</p>
                                <h4 className="text-lg font-bold text-[#E5E4E2] leading-tight">{selectedFilm.title}</h4>
                                <p className="text-[10px] text-gray-400 mt-1">{format(text.profile.commentCount, { count: selectedFilm.count })}</p>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col">
                            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
                                <div>
                                    <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">{text.profile.commentsAndReplies}</h3>
                                    <p className="text-[10px] text-gray-500 mt-1">{format(text.profile.commentRecords, { count: selectedFilmComments.length })}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMovieId(null)}
                                    className="text-[10px] uppercase tracking-[0.16em] text-gray-400 hover:text-white transition-colors"
                                >
                                    {text.profile.close}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
                                {isRepliesLoading && (
                                    <div className="text-[10px] uppercase tracking-[0.16em] text-sage/70">
                                        {text.profile.repliesLoading}
                                    </div>
                                )}

                                {selectedFilmComments.map((entry) => {
                                    const commentKey = buildCommentKey(entry.movieTitle, entry.text, entry.date);
                                    const replies = repliesByCommentKey[commentKey] || [];
                                    return (
                                        <article key={entry.id} className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4">
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <span className="text-[9px] font-mono text-gray-400">{entry.date}</span>
                                                <div className="flex items-center gap-2">
                                                    {entry.genre && (
                                                        <span className="text-[8px] uppercase tracking-widest text-sage/80">{entry.genre}</span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRitual(entry.id)}
                                                        className="text-[8px] uppercase tracking-widest text-gray-500 hover:text-clay transition-colors"
                                                        title={text.profile.deleteComment}
                                                    >
                                                        {text.profile.deleteComment}
                                                    </button>
                                                </div>
                                            </div>

                                            <p className="text-[11px] sm:text-xs font-serif italic text-[#E5E4E2]/90 leading-relaxed">
                                                "{entry.text}"
                                            </p>

                                            <div className="mt-3 pt-3 border-t border-white/10">
                                                <div className="text-[9px] uppercase tracking-[0.16em] text-sage/75 mb-2">
                                                    {format(text.profile.replies, { count: replies.length })}
                                                </div>
                                                {replies.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {replies.map((reply) => (
                                                            <div key={reply.id} className="rounded border border-white/10 bg-black/25 px-3 py-2">
                                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                                    <span className="text-[9px] uppercase tracking-widest text-[#E5E4E2]/80">{reply.author}</span>
                                                                    <span className="text-[9px] text-gray-500">{reply.timestamp}</span>
                                                                </div>
                                                                <p className="text-[10px] text-[#E5E4E2]/85 leading-relaxed">{reply.text}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] italic text-gray-500">{text.profile.noReplies}</p>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};

