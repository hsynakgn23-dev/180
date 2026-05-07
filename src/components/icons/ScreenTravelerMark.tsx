import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const ScreenTravelerMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
        className={`mark-motion mark-motion--float ${className}`} style={{ opacity }}>
        {/* back screen */}
        <rect x="14" y="5" width="14" height="9" stroke={color} strokeWidth="1.25" opacity="0.55" />
        {/* middle screen */}
        <rect x="9" y="10" width="14" height="9" stroke={color} strokeWidth="1.5" opacity="0.8" />
        {/* front screen */}
        <rect x="4" y="15" width="14" height="9" stroke={color} strokeWidth="1.5" />
        {/* traveler path */}
        <path d="M11 24L16 19L20 14L25 9"
            stroke={color} strokeWidth="1.25" strokeLinecap="round"
            strokeDasharray="1.5 2" opacity="0.7" />
        {/* stops */}
        <circle cx="11" cy="24" r="1.2" fill={color} />
        <circle cx="16" cy="19" r="1" fill={color} opacity="0.85" />
        <circle cx="20" cy="14" r="0.9" fill={color} opacity="0.7" />
        <circle cx="25" cy="9" r="1.1" fill={color} />
    </svg>
);
