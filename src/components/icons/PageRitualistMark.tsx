import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const PageRitualistMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
        className={`mark-motion mark-motion--pulse ${className}`} style={{ opacity }}>
        {/* film frame */}
        <rect x="6" y="9" width="20" height="14" rx="1" stroke={color} strokeWidth="1.5" />
        {/* perforations top */}
        <circle cx="9" cy="11.5" r="0.7" fill={color} />
        <circle cx="13" cy="11.5" r="0.7" fill={color} />
        <circle cx="19" cy="11.5" r="0.7" fill={color} />
        <circle cx="23" cy="11.5" r="0.7" fill={color} />
        {/* perforations bottom */}
        <circle cx="9" cy="20.5" r="0.7" fill={color} />
        <circle cx="13" cy="20.5" r="0.7" fill={color} />
        <circle cx="19" cy="20.5" r="0.7" fill={color} />
        <circle cx="23" cy="20.5" r="0.7" fill={color} />
        {/* ink line */}
        <path d="M9 19L21 13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        {/* nib */}
        <path d="M21 13L24 12.2L23 14.5L21 13Z" fill={color} />
        {/* ink drop */}
        <circle cx="9" cy="19" r="1.1" fill={color} />
    </svg>
);
