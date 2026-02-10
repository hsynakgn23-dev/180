import React, { useEffect, useMemo, useState } from 'react';
import { useXP, type SharePromptEvent } from '../context/XPContext';
import { useLanguage } from '../context/LanguageContext';
import type { LanguageCode } from '../i18n/localization';

type SharePlatform = 'instagram' | 'tiktok' | 'x';
type ShareGoal = 'comment' | 'streak';

interface SharePromptModalProps {
    event: SharePromptEvent;
    onClose: () => void;
}

type ShareCopy = {
    title: string;
    subtitle: string;
    commentMode: string;
    streakMode: string;
    commentHint: string;
    streakHint: string;
    rewardHint: string;
    commentLocked: string;
    streakLocked: string;
    claimedHint: string;
    shareInstagram: string;
    shareTiktok: string;
    shareX: string;
    failedHint: string;
    emptyCommentHint: string;
    streakPreview: (count: number) => string;
    later: string;
};

const SHARE_COPY_BY_LANGUAGE: Record<LanguageCode, ShareCopy> = {
    tr: {
        title: 'Paylasim Bonusu',
        subtitle: 'Yorumunu veya bugunku streak sonucunu hemen paylasabilirsin.',
        commentMode: 'Yorum Paylas',
        streakMode: 'Streak Paylas',
        commentHint: 'Bugun yazdigin yorumu paylasirsan bonus XP alirsin.',
        streakHint: 'Bugunku rituel tamamlandiysa streak sonucunu paylasabilirsin.',
        rewardHint: 'Gunluk ilk uygun paylasim +18 XP',
        commentLocked: 'Yorum paylasimi icin bugun yorum yaz.',
        streakLocked: 'Streak paylasimi icin bugunku ritueli tamamla.',
        claimedHint: 'Bugun paylasim bonusu zaten alindi.',
        shareInstagram: 'Instagram',
        shareTiktok: 'TikTok',
        shareX: 'X',
        failedHint: 'Paylasim hazirlanamadi. Tekrar dene.',
        emptyCommentHint: 'Bugunku yorum metni bulunamadi.',
        streakPreview: (count: number) => `Bugunku streak tamamlandi: ${count} gun`,
        later: 'Sonra'
    },
    en: {
        title: 'Share Bonus',
        subtitle: 'You can share your comment or today\'s streak result now.',
        commentMode: 'Share Comment',
        streakMode: 'Share Streak',
        commentHint: 'Share today\'s comment to earn bonus XP.',
        streakHint: 'If today\'s ritual is complete, share your streak result.',
        rewardHint: 'First eligible share of the day: +18 XP',
        commentLocked: 'Write a comment today first.',
        streakLocked: 'Complete today\'s ritual first.',
        claimedHint: 'Today\'s share bonus has already been claimed.',
        shareInstagram: 'Instagram',
        shareTiktok: 'TikTok',
        shareX: 'X',
        failedHint: 'Could not prepare share. Try again.',
        emptyCommentHint: 'No comment text found for today.',
        streakPreview: (count: number) => `Today's streak is complete: ${count} days`,
        later: 'Later'
    },
    es: {
        title: 'Bonus por Compartir',
        subtitle: 'Puedes compartir ahora tu comentario o el resultado de la racha de hoy.',
        commentMode: 'Compartir Comentario',
        streakMode: 'Compartir Racha',
        commentHint: 'Comparte el comentario de hoy para ganar XP extra.',
        streakHint: 'Si completaste el ritual de hoy, comparte tu racha.',
        rewardHint: 'Primer compartido valido del dia: +18 XP',
        commentLocked: 'Primero escribe un comentario hoy.',
        streakLocked: 'Primero completa el ritual de hoy.',
        claimedHint: 'El bonus de compartido de hoy ya fue reclamado.',
        shareInstagram: 'Instagram',
        shareTiktok: 'TikTok',
        shareX: 'X',
        failedHint: 'No se pudo preparar el compartido. Intenta otra vez.',
        emptyCommentHint: 'No se encontro comentario de hoy.',
        streakPreview: (count: number) => `Racha completada hoy: ${count} dias`,
        later: 'Luego'
    },
    fr: {
        title: 'Bonus de Partage',
        subtitle: 'Tu peux partager maintenant ton commentaire ou ta serie du jour.',
        commentMode: 'Partager Commentaire',
        streakMode: 'Partager Serie',
        commentHint: 'Partage ton commentaire du jour pour gagner du XP bonus.',
        streakHint: 'Si le rituel du jour est termine, partage ta serie.',
        rewardHint: 'Premier partage valide du jour : +18 XP',
        commentLocked: 'Ecris d abord un commentaire aujourd hui.',
        streakLocked: 'Termine d abord le rituel du jour.',
        claimedHint: 'Le bonus de partage du jour est deja pris.',
        shareInstagram: 'Instagram',
        shareTiktok: 'TikTok',
        shareX: 'X',
        failedHint: 'Partage indisponible. Reessaie.',
        emptyCommentHint: 'Aucun commentaire du jour trouve.',
        streakPreview: (count: number) => `Serie terminee aujourd hui : ${count} jours`,
        later: 'Plus tard'
    }
};

