import { useEffect, type CSSProperties } from 'react';
import type { StreakCelebrationEvent } from '../context/XPContext';

interface StreakCelebrationProps {
    event: StreakCelebrationEvent;
    onComplete: () => void;
}

type CelebrationTheme = {
    badge: string;
    title: string;
    subtitle: string;
    shellClass: string;
    cardClass: string;
    accentHex: string;
};

const DEFAULT_THEME: CelebrationTheme = {
    badge: 'Daily Streak',
    title: 'Series Locked In',
    subtitle: 'Tebrikler, bugunku rituel ile seriyi korudun.',
    shellClass: 'bg-gradient-to-br from-[#0c1415]/90 via-[#10161b]/90 to-[#0c0f15]/90',
    cardClass: 'bg-gradient-to-br from-[#121b1d]/90 via-[#162028]/90 to-[#11141c]/90',
    accentHex: '#8A9A5B'
};

const MILESTONE_THEMES: Record<number, CelebrationTheme> = {
    5: {
        badge: '5 Day Milestone',
        title: 'First Spark',
        subtitle: 'Tebrikler, ilk buyuk esigi gectin.',
        shellClass: 'bg-gradient-to-br from-[#2a1308]/92 via-[#31180d]/90 to-[#170d09]/94',
        cardClass: 'bg-gradient-to-br from-[#3a1d0f]/90 via-[#5b2b16]/90 to-[#1f120d]/90',
        accentHex: '#f59e0b'
    },
    7: {
        badge: '7 Day Milestone',
        title: 'Lucky Orbit',
        subtitle: 'Tebrikler, bir haftalik tempo artik sende.',
        shellClass: 'bg-gradient-to-br from-[#0e1026]/92 via-[#1b1f47]/90 to-[#0d1020]/94',
        cardClass: 'bg-gradient-to-br from-[#1a1f4f]/90 via-[#313b8a]/88 to-[#141836]/92',
        accentHex: '#818cf8'
    },
    10: {
        badge: '10 Day Milestone',
        title: 'Double Digits',
        subtitle: 'Tebrikler, iki haneli seri seviyesine geldin.',
        shellClass: 'bg-gradient-to-br from-[#1f0b25]/92 via-[#2a0f34]/90 to-[#140a1f]/94',
        cardClass: 'bg-gradient-to-br from-[#2b123a]/90 via-[#4f1f6a]/88 to-[#1a112d]/92',
        accentHex: '#c084fc'
    },
    20: {
        badge: '20 Day Milestone',
        title: 'Momentum Gate',
        subtitle: 'Tebrikler, ritim artik aliskanliga donustu.',
        shellClass: 'bg-gradient-to-br from-[#0a2320]/92 via-[#0f3430]/90 to-[#08201d]/94',
        cardClass: 'bg-gradient-to-br from-[#0e3a34]/90 via-[#1b5c55]/88 to-[#0c2a27]/92',
        accentHex: '#34d399'
    },
    40: {
        badge: '40 Day Milestone',
        title: 'Forty Pulse',
        subtitle: 'Tebrikler, uzun seri dayanimini kanitladin.',
        shellClass: 'bg-gradient-to-br from-[#23170b]/92 via-[#3a220c]/90 to-[#1f1308]/94',
        cardClass: 'bg-gradient-to-br from-[#3d2a0f]/90 via-[#69410f]/88 to-[#2b1909]/92',
        accentHex: '#f97316'
    },
    50: {
        badge: '50 Day Milestone',
        title: 'Golden Frame',
        subtitle: 'Tebrikler, yarim asirlik seri artik sende.',
        shellClass: 'bg-gradient-to-br from-[#241c08]/92 via-[#3f2e0b]/90 to-[#1d1407]/94',
        cardClass: 'bg-gradient-to-br from-[#4f390e]/90 via-[#7a5a0f]/88 to-[#2f2209]/92',
        accentHex: '#facc15'
    },
    100: {
        badge: '100 Day Milestone',
        title: 'Century Flame',
        subtitle: 'Tebrikler, uc haneli efsanevi seriye ulastin.',
        shellClass: 'bg-gradient-to-br from-[#2a0f12]/92 via-[#4a141a]/90 to-[#1f0b0f]/94',
        cardClass: 'bg-gradient-to-br from-[#5a151e]/90 via-[#8f1f2c]/88 to-[#341015]/92',
        accentHex: '#fb7185'
    },
    200: {
        badge: '200 Day Milestone',
        title: 'Double Century',
        subtitle: 'Tebrikler, istikrarin artik benchmark seviyesinde.',
        shellClass: 'bg-gradient-to-br from-[#0f1e2b]/92 via-[#163347]/90 to-[#0d1823]/94',
        cardClass: 'bg-gradient-to-br from-[#173a52]/90 via-[#245f84]/88 to-[#102738]/92',
        accentHex: '#38bdf8'
    },
    250: {
        badge: '250 Day Milestone',
        title: 'Silver Surge',
        subtitle: 'Tebrikler, dev seri artik kalici bir iz birakti.',
        shellClass: 'bg-gradient-to-br from-[#151920]/92 via-[#222a36]/90 to-[#12151b]/94',
        cardClass: 'bg-gradient-to-br from-[#252f3d]/90 via-[#3f4f65]/88 to-[#1a222e]/92',
        accentHex: '#94a3b8'
    },
    300: {
        badge: '300 Day Milestone',
        title: 'Triple Orbit',
        subtitle: 'Tebrikler, bu seri artik oyunun ustunde.',
        shellClass: 'bg-gradient-to-br from-[#142311]/92 via-[#21391b]/90 to-[#101b0d]/94',
        cardClass: 'bg-gradient-to-br from-[#223f1b]/90 via-[#3a6a2f]/88 to-[#162b12]/92',
        accentHex: '#84cc16'
    },
    350: {
        badge: '350 Day Milestone',
        title: 'Titan Run',
        subtitle: 'Tebrikler, tarihi bir seri seviyesine ciktin.',
        shellClass: 'bg-gradient-to-br from-[#2c1b0f]/92 via-[#4d2a14]/90 to-[#1f130b]/94',
        cardClass: 'bg-gradient-to-br from-[#5c3218]/90 via-[#934d1b]/88 to-[#321c0f]/92',
        accentHex: '#fb923c'
    }
};

