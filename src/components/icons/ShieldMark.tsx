import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const ShieldMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
                fill={color}
                stroke={color}
                strokeWidth="1"
            />
            <path
                d="M12 6L12 18"
                stroke="white"
                strokeWidth="2"
                strokeOpacity="0.2"
                strokeLinecap="round"
            />
        </svg>
    );
};