const getTodayDateKey = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const SharePromptModal: React.FC<SharePromptModalProps> = ({ event, onClose }) => {
    const {
        awardShareXP,
        dailyRituals,
        streak,
        xp,
        league,
        user,
        username
    } = useXP();
    const { language, text, leagueCopy } = useLanguage();
    const [shareGoal, setShareGoal] = useState<ShareGoal>(event.preferredGoal);
    const [shareStatus, setShareStatus] = useState<string | null>(null);

    useEffect(() => {
        setShareGoal(event.preferredGoal);
        setShareStatus(null);
    }, [event.id, event.preferredGoal]);

    const shareCopy = SHARE_COPY_BY_LANGUAGE[language] || SHARE_COPY_BY_LANGUAGE.en;
    const today = getTodayDateKey();
    const latestTodayRitual = useMemo(
        () => dailyRituals.find((ritual) => ritual.date === today) || null,
        [dailyRituals, today]
    );
    const latestRitual = dailyRituals[0] || null;
    const activeRitual = latestTodayRitual || latestRitual;
    const hasCommentToday = Boolean(latestTodayRitual);
    const effectiveStreak = Math.max(streak || 0, event.streak || 0);
    const isStreakCompletedToday = hasCommentToday && effectiveStreak > 0;
    const shareGoalReady = shareGoal === 'comment' ? hasCommentToday : isStreakCompletedToday;
    const currentLeagueLabel = leagueCopy(league)?.name || league;
    const displayName = user?.name || text.profile.curatorFallback;
    const handle = username || text.profile.observerHandle;

    const latestCommentPreview = useMemo(() => {
        const eventText = (event.commentPreview || '').trim();
        const ritualText = (activeRitual?.text || '').trim();
        const raw = eventText || ritualText;
        if (!raw) return shareCopy.emptyCommentHint;
        if (raw.length <= 120) return raw;
        return `${raw.slice(0, 120).trimEnd()}...`;
    }, [activeRitual?.text, event.commentPreview, shareCopy.emptyCommentHint]);

    const buildPayload = (platform: SharePlatform, goal: ShareGoal): string => {
        const platformTag = platform === 'x' ? '#X' : platform === 'tiktok' ? '#TikTok' : '#Instagram';

        if (goal === 'streak') {
            return [
                '180 Absolute Cinema',
                `${displayName} (@${handle})`,
                shareCopy.streakPreview(effectiveStreak),
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

        const payload = buildPayload(platform, goal);
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

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 bg-black/78 backdrop-blur-sm"
                aria-label={text.profile.close}
            />

            <div className="relative z-10 w-full max-w-xl rounded-2xl border border-sage/30 bg-gradient-to-br from-[#101814] via-[#141414] to-[#1f1711] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold tracking-[0.08em] uppercase text-white">{shareCopy.title}</h3>
                        <p className="text-[11px] text-white/70 mt-1">{shareCopy.subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[10px] uppercase tracking-[0.18em] text-gray-400 hover:text-white transition-colors"
                    >
                        {shareCopy.later}
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
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
                        @{handle}
                    </p>
                    {shareGoal === 'comment' ? (
                        <p className="text-sm text-white/90 leading-relaxed font-serif italic">"{latestCommentPreview}"</p>
                    ) : (
                        <p className="text-sm text-white/90 leading-relaxed font-serif italic">
                            {shareCopy.streakPreview(effectiveStreak)}
                        </p>
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
    );
};
