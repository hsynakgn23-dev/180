import React, { useMemo } from 'react';

interface XPProgressBarProps {
    progress: number; // 0 to 100
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({ progress }) => {
    // Color Logic
    const barColor = useMemo(() => {
        if (progress < 30) return '#4E5C35'; // Dark Sage (0-30%)
        if (progress < 60) return '#8A9A5B'; // Light Sage (30-60%)
        if (progress < 85) return 'linear-gradient(90deg, #8A9A5B 0%, #A57164 100%)'; // Sage/Clay Mix (60-85%)
        return '#A57164'; // Clay (85-100%)
    }, [progress]);

    return (
        <div className="h-2 w-32 md:w-48 bg-gray-200 rounded-full overflow-hidden relative">
            <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                    width: `${progress}%`,
                    background: barColor,
                    // Custom easing: fast start, slow end to give "threshold" crossing feel
                    transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)'
                }}
            />
        </div>
    );
};
