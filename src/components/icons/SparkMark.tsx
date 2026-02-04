import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const SparkMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                fill={color}
            />
            <circle cx="12" cy="12" r="2" fill="white" fillOpacity="0.3" />
        </svg>
    );
};
