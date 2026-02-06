import { useEffect, useState } from 'react';
import { PROGRESS_EASING, getProgressFill, getProgressTransitionMs } from '../../lib/progressVisuals';

export const CycleTime = () => {
    const [status, setStatus] = useState({
        remaining: '',
        progress: 0
    });

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const end = new Date();
            end.setHours(23, 59, 59, 999);

            const totalSecondsInDay = 24 * 60 * 60;
            const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            const progress = (currentSeconds / totalSecondsInDay) * 100;

            const diffMs = end.getTime() - now.getTime();
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            const remaining = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

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
                <span className="opacity-70 mr-2">YENI SECKI</span>
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
