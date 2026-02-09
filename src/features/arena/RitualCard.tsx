import React, { useMemo, useState } from 'react';
import type { Ritual } from '../../data/mockArena';
import { MarkIcons } from '../marks/MarkIcons';
import { useXP } from '../../context/XPContext';
import { useNotifications } from '../../context/NotificationContext';
import { resolvePosterCandidates } from '../../lib/posterCandidates';
import { searchPosterPath } from '../../lib/tmdbApi';
import { moderateComment } from '../../lib/commentModeration';
import { supabase, isSupabaseLive } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

interface RitualCardProps {
    ritual: Ritual;
    onDelete?: () => void;
    onLocalRepliesChange?: (ritualId: string, replies: ReplyRecord[]) => void;
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

export const RitualCard: React.FC<RitualCardProps> = ({ ritual, onDelete, onLocalRepliesChange }) => {
    const { echoRitual, following, user } = useXP();
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

    const isFollowing = following.includes(ritual.author);
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
                            message: ui.ritualCard.reactionSyncFailed
                        });
                    }
                });
        }
    };

    const handleDelete = () => {
        if (!onDelete) return;
        onDelete();
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
            author: 'You',
            text,
            timestamp: 'Just Now'
        };

        updateReplies((prev) => [...prev, newReply]);
        setReplyText('');

        if (canSyncRitual && supabase && user?.id) {
            const authorName = user.name || 'You';
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
                            message: ui.ritualCard.replySyncFailed
                        });
                        return;
                    }

                    const row = data as ReplyInsertRow | null;
                    if (!row?.id) return;

                    const syncedReply: ReplyRecord = {
                        id: row.id,
                        author: row.author || authorName,
                        text: row.text || text,
                        timestamp: row.created_at ? toRelativeTimestamp(row.created_at) : 'Just Now'
                    };

                    updateReplies((prev) => prev.map((reply) => (reply.id === tempId ? syncedReply : reply)));
                } catch (error: unknown) {
                    console.error('[Ritual] failed to sync replies', error);
                    updateReplies((prev) => prev.filter((reply) => reply.id !== tempId));
                    addNotification({
                        type: 'system',
                        message: ui.ritualCard.replySyncFailed
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
        <div
            className={`group relative pt-4 sm:pt-6 pb-4 sm:pb-6 border-b border-gray-100/5 flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 animate-fade-in hover:bg-transparent transition-all duration-500 px-4 sm:px-4 mx-0 sm:-mx-4
            ${isFollowing ? 'bg-gradient-to-r from-sage/5 to-transparent' : ''}
        `}
        >
            <div className="shrink-0 pt-0 sm:pt-1 self-start group-hover:scale-105 transition-transform duration-500">
                {(!hasError && imgSrc) || !ritual.movieTitle ? (
                    <div className="w-10 h-14 bg-gray-800 rounded shadow-sm overflow-hidden border border-white/10 opacity-80 group-hover:opacity-100 transition-opacity relative">
                        {!imageLoaded && <div className="absolute inset-0 bg-white/10 animate-pulse" />}

                        <img
                            src={imgSrc || ''}
                            alt={ritual.movieTitle}
                            referrerPolicy="origin"
                            onLoad={() => setImageLoaded(true)}
                            onError={handleImageError}
                            className={`w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        />
                    </div>
                ) : (
                    <div className="w-10 h-14 bg-[#151515] rounded border border-[#8A9A5B]/30 flex flex-col items-center justify-center p-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#8A9A5B] mb-1 opacity-80">
                            <path d="M21 7L13 7L13 17L21 17L21 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18 7V5H6V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M3 7L11 7L11 17L3 17L3 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="w-2 h-px bg-[#8A9A5B]/50" />
                    </div>
                )}
            </div>

            <div className="grow min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] sm:text-xs tracking-wider text-sage font-bold hover:text-white cursor-pointer transition-colors line-clamp-1">
                                {ritual.movieTitle}
                            </span>
                            <span className="text-[10px] text-sage/40 font-mono shrink-0">
                                ({ritual.year || '-'})
                            </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] tracking-widest uppercase text-[#E5E4E2]/70 font-bold relative group/author cursor-pointer">
                                {ritual.author ? ritual.author : ui.ritualCard.anonymous}

                                <div
                                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                                    style={{ backgroundColor: ritual.league === 'Bronze' ? '#CD7F32' : ritual.league === 'Gold' ? '#FFD700' : '#C0C0C0' }}
                                    title={ritual.league}
                                />
                            </span>

                            <span className="text-[9px] tracking-widest text-gray-500 uppercase">
                                - {formatRitualTimestamp(ritual.timestamp)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-1.5 sm:ml-2 sm:border-l border-white/5 sm:pl-2 opacity-60 self-start">
                        {ritual.featuredMarks?.map((MarkIcon, i) => (
                            <div key={i} className="text-[#E5E4E2]/50 hover:text-sage transition-colors">
                                <MarkIcon size={10} />
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-[13px] sm:text-sm md:text-base font-sans text-[#E5E4E2] leading-relaxed mb-2 opacity-90">
                    {visibleMainText}
                </p>
                {isMainTextLong && (
                    <button
                        onClick={() => setIsMainExpanded((prev) => !prev)}
                        className="mb-4 text-[10px] tracking-widest uppercase text-sage/80 hover:text-sage transition-colors"
                    >
                        {isMainExpanded ? ui.ritualCard.readLess : ui.ritualCard.readMore}
                    </button>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-6">
                    <button
                        onClick={handleEcho}
                        disabled={echoed}
                        className={`w-full sm:w-auto justify-start px-0 py-1 sm:px-0 sm:py-0 rounded-none border-0 flex items-center gap-2 group/btn transition-colors ${echoed ? 'text-clay cursor-default' : 'text-gray-300 hover:text-clay'}`}
                    >
                        <div className={`transition-transform duration-500 ${echoed ? 'scale-110' : 'group-hover/btn:scale-110'}`}>
                            <MarkIcons.Echo size={16} />
                        </div>
                        <span className="text-[10px] tracking-widest font-medium">
                            {format(ui.ritualCard.reactions, { count: echoCount })}
                        </span>
                    </button>

                    <button
                        onClick={() => setShowReply(!showReply)}
                        className="w-full sm:w-auto justify-start px-0 py-1 sm:px-0 sm:py-0 rounded-none border-0 flex items-center gap-2 group/btn transition-colors text-gray-300 hover:text-clay"
                    >
                        <span className="text-[10px] tracking-widest font-medium group-hover/btn:underline decoration-clay/50 underline-offset-4">
                            {format(ui.ritualCard.reply, { count: replies.length })}
                        </span>
                    </button>

                    {ritual.isCustom && onDelete && (
                        <button
                            onClick={handleDelete}
                            className="w-full sm:w-auto justify-start px-0 py-1 sm:px-0 sm:py-0 rounded-none border-0 flex items-center gap-2 group/btn transition-colors text-gray-400 hover:text-clay"
                            title={ui.ritualCard.deleteTitle}
                        >
                            <span className="text-[10px] tracking-widest font-medium">
                                {ui.ritualCard.delete}
                            </span>
                        </button>
                    )}
                </div>

                {showReply && (
                    <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/5 animate-fade-in pl-0 sm:pl-4 border-l-0 sm:border-l border-sage/10 ml-0 sm:ml-1">
                        <div className="flex flex-col gap-3 mb-4">
                            {replies.map((reply) => {
                                const isReplyExpanded = !!expandedReplies[reply.id];
                                const isReplyLong = reply.text.length > REPLY_TEXT_PREVIEW_LIMIT;
                                const visibleReplyText =
                                    isReplyLong && !isReplyExpanded
                                        ? `${reply.text.slice(0, REPLY_TEXT_PREVIEW_LIMIT).trimEnd()}...`
                                        : reply.text;

                                return (
                                    <div key={reply.id} className="p-3 bg-white/5 border border-white/5 rounded-lg relative group/reply hover:border-sage/20 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sage opacity-90 tracking-wide uppercase text-[9px]">
                                                {reply.author}
                                            </span>
                                            <span className="text-[9px] text-gray-500 font-mono">
                                                {reply.timestamp}
                                            </span>
                                        </div>

                                        <p className="text-xs text-[#E5E4E2] leading-relaxed opacity-90 mb-2">
                                            {visibleReplyText}
                                        </p>

                                        {isReplyLong && (
                                            <button
                                                onClick={() => toggleReplyExpansion(reply.id)}
                                                className="mb-2 text-[9px] tracking-widest uppercase text-sage/80 hover:text-sage transition-colors"
                                            >
                                                {isReplyExpanded ? ui.ritualCard.readLess : ui.ritualCard.readMore}
                                            </button>
                                        )}

                                        <div className="flex justify-end">
                                            <button className="text-[9px] text-gray-500 hover:text-clay flex items-center gap-1 transition-colors group/echo">
                                                <MarkIcons.Echo size={10} className="group-hover/echo:scale-110 transition-transform" />
                                                <span className="opacity-0 group-hover/reply:opacity-100 transition-opacity duration-300">{ui.ritualCard.reactions.replace('{count}', '').trim()}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-3">
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={ui.ritualCard.replyPlaceholder}
                                maxLength={MAX_REPLY_CHARS}
                                rows={2}
                                className="bg-white/[0.02] border border-white/10 rounded w-full text-[13px] sm:text-xs text-sage placeholder-sage/30 focus:border-sage outline-none py-2 px-3 transition-colors leading-relaxed resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        handleReplySubmit();
                                    }
                                }}
                            />
                            <div className="mt-2 flex items-center justify-between">
                                <span className={`text-[9px] tracking-widest ${replyCharsLeft < 20 ? 'text-red-400' : 'text-gray-500'}`}>
                                    {replyText.length}/{MAX_REPLY_CHARS}
                                </span>
                                <button
                                    onClick={handleReplySubmit}
                                    disabled={!replyText.trim()}
                                    className="text-[9px] uppercase tracking-widest text-[#E5E4E2]/60 hover:text-clay transition-colors disabled:opacity-30"
                                >
                                    {ui.ritualCard.send}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

