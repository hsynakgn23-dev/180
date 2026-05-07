import { useState } from 'react';
import { submitMovieRitual } from '../../lib/movieApi';
import { useProgression } from '../../context/ProgressionContext';

interface MovieRitualSectionProps {
  poolMovieId: string;
  movieTitle: string;
  onRitualSubmitted?: () => void;
}

const STARS = [1, 2, 3, 4, 5] as const;
const MAX_CHARS = 180;

export function MovieRitualSection({ poolMovieId, movieTitle, onRitualSubmitted }: MovieRitualSectionProps) {
  const { state, updateState, tryUnlockMark } = useProgression();
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const charsLeft = MAX_CHARS - text.length;

  const handleSubmit = async () => {
    if (text.trim().length === 0) return;
    if (rating === 0) {
      setError('Puan seçmeden ritual yazamazsın.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitMovieRitual(poolMovieId, text.trim(), rating);
      setSubmitted(true);
      setText('');
      setRating(0);
      onRitualSubmitted?.();
      // Update local XPState for mark unlocking
      const nextCount = (typeof state.movieRitualsWritten === 'number' ? state.movieRitualsWritten : 0) + 1;
      const nextMarks = nextCount >= 1
        ? tryUnlockMark('page_ritualist', state.marks)
        : state.marks;
      updateState({ movieRitualsWritten: nextCount, marks: nextMarks });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gönderilemedi';
      if (msg.includes('Already wrote')) {
        setError('Bu film için bugün zaten ritual yazdın.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="px-4 sm:px-6 py-6 border-t border-white/5">
        <div className="rounded-xl border border-sage/20 bg-sage/5 px-5 py-4 text-center">
          <div className="text-sage text-sm mb-1">Ritual kaydedildi ✓</div>
          <div className="text-white/30 text-xs">+15 XP kazandın</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 border-t border-white/5">
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-4">
        Bu Film İçin Ritual Yaz
      </h2>

      {/* Star rating */}
      <div className="flex items-center gap-1 mb-4">
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => { setRating(star); setError(''); }}
            className="text-2xl transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${star} yıldız`}
          >
            <span className={star <= (hoveredStar || rating) ? 'text-sage' : 'text-white/15'}>★</span>
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-xs text-white/30">{rating}/5</span>
        )}
      </div>

      {/* Text area */}
      <div className="relative mb-3">
        <textarea
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) {
              setText(e.target.value);
              if (error) setError('');
            }
          }}
          placeholder={`${movieTitle} hakkında ne düşünüyorsun?`}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none focus:border-sage/30 focus:bg-white/8 transition-all resize-none min-h-[100px]"
          aria-label="Ritual metni"
        />
        <div className={`absolute bottom-2 right-3 text-[10px] ${charsLeft < 20 ? 'text-clay/60' : 'text-white/20'}`}>
          {charsLeft}
        </div>
      </div>

      {error && (
        <div className="text-xs text-clay/80 mb-3">{error}</div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || text.trim().length === 0}
        className="rounded-xl border border-sage/30 bg-sage/10 px-5 py-2.5 text-sm text-sage hover:bg-sage/20 hover:border-sage/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Gönderiliyor…
          </>
        ) : 'Ritual Gönder'}
      </button>
    </div>
  );
}
