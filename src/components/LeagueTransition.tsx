import { useState, type CSSProperties } from 'react';
import { useLanguage } from '../context/LanguageContext';
import type { LanguageCode } from '../i18n/localization';

interface LeagueTransitionProps {
    color: string;
    leagueName: string;
    onComplete: () => void;
}

const LEAGUE_TRANSITION_COPY: Record<LanguageCode, { badge: string; body: string; meta: string; action: string }> = {
    en: {
        badge: 'League Advanced',
        body: 'Congratulations. Your total XP has moved up into this league.',
        meta: 'League promoted',
        action: 'Done'
    },
    tr: {
        badge: 'Lig Atladı',
        body: 'Tebrikler. Toplam XP seviyen bu lige yükseldi.',
        meta: 'Lig atlandı',
        action: 'Tamam'
    },
    es: {
        badge: 'Liga Ascendida',
        body: 'Felicidades. Tu XP total subió a esta liga.',
        meta: 'Liga mejorada',
        action: 'Listo'
    },
    fr: {
        badge: 'Ligue Débloquée',
        body: 'Félicitations. Ton XP total est monté jusqu’à cette ligue.',
        meta: 'Ligue promue',
        action: 'Terminer'
    }
};

export const LeagueTransition: React.FC<LeagueTransitionProps> = ({ color, leagueName, onComplete }) => {
    const { language } = useLanguage();
    const [dismissed, setDismissed] = useState(false);
    if (dismissed) return null;

    const handleClose = () => {
        setDismissed(true);
        onComplete();
    };

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
    const copy = LEAGUE_TRANSITION_COPY[language];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={overlayStyle} />

            <div
                className="relative z-10 mx-4 w-[min(92vw,560px)] rounded-2xl border bg-[#111111]/90 px-8 py-8 text-center backdrop-blur-md"
                style={cardStyle}
            >
                <div className="mx-auto mb-5 h-[1px] w-24" style={accentLineStyle} />

                <p className="mb-3 text-[10px] font-medium tracking-[0.34em] uppercase text-[#E5E4E2]/55">
                    {copy.badge}
                </p>

                <h2 className="text-3xl md:text-5xl font-bold tracking-[0.2em] uppercase" style={accentTextStyle}>
                    {leagueName}
                </h2>

                <p className="mt-4 text-xs md:text-sm text-[#E5E4E2]/75">
                    {copy.body}
                </p>

                <p className="mt-2 text-[10px] tracking-[0.28em] uppercase text-[#E5E4E2]/40">
                    {copy.meta}
                </p>

                <button
                    type="button"
                    onClick={handleClose}
                    className="relative z-20 mt-7 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-white hover:bg-white/15 transition-colors"
                >
                    {copy.action}
                </button>
            </div>
        </div>
    );
};
