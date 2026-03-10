import { useEffect, useState, type CSSProperties } from 'react';
import type { StreakCelebrationEvent } from '../context/XPContext';
import { useLanguage } from '../context/LanguageContext';
import {
  resolveStreakCelebrationCopy,
  resolveStreakCelebrationTheme,
  resolveStreakSurfaceCopy,
} from '../domain/celebrations';

interface StreakCelebrationProps {
  event: StreakCelebrationEvent;
  onComplete: () => void;
}

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
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [event.day]);

  if (dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    onComplete();
  };

  const theme = resolveStreakCelebrationTheme(event.day);
  const themeCopy = resolveStreakCelebrationCopy(language, event.day);
  const surfaceCopy = resolveStreakSurfaceCopy(language);

  const shellStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${hexToRgba(theme.shellStart, 0.94)} 0%, ${hexToRgba(theme.shellEnd, 0.96)} 100%)`,
  };
  const cardStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${hexToRgba(theme.cardStart, 0.92)} 0%, ${hexToRgba(theme.cardEnd, 0.94)} 100%)`,
    borderColor: hexToRgba(theme.accentHex, 0.42),
    boxShadow: `0 28px 92px rgba(0,0,0,0.62), 0 0 0 1px ${hexToRgba(theme.accentHex, 0.24)} inset`,
  };
  const accentLineStyle: CSSProperties = {
    background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(theme.accentHex, 0.9)} 50%, transparent 100%)`,
  };
  const dayStyle: CSSProperties = {
    color: theme.accentHex,
  };
  const pulseStyle: CSSProperties = {
    boxShadow: `0 0 0 2px ${hexToRgba(theme.accentHex, 0.36)} inset, 0 0 48px ${hexToRgba(theme.accentHex, 0.45)}`,
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-auto overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={shellStyle} />

      <div
        className="relative z-10 mx-4 w-[min(92vw,560px)] rounded-[28px] border px-8 py-8 text-center backdrop-blur-md"
        style={cardStyle}
      >
        <div className="mx-auto mb-5 h-[2px] w-28" style={accentLineStyle} />

        <p className="mb-2 text-[10px] font-semibold tracking-[0.34em] uppercase text-[#f5f5f4]/65">
          {themeCopy.badge}
        </p>

        <h2 className="text-2xl md:text-4xl font-bold tracking-[0.18em] uppercase text-[#f8fafc]">
          {themeCopy.title}
        </h2>

        <div className="mt-4 mb-5 inline-flex items-center gap-3 rounded-full border border-white/20 bg-black/20 px-5 py-2">
          <span className="text-[11px] tracking-[0.22em] uppercase text-white/70">{surfaceCopy.dayLabel}</span>
          <span className="text-2xl md:text-3xl font-bold tracking-tight" style={dayStyle}>
            {event.day}
          </span>
        </div>

        <p className="text-sm md:text-base font-medium text-[#f1f5f9]/90">
          {themeCopy.subtitle}
        </p>

        <p className="mt-2 text-[11px] tracking-[0.26em] uppercase text-[#f8fafc]/60">
          {surfaceCopy.completed}
        </p>

        <button
          type="button"
          onClick={handleClose}
          className="relative z-20 mt-7 inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-white hover:bg-white/15 transition-colors"
        >
          {surfaceCopy.action}
        </button>

        <div className="pointer-events-none absolute -inset-5 rounded-[34px]" style={pulseStyle} />
      </div>
    </div>
  );
};
