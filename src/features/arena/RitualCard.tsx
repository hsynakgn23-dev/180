import React, { useMemo, useState } from 'react';
import type { Ritual } from '../../data/mockArena';
import { MarkIcons } from '../marks/MarkIcons';
import { useXP } from '../../context/XPContext';
import { resolveLeagueInfo } from '../../domain/leagueSystem';
import { useNotifications } from '../../context/NotificationContext';
import { resolvePosterCandidates } from '../../lib/posterCandidates';
import { searchPosterPath } from '../../lib/tmdbApi';
import { moderateComment } from '../../lib/commentModeration';
import { supabase, isSupabaseLive } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

interface RitualCardProps {
    ritual: Ritual;
    isHotStreak?: boolean;
    onDelete?: () => void;
    onLocalRepliesChange?: (ritualId: string, replies: ReplyRecord[]) => void;
    onOpenAuthorProfile?: (target: { userId?: string | null; username: string }) => void;
}

const MAIN_TEXT_PREVIEW_LIMIT = 220;
const REPLY_TEXT_PREVIEW_LIMIT = 140;
const MAX_REPLY_CHARS = 180;
type ReplyRecord = NonNullable<Ritual['replies']>[number];
type ReplyInsertRow = {
    id: string;
    author: string | null;
    text: string | null;
    created_at: string | null;
};

