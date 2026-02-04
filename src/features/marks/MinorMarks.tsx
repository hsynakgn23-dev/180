import React from 'react';

interface MinorMarksProps {
    count: number;
}

export const MinorMarks: React.FC<MinorMarksProps> = ({ count }) => {
    // Generate array of dots based on active rituals
    // For visual sanity, we might limit or wrap, but for now lets render all active "dots" 
    // in a tight row, maybe capping at 30?

    // Logic: 1 dot per ritual
    const displayCount = Math.min(count, 35); // Cap to avoid breakage for now

    return (
        <div className="flex gap-1 h-2 items-center justify-center mt-2 flex-wrap max-w-[120px]">
            {Array.from({ length: displayCount }).map((_, i) => (
                <div
                    key={i}
                    className="w-1 h-1 rounded-full bg-sage/40"
                />
            ))}
        </div>
    );
};
