import { useEffect, type CSSProperties } from 'react';

interface LeagueTransitionProps {
    color: string;
    leagueName: string;
    onComplete: () => void;
}

export const LeagueTransition: React.FC<LeagueTransitionProps> = ({ color, leagueName, onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 1900);
        return () => clearTimeout(timer);
    }, [onComplete]);

    const hexToRgb = (hex: string): string => {
        const normalized = hex.trim().replace('#', '');
        const expanded = normalized.length === 3
            ? normalized.split('').map((ch) => ch + ch).join('')
            : normalized;
        const valid = /^[0-9a-fA-F]{6}$/.test(expanded);
        if (!valid) return '138,154,91';
        const r = parseInt(expanded.slice(0, 2), 16);
        const g = parseInt(expanded.slice(2, 4), 16);
        const b = parseInt(expanded.slice(4, 6), 16);
        return `${r},${g},${b}`;
    };

    const accent = color || '#8A9A5B';
    const accentRgb = hexToRgb(accent);
    const overlayStyle: CSSProperties = {
        background: `radial-gradient(circle at 50% 30%, rgba(${accentRgb},0.18) 0%, rgba(18,18,18,0.92) 46%, rgba(10,10,10,0.98) 100%)`
    };
    const cardStyle: CSSProperties = {
        borderColor: `rgba(${accentRgb},0.35)`,
        boxShadow: `0 24px 80px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(${accentRgb},0.12)`
    };
    const accentLineStyle: CSSProperties = {
        backgroundColor: accent
    };
    const accentTextStyle: CSSProperties = {
        color: accent
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="absolute inset-0 animate-league-overlay" style={overlayStyle} />

            <div
                className="relative mx-4 w-[min(92vw,540px)] rounded-2xl border bg-[#111111]/80 px-8 py-8 text-center backdrop-blur-md animate-league-card"
                style={cardStyle}
            >
                <div className="mx-auto mb-5 h-[1px] w-24 animate-league-line" style={accentLineStyle} />

                <p className="mb-3 text-[10px] font-medium tracking-[0.34em] uppercase text-[#E5E4E2]/55">
                    League Advanced
                </p>

                <h2 className="text-3xl md:text-5xl font-bold tracking-[0.2em] uppercase" style={accentTextStyle}>
                    {leagueName}
                </h2>

                <p className="mt-4 text-[10px] tracking-[0.28em] uppercase text-[#E5E4E2]/40">
                    Orbit Updated
                </p>
            </div>
        </div>
    );
};
