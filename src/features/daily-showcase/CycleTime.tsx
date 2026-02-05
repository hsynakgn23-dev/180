import { useState, useEffect } from 'react';

export const CycleTime = () => {
    const [status, setStatus] = useState({
        remaining: '',
        progress: 0
    });

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            // End of day (Midnight)
            const end = new Date();
            end.setHours(23, 59, 59, 999);

            const totalSecondsInDay = 24 * 60 * 60;
            const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

            // Progress Calculation
            const progress = (currentSeconds / totalSecondsInDay) * 100;

            // Remaining Calculation
            const diffMs = end.getTime() - now.getTime();
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            setStatus({ remaining: formattedTime, progress });
        };

        const interval = setInterval(updateTime, 1000); // Create pulse
        updateTime(); // Initial call

        return () => clearInterval(interval);
    }, []);

    if (!status.remaining) return null; // Avoid hydration mismatch or flash

    return (
        <div className="flex flex-col items-end gap-2 animate-fade-in">
            <div className="text-[10px] uppercase tracking-[0.2em] text-sage font-bold drop-shadow-sm w-full text-right">
                <span className="opacity-70 mr-2">YENİ SEÇKİ</span>
                <span className="font-mono">{status.remaining}</span>
            </div>
            {/* Progress Bar (Enhanced) */}
            <div className="w-32 h-[2px] bg-white/10 rounded-full overflow-hidden relative">
                <div
                    className="h-full bg-gradient-to-r from-sage/40 to-sage shadow-[0_0_10px_rgba(138,154,91,0.8)] transition-all duration-1000 linear relative z-10"
                    style={{ width: `${status.progress}%` }}
                />
            </div>
        </div>
    );
};
