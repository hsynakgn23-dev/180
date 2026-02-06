import React from 'react';
import { PROGRESS_EASING, getProgressFill, getProgressTransitionMs } from '../lib/progressVisuals';

interface XPProgressBarProps {
    progress: number; // 0 to 100
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({ progress }) => {
    const barFill = getProgressFill(progress);
    const transitionMs = getProgressTransitionMs(progress);

    return (
        <div className="h-2 w-32 md:w-48 bg-gray-200 rounded-full overflow-hidden relative">
            <div
                className="h-full rounded-full"
                style={{
                    width: `${progress}%`,
                    background: barFill,
                    transitionProperty: 'width, background',
                    transitionDuration: `${transitionMs}ms`,
                    transitionTimingFunction: PROGRESS_EASING
                }}
            />
        </div>
    );
};
