import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const DiamondMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M12 2L22 12L12 22L2 12L12 2Z"
                fill={color}
            />
            {/* Inner detail */}
            <path
                d="M12 6L18 12L12 18L6 12L12 6Z"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.2"
                fill="none"
            />
        </svg>
    );
};
