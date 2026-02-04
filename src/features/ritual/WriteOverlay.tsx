import React, { useState } from 'react';
import type { Movie } from '../../data/mockMovies';
import { useXP } from '../../context/XPContext';

interface WriteOverlayProps {
    movie: Movie;
    onClose: () => void;
}

export const WriteOverlay: React.FC<WriteOverlayProps> = ({ movie, onClose }) => {
    const { submitRitual } = useXP();
    const [text, setText] = useState('');
    const [rating, setRating] = useState(0);

    const MAX_CHARS = 180;
    const charsLeft = MAX_CHARS - text.length;

    const handleSubmit = () => {
        if (text.length === 0) return;
        submitRitual(movie.id, text, rating, movie.genre);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#121212] flex items-center justify-center animate-fade-in p-6">
            <div className="max-w-xl w-full">

                {/* Header (Minimal) */}
                <div className="mb-12 text-center opacity-80">
                    <h3 className="text-sm font-serif italic text-sage/60 mb-2">The Ritual</h3>
                    <h2 className="text-3xl font-serif text-[#E5E4E2]">{movie.title}</h2>
                </div>

                {/* Input Area */}
                <div className="relative mb-8">
                    <textarea
                        autoFocus
                        value={text}
                        onChange={(e) => {
                            if (e.target.value.length <= MAX_CHARS) {
                                setText(e.target.value);
                            }
                        }}
                        placeholder="Log your thoughts..."
                        className="w-full h-48 bg-transparent text-xl md:text-2xl font-serif text-[#E5E4E2] placeholder:text-gray-600 resize-none outline-none border-b border-white/10 focus:border-sage/50 transition-colors text-center"
                    />

                    {/* Char Counter (The Ritual Counter) */}
                    <div className={`absolute -bottom-8 right-0 text-xs font-mono tracking-widest transition-all duration-300 ${charsLeft <= 10 ? 'text-sage font-bold drop-shadow-[0_0_8px_rgba(138,154,91,0.5)] animate-pulse' : 'text-gray-500'}`}>
                        {charsLeft}
                    </div>
                </div>

                {/* Rating Scale (1-10) */}
                <div className="flex justify-center gap-2 mb-12">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                            key={num}
                            onClick={() => setRating(num)}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${rating >= num
                                ? 'bg-sage text-[#121212] scale-110'
                                : 'bg-white/5 text-gray-500 hover:bg-white/10'
                                }`}
                        >
                            {num}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex justify-center gap-6">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-400 hover:text-gray-600 text-sm tracking-widest uppercase transition-colors"
                    >
                        Abandon
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={text.length === 0}
                        className="px-8 py-2 bg-[#2C2C2C] text-white text-sm tracking-widest uppercase rounded-full hover:bg-sage disabled:opacity-20 disabled:hover:bg-[#2C2C2C] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                    >
                        Record
                    </button>
                </div>

            </div>
        </div>
    );
};
