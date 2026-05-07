import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const FilmExaminerMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
        className={`mark-motion mark-motion--signal ${className}`} style={{ opacity }}>
        {/* film strip */}
        <rect x="22" y="4" width="6" height="24" stroke={color} strokeWidth="1" opacity="0.45" />
        <line x1="22" y1="9" x2="28" y2="9" stroke={color} strokeWidth="1" opacity="0.45" />
        <line x1="22" y1="16" x2="28" y2="16" stroke={color} strokeWidth="1" opacity="0.45" />
        <line x1="22" y1="23" x2="28" y2="23" stroke={color} strokeWidth="1" opacity="0.45" />
        {/* loupe */}
        <circle cx="13" cy="14" r="8" stroke={color} strokeWidth="1.75" />
        {/* inner reticle */}
        <circle cx="13" cy="14" r="3.5" stroke={color} strokeWidth="1" opacity="0.5" />
        {/* crosshair */}
        <line x1="13" y1="11.5" x2="13" y2="16.5" stroke={color} strokeWidth="1" opacity="0.5" />
        <line x1="10.5" y1="14" x2="15.5" y2="14" stroke={color} strokeWidth="1" opacity="0.5" />
        {/* center dot */}
        <circle cx="13" cy="14" r="1" fill={color} />
        {/* handle */}
        <path d="M19 20L25 26" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
);
