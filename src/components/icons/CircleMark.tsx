import React from 'react';

interface IconProps {
    color?: string;
    size?: number;
    className?: string;
    opacity?: number;
}

export const CircleMark: React.FC<IconProps> = ({ color = "currentColor", size = 24, className = "", opacity = 1 }) => {
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
            <circle cx="12" cy="12" r="10" fill={color} />
            <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="1" strokeOpacity="0.2" fill="none" />
        </svg>
    );
};