const formatRitualTimestamp = (timestamp: string): string => {
    return timestamp;
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

const isRateLimitError = (error: { message?: string | null } | null | undefined): boolean => {
    const lowered = (error?.message || '').toLowerCase();
    return lowered.includes('rate limit') || lowered.includes('too many');
};

export const RitualCard: React.FC<RitualCardProps> = ({ ritual, isHotStreak = false, onDelete, onLocalRepliesChange, onOpenAuthorProfile }) => {
    const { echoRitual, isFollowingUser, toggleFollowUser, user } = useXP();
    const { addNotification } = useNotifications();
    const { text: ui, format } = useLanguage();
    const [echoed, setEchoed] = useState(ritual.isEchoedByMe);
    const [echoCount, setEchoCount] = useState(ritual.echoes);
    const canSyncRitual =
        isSupabaseLive() &&
        !!supabase &&
        !!user?.id &&
        !ritual.id.startsWith('log-');

    const [showReply, setShowReply] = useState(false);
    const [replies, setReplies] = useState<ReplyRecord[]>(ritual.replies || []);
    const [replyText, setReplyText] = useState('');
    const [isMainExpanded, setIsMainExpanded] = useState(false);
    const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

    const leagueInfo = resolveLeagueInfo(ritual.league);
    const isFollowing = isFollowingUser(ritual.userId, ritual.author);
    const normalizedAuthor = (ritual.author || '').trim().toLowerCase();
    const isOwnAuthor = Boolean(
        user &&
        (
            (ritual.userId && user.id && ritual.userId === user.id) ||
            ((user.name || '').trim().toLowerCase() === normalizedAuthor && normalizedAuthor.length > 0)
        )
    );
    const canInteractWithAuthor = Boolean(ritual.author && !isOwnAuthor);
    const isMainTextLong = ritual.text.length > MAIN_TEXT_PREVIEW_LIMIT;
    const visibleMainText = useMemo(() => {
        if (!isMainTextLong || isMainExpanded) return ritual.text;
        return `${ritual.text.slice(0, MAIN_TEXT_PREVIEW_LIMIT).trimEnd()}...`;
    }, [isMainExpanded, isMainTextLong, ritual.text]);

    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [candidates, setCandidates] = useState<string[]>([]);
    const [candidateIndex, setCandidateIndex] = useState(0);
    const relativeTimeLabels = useMemo(
        () => ({
            timeToday: ui.profile.timeToday,
            timeJustNow: ui.profile.timeJustNow,
            timeHoursAgo: ui.profile.timeHoursAgo,
            timeDaysAgo: ui.profile.timeDaysAgo
        }),
        [ui.profile.timeDaysAgo, ui.profile.timeHoursAgo, ui.profile.timeJustNow, ui.profile.timeToday]
    );
    const shouldSyncLocalRepliesRef = React.useRef(false);

    React.useEffect(() => {
        setEchoed(ritual.isEchoedByMe);
        setEchoCount(ritual.echoes);
        setReplies(ritual.replies || []);
    }, [ritual.id, ritual.echoes, ritual.isEchoedByMe, ritual.replies]);

    const updateReplies = React.useCallback((updater: (prev: ReplyRecord[]) => ReplyRecord[]) => {
        shouldSyncLocalRepliesRef.current = true;
        setReplies((prev) => updater(prev));
    }, []);

    React.useEffect(() => {
        if (!shouldSyncLocalRepliesRef.current) return;
        shouldSyncLocalRepliesRef.current = false;
        onLocalRepliesChange?.(ritual.id, replies);
    }, [onLocalRepliesChange, replies, ritual.id]);

    const applyCandidates = (nextCandidates: string[]) => {
        setCandidates(nextCandidates);
        setCandidateIndex(0);
        setImageLoaded(false);
        setImgSrc(nextCandidates[0] ?? null);
        setHasError(nextCandidates.length === 0);
    };

    const handleRetry = async () => {
        if (isRetrying || !ritual.movieTitle) {
            setHasError(true);
            return;
        }

        setIsRetrying(true);
        setHasError(false);

        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        if (!apiKey || apiKey === 'YOUR_TMDB_API_KEY') {
            setIsRetrying(false);
            setHasError(true);
            return;
        }

        try {
            const posterPath = await searchPosterPath(ritual.movieTitle, apiKey);
            if (posterPath) {
                const nextCandidates = resolvePosterCandidates(ritual.movieId, posterPath, 'w200');
                if (nextCandidates.length) {
                    applyCandidates(nextCandidates);
                    setIsRetrying(false);
                    return;
                }
            }
            setHasError(true);
        } catch {
            setHasError(true);
        } finally {
            setIsRetrying(false);
        }
    };

    React.useEffect(() => {
        setIsRetrying(false);
        setHasError(false);
        setImageLoaded(false);

        const nextCandidates = resolvePosterCandidates(ritual.movieId, ritual.posterPath, 'w200');
        applyCandidates(nextCandidates);

        if (!nextCandidates.length && ritual.movieTitle) {
            handleRetry();
        }
    }, [ritual.id, ritual.movieId, ritual.posterPath, ritual.movieTitle]);

    const handleImageError = () => {
        const nextIndex = candidateIndex + 1;
        if (nextIndex < candidates.length) {
            setCandidateIndex(nextIndex);
            setImageLoaded(false);
            setHasError(false);
            setImgSrc(candidates[nextIndex]);
            return;
        }
        handleRetry();
    };

    const handleEcho = () => {
        if (echoed) return;
        const nextEchoCount = echoCount + 1;
        setEchoed(true);
        setEchoCount(nextEchoCount);
        echoRitual(ritual.id);

        if (canSyncRitual && supabase && user?.id) {
            void supabase
                .from('ritual_echoes')
                .upsert([{ ritual_id: ritual.id, user_id: user.id }], {
                    onConflict: 'ritual_id,user_id',
                    ignoreDuplicates: true
                })
                .then(({ error }) => {
                    if (error) {
                        console.error('[Ritual] failed to sync echo count', error);
                        setEchoed(false);
                        setEchoCount((prev) => Math.max(0, prev - 1));
                        addNotification({
                            type: 'system',
                            message: isRateLimitError(error)
                                ? ui.ritualCard.rateLimitReached
                                : ui.ritualCard.reactionSyncFailed
                        });
                    }
                });
        }
    };

    const handleDelete = () => {
        if (!onDelete) return;
        onDelete();
    };

    const handleOpenProfile = () => {
        if (!ritual.author) return;
        onOpenAuthorProfile?.({
            userId: ritual.userId ?? null,
            username: ritual.author
        });
    };

    const handleToggleFollow = async () => {
        if (!ritual.author || !canInteractWithAuthor) return;
        const result = await toggleFollowUser({
            userId: ritual.userId ?? null,
            username: ritual.author
        });
        if (!result.ok && result.message) {
            addNotification({
                type: 'system',
                message: result.message
            });
        }
    };

    const handleReplySubmit = () => {
        const text = replyText.trim();
        if (!text) return;
        const moderation = moderateComment(text, {
            maxChars: MAX_REPLY_CHARS,
            maxEmojiCount: 5,
            maxEmojiRatio: 0.25
        });
        if (!moderation.ok) {
            addNotification({
                type: 'system',
                message: moderation.message || ui.ritualCard.replySyncFailed
            });
            return;
        }

        const tempId = `tmp-${Date.now()}`;
        const newReply: ReplyRecord = {
            id: tempId,
            author: ui.ritualCard.you,
            text,
            timestamp: ui.profile.timeJustNow
        };

        updateReplies((prev) => [...prev, newReply]);
        setReplyText('');

        if (canSyncRitual && supabase && user?.id) {
            const authorName = user.name || ui.ritualCard.you;
            void (async () => {
                try {
                    const { data, error } = await supabase
                        .from('ritual_replies')
                        .insert([
                            {
                                ritual_id: ritual.id,
                                user_id: user.id,
                                author: authorName,
                                text
                            }
                        ])
                        .select('id, author, text, created_at')
                        .single();

                    if (error) {
                        console.error('[Ritual] failed to sync replies', error);
                        updateReplies((prev) => prev.filter((reply) => reply.id !== tempId));
                        addNotification({
                            type: 'system',
                            message: isRateLimitError(error)
                                ? ui.ritualCard.rateLimitReached
                                : ui.ritualCard.replySyncFailed
                        });
                        return;
                    }

                    const row = data as ReplyInsertRow | null;
                    if (!row?.id) return;

                    const syncedReply: ReplyRecord = {
                        id: row.id,
                        author: row.author || authorName,
                        text: row.text || text,
                        timestamp: row.created_at ? toRelativeTimestamp(row.created_at, relativeTimeLabels) : ui.profile.timeJustNow
                    };

                    updateReplies((prev) => prev.map((reply) => (reply.id === tempId ? syncedReply : reply)));
                } catch (error: unknown) {
                    console.error('[Ritual] failed to sync replies', error);
                    updateReplies((prev) => prev.filter((reply) => reply.id !== tempId));
                    const message = isRateLimitError(error as { message?: string | null })
                        ? ui.ritualCard.rateLimitReached
                        : ui.ritualCard.replySyncFailed;
                    addNotification({
                        type: 'system',
                        message
                    });
                }
            })();
        } else {
            updateReplies((prev) => prev.map((reply) => (reply.id === tempId ? { ...reply, id: Date.now().toString() } : reply)));
        }

        addNotification({
            type: 'reply',
            message: format(ui.ritualCard.replyNotification, {
                author: ritual.author,
                text: `${text.substring(0, 20)}...`
            })
        });
    };

    const toggleReplyExpansion = (replyId: string) => {
        setExpandedReplies((prev) => ({
            ...prev,
            [replyId]: !prev[replyId]
        }));
    };

    const replyCharsLeft = MAX_REPLY_CHARS - replyText.length;

    return (
        <article
            className={`
                group relative rounded-2xl mb-3 overflow-hidden transition-all duration-300
                border border-white/[0.06] hover:border-white/[0.12]
                bg-[#0f0f0f]/80 backdrop-blur-sm
                hover:bg-[#141414]/90 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                ${isOwnAuthor ? 'ring-1 ring-inset ring-sage/20 bg-sage/[0.03]' : ''}
                ${isHotStreak ? 'ring-1 ring-inset ring-clay/30 shadow-[0_0_30px_rgba(165,113,100,0.12)]' : ''}
                ${isFollowing ? 'border-l-2 border-l-sage/30' : ''}
            `}
        >
            {/* League accent line at top */}
            <div
                className="absolute top-0 left-0 right-0 h-[1px] opacity-40"
                style={{ background: `linear-gradient(90deg, transparent, ${leagueInfo.color}80, transparent)` }}
            />

            <div className="p-4 sm:p-5">
                {/* Header row: poster + meta */}
                <div className="flex gap-4">
                    {/* Poster */}
                    <div className="shrink-0 self-start mt-0.5">
                        {(!hasError && imgSrc) || !ritual.movieTitle ? (
                            <div className="w-11 h-[62px] rounded-lg overflow-hidden border border-white/10 shadow-md relative bg-[#1a1a1a]">
                                {!imageLoaded && <div className="absolute inset-0 bg-white/5 animate-pulse rounded-lg" />}
                                <img
                                    src={imgSrc || ''}
                                    alt={ritual.movieTitle}
                                    referrerPolicy="origin"
                                    onLoad={() => setImageLoaded(true)}
                                    onError={handleImageError}
                                    className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${imageLoaded ? 'opacity-90 group-hover:opacity-100' : 'opacity-0'}`}
                                />
                            </div>
                        ) : (
                            <div
                                className="w-11 h-[62px] rounded-lg border flex flex-col items-center justify-center gap-1"
                                style={{ borderColor: `${leagueInfo.color}30`, background: `${leagueInfo.color}08` }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: leagueInfo.color }} className="opacity-70">
                                    <rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
                                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M2 17L7 12L11 16L15 11L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="w-3 h-px" style={{ background: `${leagueInfo.color}40` }} />
                            </div>
                        )}
                    </div>

                    {/* Right side meta */}
                    <div className="grow min-w-0">
                        {/* Movie title + year */}
                        <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                            <span className="text-[12px] sm:text-[13px] font-bold tracking-wide text-[#E5E4E2] leading-tight line-clamp-1">
                                {ritual.movieTitle}
                            </span>
                            {ritual.year && (
                                <span className="text-[10px] text-[#E5E4E2]/30 font-mono shrink-0">
                                    {ritual.year}
                                </span>
                            )}
                        </div>

                        {/* Author row */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {/* League badge */}
                            <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[8px] uppercase tracking-[0.15em] font-bold shrink-0"
                                style={{
                                    color: leagueInfo.color,
                                    background: `${leagueInfo.color}18`,
                                    border: `1px solid ${leagueInfo.color}35`
                                }}
                            >
                                {ritual.league || 'Bronze'}
                            </span>

                            <button
                                type="button"
                                onClick={handleOpenProfile}
                                className="text-[10px] tracking-widest uppercase text-[#E5E4E2]/60 font-semibold hover:text-sage transition-colors break-all text-left"
                                title={ui.ritualCard.openProfile}
                            >
                                {ritual.author ? `@${ritual.author}` : ui.ritualCard.anonymous}
                            </button>

                            {isOwnAuthor && (
                                <span className="text-[8px] uppercase tracking-[0.18em] text-sage/80 font-bold bg-sage/10 border border-sage/20 rounded-full px-2 py-0.5">
                                    {ui.ritualCard.you}
                                </span>
                            )}

                            {canInteractWithAuthor && (
                                <button
                                    type="button"
                                    onClick={() => void handleToggleFollow()}
                                    className={`text-[9px] uppercase tracking-widest transition-colors ${
                                        isFollowing ? 'text-sage/90 hover:text-sage' : 'text-[#E5E4E2]/25 hover:text-sage'
                                    }`}
                                >
                                    {isFollowing ? ui.ritualCard.following : ui.ritualCard.follow}
                                </button>
                            )}

                            <span className="text-[9px] tracking-widest text-[#E5E4E2]/25 uppercase ml-auto">
                                {formatRitualTimestamp(ritual.timestamp)}
                            </span>
                        </div>

                        {/* Hot streak badge */}
                        {isHotStreak && (
                            <div className="mt-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full border border-clay/35 bg-clay/12 px-2 py-0.5 text-[8px] uppercase tracking-[0.18em] text-clay/80 shadow-[0_0_10px_rgba(165,113,100,0.2)]">
                                    <span>◆</span>
                                    {ui.arena.hotStreakBadge}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ritual text */}
                <div className="mt-4 pl-0 sm:pl-[60px]">
                    <p className="text-[13px] sm:text-[14px] font-sans text-[#E5E4E2]/85 leading-relaxed tracking-[0.01em]">
                        {visibleMainText}
                    </p>
                    {isMainTextLong && (
                        <button
                            onClick={() => setIsMainExpanded((prev) => !prev)}
                            className="mt-2 text-[10px] tracking-widest uppercase text-sage/60 hover:text-sage transition-colors"
                        >
                            {isMainExpanded ? ui.ritualCard.readLess : ui.ritualCard.readMore}
                        </button>
                    )}

                    {/* Action bar */}
                    <div className="mt-4 flex items-center gap-5 border-t border-white/[0.04] pt-3">
                        <button
                            onClick={handleEcho}
                            disabled={echoed}
                            className={`flex items-center gap-1.5 group/echo transition-all duration-200 ${
                                echoed ? 'text-clay' : 'text-[#E5E4E2]/30 hover:text-clay'
                            }`}
                        >
                            <div className={`transition-transform duration-300 ${echoed ? 'scale-110' : 'group-hover/echo:scale-110'}`}>
                                <MarkIcons.Echo size={14} />
                            </div>
                            <span className="text-[10px] tracking-widest font-medium tabular-nums">
                                {format(ui.ritualCard.reactions, { count: echoCount })}
                            </span>
                        </button>

                        <button
                            onClick={() => setShowReply(!showReply)}
                            className={`flex items-center gap-1.5 text-[10px] tracking-widest transition-colors ${
                                showReply ? 'text-sage/80' : 'text-[#E5E4E2]/30 hover:text-sage/60'
                            }`}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="opacity-80">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="font-medium tabular-nums">
                                {format(ui.ritualCard.reply, { count: replies.length })}
                            </span>
                        </button>

                        {ritual.featuredMarks && ritual.featuredMarks.length > 0 && (
                            <div className="flex items-center gap-1 ml-1 opacity-40">
                                {ritual.featuredMarks.map((MarkIcon, i) => (
                                    <div key={i} className="text-[#E5E4E2]/50 hover:text-sage transition-colors">
                                        <MarkIcon size={10} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {ritual.isCustom && onDelete && (
                            <button
                                onClick={handleDelete}
                                className="ml-auto flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#E5E4E2]/20 hover:text-clay/60 transition-colors"
                                title={ui.ritualCard.deleteTitle}
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <span>{ui.ritualCard.delete}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Reply section */}
            {showReply && (
                <div className="border-t border-white/[0.05] bg-white/[0.015] px-4 sm:px-5 py-4 animate-fade-in">
                    {replies.length > 0 && (
                        <div className="flex flex-col gap-2 mb-4">
                            {replies.map((reply) => {
                                const isReplyExpanded = !!expandedReplies[reply.id];
                                const isReplyLong = reply.text.length > REPLY_TEXT_PREVIEW_LIMIT;
                                const visibleReplyText =
                                    isReplyLong && !isReplyExpanded
                                        ? `${reply.text.slice(0, REPLY_TEXT_PREVIEW_LIMIT).trimEnd()}...`
                                        : reply.text;

                                return (
                                    <div
                                        key={reply.id}
                                        className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 group/reply hover:border-white/10 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-bold text-sage/80 tracking-wide uppercase">
                                                {reply.author}
                                            </span>
                                            <span className="text-[9px] text-[#E5E4E2]/25 font-mono">
                                                {reply.timestamp}
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-[#E5E4E2]/80 leading-relaxed">
                                            {visibleReplyText}
                                        </p>
                                        {isReplyLong && (
                                            <button
                                                onClick={() => toggleReplyExpansion(reply.id)}
                                                className="mt-1.5 text-[9px] tracking-widest uppercase text-sage/60 hover:text-sage transition-colors"
                                            >
                                                {isReplyExpanded ? ui.ritualCard.readLess : ui.ritualCard.readMore}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={ui.ritualCard.replyPlaceholder}
                            maxLength={MAX_REPLY_CHARS}
                            rows={2}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl text-[13px] text-[#E5E4E2]/90 placeholder-[#E5E4E2]/20 px-4 py-2.5 outline-none focus:border-sage/40 focus:ring-1 focus:ring-sage/20 transition-all resize-none leading-relaxed"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleReplySubmit();
                                }
                            }}
                        />
                        <div className="flex items-center justify-between px-1">
                            <span className={`text-[9px] tracking-widest font-mono ${replyCharsLeft < 20 ? 'text-clay/80' : 'text-[#E5E4E2]/20'}`}>
                                {replyText.length}/{MAX_REPLY_CHARS}
                            </span>
                            <button
                                onClick={handleReplySubmit}
                                disabled={!replyText.trim()}
                                className="text-[9px] uppercase tracking-widest text-[#E5E4E2]/40 hover:text-sage transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                                {ui.ritualCard.send}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
};
