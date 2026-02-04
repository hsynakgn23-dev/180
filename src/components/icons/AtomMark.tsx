import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const AtomMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ opacity }}
        >
            <circle cx="12" cy="12" r="2" fill={color} />
            <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(45 12 12)" stroke={color} strokeWidth="1.5" />
            <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(-45 12 12)" stroke={color} strokeWidth="1.5" />
        </svg>
    );
};
