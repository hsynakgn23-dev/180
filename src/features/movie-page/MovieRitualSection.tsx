import { useState } from 'react';
import { submitMovieRitual } from '../../lib/movieApi';
import { useProgression } from '../../context/ProgressionContext';

const SAGE = '#8A9A5B';
const MAX_CHARS = 180;
const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface MovieRitualSectionProps {
  poolMovieId: string;
  movieTitle: string;
  onRitualSubmitted?: () => void;
}

export function MovieRitualSection({ poolMovieId, movieTitle, onRitualSubmitted }: MovieRitualSectionProps) {
  const { state, updateState, tryUnlockMark } = useProgression();
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const progress = text.length / MAX_CHARS;
  const canSubmit = text.trim().length > 0 && rating > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (rating === 0) { setError('Bir puan seç'); return; }
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

  return (
    <div className="px-4 sm:px-8 py-8 border-t border-white/5">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[11px] font-bold tracking-[0.3em] uppercase" style={{ color: SAGE }}>Rituals</span>
          <span className="text-[11px] text-white/35 italic">180 characters at a time</span>
        </div>
      </div>

      {/* Write box */}
      {submitted ? (
        <div className="rounded-2xl border px-6 py-5 text-center mb-8"
          style={{ background: 'rgba(138,154,91,0.05)', borderColor: 'rgba(138,154,91,0.2)' }}>
          <div className="text-sm font-medium mb-1" style={{ color: SAGE }}>Ritual kaydedildi ✓</div>
          <div className="text-xs text-white/25">+15 XP kazandın</div>
        </div>
      ) : (
        <div className="rounded-2xl border px-6 py-5 mb-8 transition-all duration-200"
          style={{
            background: 'linear-gradient(180deg, #181818, #141414)',
            borderColor: 'rgba(138,154,91,0.15)',
            boxShadow: '0 0 30px -10px rgba(138,154,91,0.08)'
          }}>
          <div className="flex gap-4">
            {/* Avatar placeholder */}
            <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-[13px]"
              style={{ background: SAGE, color: '#121212' }}>
              {state.username ? state.username.slice(0, 2).toUpperCase() : 'YO'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[11px] italic mb-2.5" style={{ color: 'rgba(138,154,91,0.65)' }}>
                Your ritual note · {movieTitle}
              </div>

              {/* Text area */}
              <textarea
                value={text}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setText(e.target.value);
                    if (error) setError('');
                  }
                }}
                placeholder="What moved you?"
                className="w-full bg-transparent text-base text-white/60 font-light placeholder-white/20 outline-none resize-none min-h-[44px] border-b border-white/8 pb-3"
                rows={2}
                aria-label="Ritual metni"
              />

              {/* Progress bar */}
              <div className="flex items-center gap-3 mt-3.5">
                <div className="flex-1 h-0.5 rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${progress * 100}%`,
                      background: progress > 0.9 ? '#A57164' : SAGE
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] tracking-[0.18em] text-white/35">
                  {text.length}/{MAX_CHARS}
                </span>
              </div>

              {error && (
                <div className="text-xs text-clay/70 mt-2">{error}</div>
              )}

              {/* Rating + submit */}
              <div className="flex items-center justify-between mt-4 sm:mt-5">
                <div className="flex gap-1.5 flex-wrap">
                  {RATINGS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setRating(n); setError(''); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all duration-150"
                      style={{
                        background: rating === n ? SAGE : 'rgba(255,255,255,0.05)',
                        color: rating === n ? '#121212' : '#8e8b84',
                        transform: rating === n ? 'scale(1.1)' : 'scale(1)',
                      }}
                      aria-label={`${n} puan`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-7 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase rounded-full transition-all duration-200"
                  style={{
                    background: canSubmit ? '#2C2C2C' : '#1a1a1a',
                    color: canSubmit ? 'white' : 'rgba(255,255,255,0.25)',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    opacity: canSubmit ? 1 : 0.4,
                  }}
                >
                  {submitting ? '…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
