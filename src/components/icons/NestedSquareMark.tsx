import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const NestedSquareMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
            {/* Outer Square */}
            <rect x="2" y="2" width="20" height="20" rx="2" fill={color} />

            {/* Inner Square (Hollow effect or lighter color) */}
            <rect x="7" y="7" width="10" height="10" rx="1" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />

            {/* Center dot/square */}
            <rect x="10.5" y="10.5" width="3" height="3" fill="white" fillOpacity="0.4" />
        </svg>
    );
};
