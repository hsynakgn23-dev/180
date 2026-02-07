import React from 'react';
import { useXP } from '../../context/XPContext';

export const DebugPanel: React.FC = () => {
    const { debugAddXP, debugUnlockMark, receiveEcho } = useXP();
    const [isOpen, setIsOpen] = React.useState(false);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-red-900/50 text-xs text-white p-2 rounded opacity-50 hover:opacity-100 z-50"
            >
                DEBUG
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 bg-black/90 border border-white/20 p-4 rounded-lg z-50 w-64 text-xs font-mono">
            <div className="flex justify-between items-center mb-4">
                <span className="text-sage">DEBUG CONTROL</span>
                <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white">X</button>
            </div>

            <div className="space-y-2">
                <button onClick={() => debugAddXP(100)} className="w-full bg-white/10 hover:bg-white/20 p-2 rounded text-left">
                    +100 XP
                </button>
                <button onClick={() => receiveEcho()} className="w-full bg-white/10 hover:bg-white/20 p-2 rounded text-left">
                    Trigger: Receive Echo
                </button>

                <div className="border-t border-white/10 my-2 pt-2">
                    <div className="text-white/50 mb-1">Unlock Marks</div>
                    <button onClick={() => debugUnlockMark('180_exact')} className="w-full bg-sage/20 hover:bg-sage/30 p-1 mb-1 rounded text-sage">
                        Unlock 180 Exact
                    </button>
                    <button onClick={() => debugUnlockMark('no_rush')} className="w-full bg-sage/20 hover:bg-sage/30 p-1 mb-1 rounded text-sage">
                        Unlock No Rush
                    </button>
                    <button onClick={() => debugUnlockMark('wide_lens')} className="w-full bg-sage/20 hover:bg-sage/30 p-1 mb-1 rounded text-sage">
                        Unlock Wide Lens
                    </button>
                </div>
            </div>
        </div>
    );
};