const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = hex.trim().replace('#', '');
    const expanded = normalized.length === 3
        ? normalized.split('').map((ch) => ch + ch).join('')
        : normalized;

    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
        return `rgba(138,154,91,${alpha})`;
    }

    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

export const StreakCelebration: React.FC<StreakCelebrationProps> = ({ event, onComplete }) => {
    useEffect(() => {
        const timer = window.setTimeout(onComplete, 2800);
        return () => window.clearTimeout(timer);
    }, [onComplete]);

    const theme = MILESTONE_THEMES[event.day] || DEFAULT_THEME;

    const cardStyle: CSSProperties = {
        borderColor: hexToRgba(theme.accentHex, 0.42),
        boxShadow: `0 28px 92px rgba(0,0,0,0.62), 0 0 0 1px ${hexToRgba(theme.accentHex, 0.24)} inset`
    };
    const accentLineStyle: CSSProperties = {
        background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(theme.accentHex, 0.9)} 50%, transparent 100%)`
    };
    const dayStyle: CSSProperties = {
        color: theme.accentHex
    };
    const pulseStyle: CSSProperties = {
        boxShadow: `0 0 0 2px ${hexToRgba(theme.accentHex, 0.36)} inset, 0 0 48px ${hexToRgba(theme.accentHex, 0.45)}`
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none overflow-hidden">
            <div className={`absolute inset-0 animate-streak-overlay ${theme.shellClass}`} />

            <div
                className={`relative mx-4 w-[min(92vw,560px)] rounded-[28px] border px-8 py-8 text-center backdrop-blur-md animate-streak-card ${theme.cardClass}`}
                style={cardStyle}
            >
                <div className="mx-auto mb-5 h-[2px] w-28 animate-streak-line" style={accentLineStyle} />

                <p className="mb-2 text-[10px] font-semibold tracking-[0.34em] uppercase text-[#f5f5f4]/65">
                    {theme.badge}
                </p>

                <h2 className="text-2xl md:text-4xl font-bold tracking-[0.18em] uppercase text-[#f8fafc]">
                    {theme.title}
                </h2>

                <div className="mt-4 mb-5 inline-flex items-center gap-3 rounded-full border border-white/20 bg-black/20 px-5 py-2">
                    <span className="text-[11px] tracking-[0.22em] uppercase text-white/70">Streak Day</span>
                    <span className="text-2xl md:text-3xl font-bold tracking-tight" style={dayStyle}>
                        {event.day}
                    </span>
                </div>

                <p className="text-sm md:text-base font-medium text-[#f1f5f9]/90">
                    {theme.subtitle}
                </p>

                <p className="mt-2 text-[11px] tracking-[0.26em] uppercase text-[#f8fafc]/60">
                    Tebrikler. Devam et.
                </p>

                <div className="pointer-events-none absolute -inset-5 rounded-[34px] animate-streak-pulse" style={pulseStyle} />
            </div>
        </div>
    );
};
