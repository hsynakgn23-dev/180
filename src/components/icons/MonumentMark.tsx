import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const MonumentMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
            <path
                d="M8 22H16L14 2H10L8 22Z"
                fill={color}
            />
            <path
                d="M12 2V22"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.3"
            />
            {/* Base */}
            <rect x="6" y="21" width="12" height="2" fill={color} />
        </svg>
    );
};
