import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const GridMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
            <rect x="3" y="3" width="8" height="8" rx="1" fill={color} />
            <rect x="13" y="3" width="8" height="8" rx="1" fill={color} opacity="0.7" />
            <rect x="3" y="13" width="8" height="8" rx="1" fill={color} opacity="0.7" />
            <rect x="13" y="13" width="8" height="8" rx="1" fill={color} opacity="0.4" />
        </svg>
    );
};
