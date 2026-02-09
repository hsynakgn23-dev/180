import { useEffect, useState } from 'react';
import { PROGRESS_EASING, getProgressFill, getProgressTransitionMs } from '../../lib/progressVisuals';
import { useLanguage } from '../../context/LanguageContext';

const DEFAULT_DAILY_ROLLOVER_TIMEZONE = 'Europe/Istanbul';
const DAILY_ROLLOVER_TIMEZONE = (
    import.meta.env.VITE_DAILY_ROLLOVER_TIMEZONE || DEFAULT_DAILY_ROLLOVER_TIMEZONE
).trim() || DEFAULT_DAILY_ROLLOVER_TIMEZONE;

const createClockFormatter = (timeZone: string): Intl.DateTimeFormat => {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            hourCycle: 'h23'
        });
    } catch {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'UTC',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            hourCycle: 'h23'
        });
    }
};

const DAILY_CLOCK_FORMATTER = createClockFormatter(DAILY_ROLLOVER_TIMEZONE);

const getClockParts = (date: Date): { hour: number; minute: number; second: number } => {
    const parts = DAILY_CLOCK_FORMATTER.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? Number.NaN);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? Number.NaN);
    const second = Number(parts.find((part) => part.type === 'second')?.value ?? Number.NaN);

    if ([hour, minute, second].every((value) => Number.isInteger(value))) {
        return { hour, minute, second };
    }

    return {
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds()
    };
};

export const CycleTime = () => {
    const { text } = useLanguage();
    const [status, setStatus] = useState({
        remaining: '',
        progress: 0
    });

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const { hour, minute, second } = getClockParts(now);

            const totalSecondsInDay = 24 * 60 * 60;
            const elapsedSecondsRaw = hour * 3600 + minute * 60 + second;
            const elapsedSeconds = Math.min(totalSecondsInDay - 1, Math.max(0, elapsedSecondsRaw));
            const progress = (elapsedSeconds / totalSecondsInDay) * 100;
            const remainingSeconds = totalSecondsInDay - elapsedSeconds - 1;
            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            const seconds = remainingSeconds % 60;
            const remaining = `${hours.toString().padStart(2, '0')}:${minutes
                .toString()
                .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            setStatus({ remaining, progress });
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    if (!status.remaining) return null;

    const progressFill = getProgressFill(status.progress);
    const transitionMs = getProgressTransitionMs(status.progress);

    return (
        <div className="flex flex-col items-start sm:items-end gap-2 animate-fade-in w-full sm:w-auto">
            <div className="text-[10px] uppercase tracking-[0.2em] text-sage font-bold drop-shadow-sm w-full sm:text-right">
                <span className="opacity-70 mr-2">{text.daily.newSelection}</span>
                <span className="font-mono">{status.remaining}</span>
            </div>

            <div className="w-full sm:w-44 h-1 bg-white/10 rounded-full overflow-hidden relative">
                <div
                    className="h-full shadow-[0_0_10px_rgba(138,154,91,0.6)] relative z-10"
                    style={{
                        width: `${status.progress}%`,
                        background: progressFill,
                        transitionProperty: 'width, background',
                        transitionDuration: `${transitionMs}ms`,
                        transitionTimingFunction: PROGRESS_EASING
                    }}
                />
            </div>
        </div>
    );
};
