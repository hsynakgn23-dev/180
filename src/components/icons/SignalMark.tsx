import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const SignalMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M12 20C12 20 16 16 16 12C16 8 12 4 12 4"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M8 20C8 20 12 16 12 12C12 8 8 4 8 4"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M4 16C4 16 6 14 6 12C6 10 4 8 4 8"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.5"
            />
            <path
                d="M20 16C20 16 18 14 18 12C18 10 20 8 20 8"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.5"
            />
        </svg>
    );
};
