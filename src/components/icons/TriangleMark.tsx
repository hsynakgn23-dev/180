import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const TriangleMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M12 3L22 20H2L12 3Z"
                fill={color}
            />
            {/* Inner line */}
            <path
                d="M12 7L18 17H6L12 7Z"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.2"
                fill="none"
            />
        </svg>
    );
};
