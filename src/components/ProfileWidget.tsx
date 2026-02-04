import { useXP } from '../context/XPContext';
import { MinorMarks } from '../features/marks/MinorMarks';
import { MarkIcons } from '../features/marks/MarkIcons';

interface ProfileWidgetProps {
    onClick?: () => void;
}

export const ProfileWidget: React.FC<ProfileWidgetProps> = ({ onClick }) => {
    const { xp, league, progressPercentage, whisper, dailyRitualsCount, marks, user, avatarUrl } = useXP();

    return (
        <div className="flex flex-col items-end gap-2 animate-fade-in pointer-events-auto">
            <div
                onClick={onClick}
                className="bg-[var(--color-bg)]/95 backdrop-blur-xl shadow-2xl border border-white/5 px-8 py-5 rounded-2xl flex flex-col items-center pointer-events-auto transition-all hover:border-sage/30 cursor-pointer min-w-[360px] group"
            >
                {/* Identity Header */}
                <div className="flex items-center gap-4 w-full mb-3">
                    {/* Avatar with Sage Filter */}
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-[#0a0a0a] border border-white/10 overflow-hidden relative shadow-inner">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 transition-all duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-sage/50 font-mono">
                                {user?.name?.substring(0, 2).toUpperCase() || 'OB'}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-sage/10 mix-blend-overlay pointer-events-none" />
                    </div>

                    {/* Info Stack */}
                    <div className="flex flex-col grow items-end">
                        <span className="text-xs font-bold text-[#E5E4E2] tracking-wider mb-0.5">
                            {user?.name || 'Observer'}
                        </span>
                        <span className="text-[9px] text-sage uppercase tracking-[0.25em] font-medium opacity-80">
                            {league}
                        </span>
                    </div>
                </div>

                {/* Minimal Progress Bar */}
                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden mb-3">
                    <div
                        className="h-full bg-sage shadow-[0_0_10px_rgba(138,154,91,0.5)] transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                {/* Minor Marks (Dots) */}
                <MinorMarks count={dailyRitualsCount} />

                {/* Major Marks (Geometric Icons) */}
                <div className="flex gap-3 mt-4 pt-3 border-t border-sage/10 w-full justify-center">
                    {/* First Mark: Triangle */}
                    <div className={`${marks.includes('first_mark') ? 'text-sage' : 'text-gray-400 opacity-20'} transition-colors duration-700`}>
                        <MarkIcons.Triangle size={12} />
                    </div>
                    {/* Seven Days: Pentagon */}
                    <div className={`${marks.includes('seven_quiet_days') ? 'text-sage' : 'text-gray-400 opacity-20'} transition-colors duration-700`}>
                        <MarkIcons.Pentagon size={12} />
                    </div>
                    {/* 180 Exact: Hexagon */}
                    <div className={`${marks.includes('180_exact') ? 'text-clay' : 'text-gray-400 opacity-20'} transition-colors duration-700`}>
                        <MarkIcons.Hexagon size={14} />
                    </div>
                    {/* Genre Discovery: Diamond */}
                    <div className={`${marks.includes('genre_discovery') ? 'text-blue-400' : 'text-gray-400 opacity-20'} transition-colors duration-700`}>
                        <MarkIcons.Diamond size={12} />
                    </div>
                </div>

                {/* XP Count */}
                <div className="mt-3 text-[10px] font-medium text-[var(--color-text)] opacity-40">
                    {Math.floor(xp)} XP
                </div>
            </div>

            {/* Whisper Notification */}
            <div className={`text-end transition-all duration-700 ease-in-out ${whisper ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
                <p className="text-[10px] text-gray-400 font-serif italic pr-2">{whisper}</p>
            </div>
        </div>
    );
};
