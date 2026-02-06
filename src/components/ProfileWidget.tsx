import { useMemo } from 'react';
import { useXP } from '../context/XPContext';
import { MinorMarks } from '../features/marks/MinorMarks';
import { MAJOR_MARKS } from '../data/marksData';

interface ProfileWidgetProps {
    onClick?: () => void;
}

export const ProfileWidget: React.FC<ProfileWidgetProps> = ({ onClick }) => {
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

    return (
        <div className="flex flex-col items-end gap-2 animate-fade-in pointer-events-auto">
            <div
                onClick={onClick}
                className="bg-[var(--color-bg)]/95 backdrop-blur-xl shadow-2xl border border-white/5 px-5 py-4 rounded-2xl flex flex-col pointer-events-auto transition-all hover:border-sage/30 cursor-pointer min-w-[340px] max-w-[380px] group"
            >
                <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 shrink-0 rounded-lg bg-[#0a0a0a] border border-white/10 overflow-hidden relative shadow-inner">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 transition-all duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-sage/50 font-mono">
                                    {user?.name?.substring(0, 2).toUpperCase() || 'OB'}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-sage/10 mix-blend-overlay pointer-events-none" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-bold text-[#E5E4E2] tracking-wider truncate">
                                {user?.name || 'Observer'}
                            </p>
                            <p className="text-[9px] text-sage uppercase tracking-[0.25em] font-medium opacity-80">
                                {league}
                            </p>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-gray-500">Profile</p>
                        <p className="text-[10px] text-sage/80 uppercase tracking-[0.18em]">Open Archive</p>
                    </div>
                </div>

                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden mb-2">
                    <div
                        className="h-full bg-sage shadow-[0_0_10px_rgba(138,154,91,0.5)] transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-[10px] mb-3">
                    <span className="text-[var(--color-text)] opacity-60">{Math.floor(xp)} XP</span>
                    <span className="text-sage/80 uppercase tracking-[0.16em]">{xpToNext} XP to next</span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="bg-white/5 border border-white/10 rounded-md py-2">
                        <p className="text-base font-bold text-sage leading-none">{streak}</p>
                        <p className="text-[8px] tracking-[0.2em] uppercase text-gray-500 mt-1">Streak</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-md py-2">
                        <p className="text-base font-bold text-sage leading-none">{dailyRitualsCount}</p>
                        <p className="text-[8px] tracking-[0.2em] uppercase text-gray-500 mt-1">Rituals</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-md py-2">
                        <p className="text-base font-bold text-sage leading-none">{daysPresent}</p>
                        <p className="text-[8px] tracking-[0.2em] uppercase text-gray-500 mt-1">Days</p>
                    </div>
                </div>

                <MinorMarks count={dailyRitualsCount} />

                <div className="mt-3 pt-3 border-t border-sage/10 w-full">
                    {featuredMarkDefs.length > 0 ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            {featuredMarkDefs.slice(0, 3).map((mark) => (
                                <div key={mark.id} className="flex items-center gap-2 bg-white/5 border border-sage/20 rounded-full px-2 py-1 min-w-0">
                                    <mark.Icon size={10} />
                                    <span className="text-[8px] uppercase tracking-[0.18em] text-[#E5E4E2]/80 truncate">
                                        {mark.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-gray-500">
                            <span>Marks unlocked</span>
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

