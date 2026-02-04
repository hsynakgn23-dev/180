import React, { useState } from 'react';
import { MOCK_ARENA_RITUALS } from '../../data/mockArena';
import { RitualCard } from './RitualCard';

export const Arena: React.FC = () => {
    // In a real app, we'd fetch rituals based on the current Daily 5 movies.
    // For now, we use the mock data.
    const [rituals] = useState(MOCK_ARENA_RITUALS);
    const [filter, setFilter] = useState<'memory' | 'today'>('memory');

    const filteredRituals = rituals.filter(r => {
        if (filter === 'memory') return true;
        // Mock logic: 'Today' excludes '1d ago' etc.
        return !r.timestamp.includes('d ago');
    });

    return (
        <section className="max-w-3xl mx-auto px-6 mb-32 animate-slide-up">
            {/* Header */}
            <div className="flex flex-col items-center mb-12 opacity-60">
                <div className="w-px h-12 bg-sage/20 mb-4" />
                <h2 className="text-xs font-bold tracking-[0.3em] text-sage uppercase">
                    The Arena
                </h2>

                {/* Timeline Filters */}
                <div className="flex gap-6 mt-4 border-b border-sage/10 pb-2">
                    <button
                        onClick={() => setFilter('memory')}
                        className={`text-[10px] uppercase tracking-widest transition-colors ${filter === 'memory' ? 'text-sage font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Memory
                    </button>
                    <button
                        onClick={() => setFilter('today')}
                        className={`text-[10px] uppercase tracking-widest transition-colors ${filter === 'today' ? 'text-sage font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* Feed */}
            <div className="flex flex-col">
                {filteredRituals.map(ritual => (
                    <RitualCard key={ritual.id} ritual={ritual} />
                ))}
            </div>

            {/* Footer / End of Feed */}
            <div className="mt-12 text-center">
                <span className="text-[10px] tracking-[0.2em] text-[#E5E4E2]/20 uppercase">
                    End of Echoes
                </span>
            </div>
        </section>
    );
};
