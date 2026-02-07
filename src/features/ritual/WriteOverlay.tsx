import React, { useState } from 'react';
import type { Movie } from '../../data/mockMovies';
import { useXP } from '../../context/XPContext';

interface WriteOverlayProps {
    movie: Movie;
    onClose: () => void;
}

export const WriteOverlay: React.FC<WriteOverlayProps> = ({ movie, onClose }) => {
    const { submitRitual, isControlMode } = useXP();
    const [text, setText] = useState('');
    const [rating, setRating] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');

    const MAX_CHARS = 180;
    const charsLeft = MAX_CHARS - text.length;

    const handleSubmit = () => {
        if (text.length === 0) return;
        if (isControlMode) {
            setErrorMessage('Control mode salt-okunur. Ritual kaydi gonderemezsin.');
            return;
        }
        submitRitual(movie.id, text, rating, movie.genre, movie.title, movie.posterPath);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#121212] flex items-center justify-center animate-fade-in p-4 sm:p-6">
            <div className="max-w-xl w-full rounded-2xl border border-white/10 bg-[#121212]/95 px-4 sm:px-8 py-6 sm:py-8">

                {/* Header (Minimal) */}
                <div className="mb-7 sm:mb-12 text-center opacity-80">
                    <h3 className="text-sm italic text-sage/60 mb-2">The Ritual</h3>
                    <h2 className="text-2xl sm:text-3xl text-[#E5E4E2]">{movie.title}</h2>
                </div>

                {/* Input Area */}
                <div className="relative mb-6 sm:mb-8">
                    <textarea
                        autoFocus
                        value={text}
                        onChange={(e) => {
                            if (errorMessage) {
                                setErrorMessage('');
                            }
                            if (e.target.value.length <= MAX_CHARS) {
                                setText(e.target.value);
                            }
                        }}
                        placeholder="Log your thoughts..."
                        className="w-full h-40 sm:h-48 bg-transparent text-lg sm:text-xl md:text-2xl text-[#E5E4E2] placeholder:text-gray-600 resize-none outline-none border-b border-white/10 focus:border-sage/50 transition-colors text-left sm:text-center px-1"
                    />

                    {/* Char Counter (The Ritual Counter) */}
                    {/* Progress Bar & Counter */}
                    <div className="flex items-center justify-between mt-4 px-1">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden mr-4">
                            <div
                                className={`h-full transition-all duration-300 ease-out ${charsLeft < 20 ? 'bg-red-500' : 'bg-sage'}`}
                                style={{ width: `${(text.length / MAX_CHARS) * 100}%` }}
                            />
                        </div>
                        <div className={`text-xs font-mono tracking-widest transition-all duration-300 ${charsLeft <= 10 ? 'text-red-500 font-bold shake' : 'text-gray-500'}`}>
                            {text.length}/{MAX_CHARS}
                        </div>
                    </div>
                </div>

                {/* Rating Scale (1-10) */}
                <div className="grid grid-cols-5 sm:flex sm:justify-center gap-2 mb-8 sm:mb-12">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                            key={num}
                            onClick={() => setRating(num)}
                            className={`w-full sm:w-8 h-8 rounded-lg sm:rounded-full text-xs font-bold transition-all ${rating >= num
                                ? 'bg-sage text-[#121212] sm:scale-110'
                                : 'bg-white/5 text-gray-500 hover:bg-white/10'
                                }`}
                        >
                            {num}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 sm:gap-6">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2 text-gray-400 hover:text-gray-600 text-sm tracking-widest uppercase transition-colors"
                    >
                        Abandon
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={text.length === 0 || isControlMode}
                        className="w-full sm:w-auto px-8 py-2 bg-[#2C2C2C] text-white text-sm tracking-widest uppercase rounded-full hover:bg-sage disabled:opacity-20 disabled:hover:bg-[#2C2C2C] transition-all shadow-lg hover:shadow-xl sm:hover:-translate-y-1"
                    >
                        Record
                    </button>
                </div>
                {errorMessage && (
                    <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-red-300/85 text-center">
                        {errorMessage}
                    </p>
                )}

            </div>
        </div>
    );
};
