import { useMemo } from 'react';
import { useXP } from '../context/XPContext';
import { MinorMarks } from '../features/marks/MinorMarks';
import { MAJOR_MARKS } from '../data/marksData';
import { PROGRESS_EASING, getProgressFill, getProgressTransitionMs } from '../lib/progressVisuals';
import { GearIcon } from './icons/GearIcon';
import { MarkBadge } from '../features/marks/MarkBadge';
import { useLanguage } from '../context/LanguageContext';

interface ProfileWidgetProps {
    onClick?: () => void;
    onOpenSettings?: () => void;
}

export const ProfileWidget: React.FC<ProfileWidgetProps> = ({ onClick, onOpenSettings }) => {
    const { text, format, markCopy, leagueCopy } = useLanguage();
    const {
        xp,
        league,
        progressPercentage,
        whisper,
        dailyRitualsCount,
        marks,
        featuredMarks,
        user,
        avatarUrl,
        streak,
        daysPresent,
        nextLevelXP
    } = useXP();

    const featuredMarkDefs = useMemo(
        () =>
            featuredMarks
                .map((markId) => MAJOR_MARKS.find((mark) => mark.id === markId))
                .filter((mark): mark is (typeof MAJOR_MARKS)[number] => !!mark),
        [featuredMarks]
    );

    const xpToNext = Math.max(0, Math.floor(nextLevelXP - xp));
    const leagueLabel = leagueCopy(league)?.name || league;
    const progressFill = getProgressFill(progressPercentage);
    const progressTransitionMs = getProgressTransitionMs(progressPercentage);

    return (
        <div className="flex flex-col items-end gap-2 animate-fade-in pointer-events-auto">
            <div
                onClick={onClick}
                className="bg-[var(--color-bg)]/95 backdrop-blur-xl shadow-2xl border border-white/5 px-4 sm:px-5 py-4 rounded-2xl flex flex-col pointer-events-auto transition-all hover:border-sage/30 cursor-pointer w-[min(92vw,380px)] sm:min-w-[340px] sm:max-w-[380px] group"
            >
                <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 shrink-0 rounded-lg bg-[#0a0a0a] border border-white/10 overflow-hidden relative shadow-inner">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-sage/50 font-mono">
                                    {user?.name?.substring(0, 2).toUpperCase() || 'OB'}
                                </div>
                            )}
                            {!avatarUrl && <div className="absolute inset-0 bg-sage/10 mix-blend-overlay pointer-events-none" />}
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-bold text-[#E5E4E2] tracking-wider truncate">
                                {user?.name || text.profileWidget.observer}
                            </p>
                            <p className="text-[9px] text-sage uppercase tracking-[0.25em] font-medium opacity-80">
                                {leagueLabel}
                            </p>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-gray-500">{text.profileWidget.profile}</p>
                        <div className="flex items-center justify-end gap-2 mt-1">
                            <p className="text-[9px] sm:text-[10px] text-sage/80 uppercase tracking-[0.18em]">{text.profileWidget.openArchive}</p>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSettings?.();
                                }}
                                className="h-6 w-6 rounded-full border border-sage/25 bg-white/5 text-clay/80 hover:text-clay hover:border-clay/40 transition-colors flex items-center justify-center"
                                title={text.profileWidget.openSettings}
                                aria-label={text.profileWidget.openSettings}
                            >
                                <GearIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden mb-2">
                    <div
                        className="h-full shadow-[0_0_10px_rgba(138,154,91,0.45)]"
                        style={{
                            width: `${progressPercentage}%`,
                            background: progressFill,
                            transitionProperty: 'width, background',
                            transitionDuration: `${progressTransitionMs}ms`,
                            transitionTimingFunction: PROGRESS_EASING
                        }}
                    />
                </div>

                <div className="flex items-center justify-between text-[10px] mb-3">
                    <span className="text-[var(--color-text)] opacity-60">{Math.floor(xp)} XP</span>
                    <span className="text-sage/80 uppercase tracking-[0.16em]">{format(text.profileWidget.xpToNext, { xp: xpToNext })}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="bg-white/5 border border-white/10 rounded-md py-2">
                        <p className="text-base font-bold text-sage leading-none">{streak}</p>
                        <p className="text-[8px] tracking-[0.2em] uppercase text-gray-500 mt-1">{text.profileWidget.streak}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-md py-2">
                        <p className="text-base font-bold text-sage leading-none">{dailyRitualsCount}</p>
                        <p className="text-[8px] tracking-[0.2em] uppercase text-gray-500 mt-1">{text.profileWidget.comments}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-md py-2">
                        <p className="text-base font-bold text-sage leading-none">{daysPresent}</p>
                        <p className="text-[8px] tracking-[0.2em] uppercase text-gray-500 mt-1">{text.profileWidget.days}</p>
                    </div>
                </div>

                <MinorMarks count={dailyRitualsCount} />

                <div className="mt-3 pt-3 border-t border-sage/10 w-full">
                    {featuredMarkDefs.length > 0 ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            {featuredMarkDefs.slice(0, 3).map((mark) => (
                                <div key={mark.id} className="flex items-center gap-2 bg-white/5 border border-sage/20 rounded-full px-2 py-1 min-w-0">
                                    <MarkBadge mark={mark} size={10} imageClassName="w-3 h-3 rounded-sm object-cover" />
                                    <span className="text-[8px] uppercase tracking-[0.18em] text-[#E5E4E2]/80 truncate">
                                        {markCopy(mark.id).title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-gray-500">
                            <span>{text.profileWidget.marksUnlocked}</span>
                            <span className="text-sage/70">{marks.length}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className={`text-end transition-all duration-700 ease-in-out ${whisper ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
                <p className="text-[10px] text-gray-400 font-serif italic pr-2">{whisper}</p>
            </div>
        </div>
    );
};
