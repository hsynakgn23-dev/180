import React from 'react';

interface IconProps {
    color?: string; // Default to Sage #8A9A5B or Clay #A57164 passed from parent
    size?: number;
    className?: string;
    opacity?: number;
}

export const HexagonMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
                d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
                fill={color}
                stroke="currentColor"
                strokeWidth="0" // Filled style as requested by "parlasın" (glow/color)
            />
            {/* Optional internal detail for "Architect" look */}
            <path
                d="M12 5L18 8.5V15.5L12 19L6 15.5V8.5L12 5Z"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.2"
                fill="none"
            />
        </svg>
    );
};
