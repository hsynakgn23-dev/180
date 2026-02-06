import React, { useState } from 'react';
import type { Ritual } from '../../data/mockArena';
import { MarkIcons } from '../marks/MarkIcons';
import { useXP } from '../../context/XPContext';
import { useNotifications } from '../../context/NotificationContext';
import { resolveImageCandidates } from '../../lib/tmdbImage';
import { searchPosterPath } from '../../lib/tmdbApi';

interface RitualCardProps {
    ritual: Ritual;
}

export const RitualCard: React.FC<RitualCardProps> = ({ ritual }) => {
    const { echoRitual, following } = useXP();
    const { addNotification } = useNotifications();
    const [echoed, setEchoed] = useState(ritual.isEchoedByMe);
    const [echoCount, setEchoCount] = useState(ritual.echoes);

    // Reply State
    const [showReply, setShowReply] = useState(false);
    const [replies, setReplies] = useState(ritual.replies || []);
    const [replyText, setReplyText] = useState('');

    const isFollowing = following.includes(ritual.author);

    const handleEcho = () => {
        if (echoed) return;
        setEchoed(true);
        setEchoCount(prev => prev + 1);
        echoRitual(ritual.id);
    };

    const handleReplySubmit = () => {
        if (!replyText.trim()) return;

        // Mock Reply Addition
        const newReply = {
            id: Date.now().toString(),
            author: 'You', // In real app, user.name
            text: replyText,
            timestamp: 'Just Now'
        };

        setReplies([...replies, newReply]);
        setReplyText('');

        // Trigger notification
        addNotification({
            type: 'reply',
            message: `You whispered to ${ritual.author}'s ritual: "${replyText.substring(0, 20)}..."`,
        });
    };

    // --- Image Handling Logic (Copied from MovieCard) ---
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [candidates, setCandidates] = useState<string[]>([]);
    const [candidateIndex, setCandidateIndex] = useState(0);

    const applyCandidates = (nextCandidates: string[]) => {
        setCandidates(nextCandidates);
        setCandidateIndex(0);
        setImageLoaded(false);
        setImgSrc(nextCandidates[0] ?? null);
        setHasError(nextCandidates.length === 0);
    };

    React.useEffect(() => {
        setIsRetrying(false);
        setHasError(false);
        setImageLoaded(false);

        const nextCandidates = resolveImageCandidates(ritual.posterPath, 'w200');
        applyCandidates(nextCandidates);
        if (!nextCandidates.length && ritual.movieTitle) {
            handleRetry();
        }
    }, [ritual.id, ritual.posterPath, ritual.movieTitle]);

    const handleRetry = async () => {
        if (isRetrying || !ritual.movieTitle) {
            setHasError(true);
            return;
        }

        setIsRetrying(true);
        setHasError(false);
        // console.log(`[Arena Recovery] Fetching poster for: ${ritual.movieTitle}`);

        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        if (!apiKey || apiKey === 'YOUR_TMDB_API_KEY') {
            setIsRetrying(false);
            setHasError(true);
            return;
        }

        try {
            const posterPath = await searchPosterPath(ritual.movieTitle, apiKey);
            if (posterPath) {
                const nextCandidates = resolveImageCandidates(posterPath, 'w200');
                if (nextCandidates.length) {
                    applyCandidates(nextCandidates);
                    setIsRetrying(false);
                    return;
                }
            }
            setHasError(true);
        } catch (e) {
            setHasError(true);
        } finally {
            setIsRetrying(false);
        }
    };

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

    return (
        <div className={`group relative pt-6 pb-6 border-b border-gray-100/5 flex gap-6 animate-fade-in hover:bg-transparent transition-all duration-500 px-4 -mx-4 rounded-xl border border-transparent
            ${isFollowing ? 'shadow-[0_0_20px_rgba(138,154,91,0.05)] border-sage/10 bg-gradient-to-r from-sage/5 to-transparent' : 'hover:border-gray-100/5 hover:shadow-sm'}
        `}>
            {/* Left: Mini Movie Poster (Contextual Identity) */}
            <div className="shrink-0 pt-1 group-hover:scale-105 transition-transform duration-500">
                {(!hasError && imgSrc) || !ritual.movieTitle ? (
                    <div className="w-10 h-14 bg-gray-800 rounded shadow-sm overflow-hidden border border-white/10 opacity-80 group-hover:opacity-100 transition-opacity relative">
                        {/* Loading Shimmer */}
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
                    /* Mini Premium Fallback (Sage Camera) */
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

            {/* Right: Content */}
            <div className="grow">
                {/* Meta Header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex flex-col gap-1">
                        {/* Movie Title & Year - More Prominent */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs tracking-wider text-sage font-bold hover:text-white cursor-pointer transition-colors">
                                {ritual.movieTitle}
                            </span>
                            <span className="text-[10px] text-sage/40 font-mono">
                                ({ritual.year || '—'})
                            </span>
                        </div>
                        {/* Author & Timestamp */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] tracking-widest uppercase text-[#E5E4E2]/70 font-bold relative group/author cursor-pointer">
                                {ritual.author ? ritual.author : 'ANONYMOUS'}

                                {/* League Dot Indicator */}
                                <div
                                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                                    style={{ backgroundColor: ritual.league === 'Bronze' ? '#CD7F32' : ritual.league === 'Gold' ? '#FFD700' : '#C0C0C0' }}
                                    title={ritual.league}
                                />
                            </span>

                            <span className="text-[9px] tracking-widest text-gray-500 uppercase">
                                — {ritual.timestamp === '2h ago' ? 'At Dusk' : ritual.timestamp === 'Just Now' ? 'At Dawn' : ritual.timestamp}
                            </span>
                        </div>
                    </div>

                    {/* Featured Marks (Mini Icons) */}
                    <div className="flex gap-1.5 ml-2 border-l border-white/5 pl-2 opacity-60">
                        {ritual.featuredMarks?.map((MarkIcon, i) => (
                            <div key={i} className="text-[#E5E4E2]/50 hover:text-sage transition-colors">
                                <MarkIcon size={10} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Text */}
                <p className="text-sm md:text-base font-sans text-[#E5E4E2] leading-relaxed mb-4 opacity-90">
                    {ritual.text}
                </p>

                {/* Footer: Echo & Reply Actions */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={handleEcho}
                        disabled={echoed}
                        className={`flex items-center gap-2 group/btn transition-colors ${echoed ? 'text-sage cursor-default' : 'text-gray-300 hover:text-sage'}`}
                    >
                        <div className={`transition-transform duration-500 ${echoed ? 'scale-110' : 'group-hover/btn:scale-110'}`}>
                            <MarkIcons.Echo size={16} />
                        </div>
                        <span className="text-[10px] tracking-widest font-medium">
                            {echoCount} ECHOES
                        </span>
                    </button>

                    <button
                        onClick={() => setShowReply(!showReply)}
                        className="flex items-center gap-2 group/btn transition-colors text-gray-300 hover:text-sage"
                    >
                        <span className="text-[10px] tracking-widest font-medium group-hover/btn:underline decoration-sage/50 underline-offset-4">
                            WHISPER BACK
                        </span>
                    </button>
                </div>

                {/* Reply Section (Dialogue) */}
                {showReply && (
                    <div className="mt-6 pt-4 border-t border-white/5 animate-fade-in pl-4 border-l border-sage/10 ml-1">

                        {/* Existing Replies */}
                        <div className="flex flex-col gap-3 mb-4">
                            {replies.map(reply => (
                                <div key={reply.id} className="p-3 bg-white/5 border border-white/5 rounded-lg relative group/reply hover:border-sage/20 transition-colors">
                                    {/* Reply Header */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sage opacity-90 tracking-wide uppercase text-[9px]">
                                            {reply.author}
                                        </span>
                                        <span className="text-[9px] text-gray-500 font-mono">
                                            {reply.timestamp}
                                        </span>
                                    </div>

                                    {/* Reply Text */}
                                    <p className="text-xs text-[#E5E4E2] font-serif leading-relaxed opacity-90 mb-2">
                                        {reply.text}
                                    </p>

                                    {/* Reply Actions (Echo) */}
                                    <div className="flex justify-end">
                                        <button className="text-[9px] text-gray-500 hover:text-sage flex items-center gap-1 transition-colors group/echo">
                                            <MarkIcons.Echo size={10} className="group-hover/echo:scale-110 transition-transform" />
                                            <span className="opacity-0 group-hover/reply:opacity-100 transition-opacity duration-300">ECHO</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Reply Input */}
                        <div className="flex gap-2 items-center mt-3">
                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Whisper a reply..."
                                maxLength={180}
                                className="bg-transparent border-b border-white/10 w-full text-xs text-sage placeholder-sage/30 focus:border-sage outline-none py-1 transition-colors font-serif italic"
                                onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
                            />
                            <button
                                onClick={handleReplySubmit}
                                disabled={!replyText.trim()}
                                className="text-[9px] uppercase tracking-widest text-[#E5E4E2]/50 hover:text-sage transition-colors disabled:opacity-0"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

