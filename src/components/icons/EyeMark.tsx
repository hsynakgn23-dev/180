import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const EyeMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            <circle cx="12" cy="12" r="3" fill={color} />
        </svg>
    );
};
