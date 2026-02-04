import React, { useEffect } from 'react';

interface LeagueTransitionProps {
    color: string;
    leagueName: string;
    onComplete: () => void;
}

export const LeagueTransition: React.FC<LeagueTransitionProps> = ({ color, leagueName, onComplete }) => {

    useEffect(() => {
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-fade-in-out"
            style={{ backgroundColor: color }}
        >
            <div className="text-center mix-blend-difference text-white">
                <h2 className="text-4xl md:text-6xl font-bold tracking-[0.3em] uppercase animate-scale-slow">
                    {leagueName}
                </h2>
            </div>
        </div>
    );
};
