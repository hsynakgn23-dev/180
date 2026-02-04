export const MarkIcons = {
    Pentagon: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2L2 9L5 21H19L22 9L12 2Z" />
        </svg>
    ),
    Hexagon: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
        </svg>
    ),
    Triangle: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2L22 20H2L12 2Z" />
        </svg>
    ),
    Diamond: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2L22 12L12 22L2 12L12 2Z" />
        </svg>
    ),
    Echo: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path d="M12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4" strokeLinecap="round" />
            <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8" strokeLinecap="round" />
        </svg>
    ),
    Circle: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <circle cx="12" cy="12" r="10" />
        </svg>
    ),
    Square: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
    ),
    NestedSquare: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <rect x="8" y="8" width="8" height="8" rx="1" />
        </svg>
    ),
    Star: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
    ),
    Key: ({ size = 16, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M7 11C7.55228 11 8 11.4477 8 12C8 12.5523 7.55228 13 7 13C6.44772 13 6 12.5523 6 12C6 11.4477 6.44772 11 7 11Z" fill="white" /> {/* Hole */}
            <path fillRule="evenodd" clipRule="evenodd" d="M7 15C8.65685 15 10 13.6569 10 12C10 10.3431 8.65685 9 7 9C5.34315 9 4 10.3431 4 12C4 13.6569 5.34315 15 7 15ZM12.7071 9.29289C12.3166 9.68342 12.3166 10.3166 12.7071 10.7071L14 12L12.7071 13.2929C12.3166 13.6834 12.3166 14.3166 12.7071 14.7071C13.0976 15.0976 13.7308 15.0976 14.1213 14.7071L16.1213 12.7071C16.5118 12.3166 16.5118 11.6834 16.1213 11.2929L14.1213 9.29289C13.7308 8.90237 13.0976 8.90237 12.7071 9.29289Z" />
            <path d="M12 12L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
};
