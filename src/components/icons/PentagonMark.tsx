import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const PentagonMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M12 2L21.5 8.9L17.9 21H6.1L2.5 8.9L12 2Z"
                fill={color}
            />
            {/* Inner detail */}
            <path
                d="M12 5.5L18 9.8L15.7 17.5H8.3L6 9.8L12 5.5Z"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.2"
                fill="none"
            />
        </svg>
    );
};
