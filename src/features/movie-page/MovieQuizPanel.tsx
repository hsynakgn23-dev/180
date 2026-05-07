import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchPoolQuiz,
  submitPoolAnswer,
  type PoolOptionKey,
  type PoolQuestion,
  type PoolLanguageCode,
} from '../../lib/poolQuizApi';

interface MovieQuizPanelProps {
  poolMovieId: string;
  movieTitle: string;
}

type AnswerState = {
  selected: PoolOptionKey;
  correct: PoolOptionKey;
  isCorrect: boolean;
  explanation: string;
  xpEarned: number;
} | null;

const LANG_MAP: Record<string, PoolLanguageCode> = {
  tr: 'tr',
  en: 'en',
  es: 'es',
  fr: 'fr',
};

const OPTION_LABELS: PoolOptionKey[] = ['a', 'b', 'c', 'd'];

export function MovieQuizPanel({ poolMovieId, movieTitle }: MovieQuizPanelProps) {
  const { language } = useLanguage();
  const lang: PoolLanguageCode = LANG_MAP[language] ?? 'en';

  const [questions, setQuestions] = useState<PoolQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setQuestions([]);
    setCurrentIdx(0);
    setAnswerState(null);
    setTotalCorrect(0);
    setTotalXp(0);
    setFinished(false);

    fetchPoolQuiz(poolMovieId, lang).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setQuestions(res.questions);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [poolMovieId, lang]);

  const current = questions[currentIdx];

  const handleAnswer = async (option: PoolOptionKey) => {
    if (!current || submitting || answerState) return;
    setSubmitting(true);
    const res = await submitPoolAnswer({
      movie_id: poolMovieId,
      question_id: current.id,
      selected_option: option,
      language: lang,
    });
    setSubmitting(false);
    if (!res.ok) return;
    setAnswerState({
      selected: option,
      correct: res.correct_option,
      isCorrect: res.is_correct,
      explanation: res.explanation,
      xpEarned: res.xp_earned + res.bonus_xp,
    });
    if (res.is_correct) setTotalCorrect((n) => n + 1);
    setTotalXp((n) => n + res.xp_earned + res.bonus_xp);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setAnswerState(null);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6 border-t border-white/5">
        <div className="h-4 w-24 bg-white/5 rounded animate-pulse mb-4" />
        <div className="h-16 bg-white/5 rounded-xl animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) return null;

  if (finished) {
    return (
      <div className="px-4 sm:px-6 py-6 border-t border-white/5">
        <div className="rounded-xl border border-sage/20 bg-sage/5 px-5 py-5 text-center">
          <div className="text-sage text-sm font-medium mb-1">
            {totalCorrect}/{questions.length} doğru
          </div>
          {totalXp > 0 && (
            <div className="text-white/30 text-xs">+{totalXp} XP kazandın</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 border-t border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/30">
          {movieTitle} — Quiz
        </h2>
        <span className="text-[10px] text-white/20">
          {currentIdx + 1}/{questions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-px bg-white/5 mb-5 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage/40 transition-all duration-500"
          style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-sm text-white/80 leading-relaxed mb-5">{current.question}</p>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2 mb-4">
        {current.options.map((opt) => {
          let cls =
            'w-full text-left rounded-xl border px-4 py-3 text-sm transition-all duration-200 ';
          if (!answerState) {
            cls += 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8 hover:border-white/20';
          } else if (opt.key === answerState.correct) {
            cls += 'border-sage/50 bg-sage/10 text-sage';
          } else if (opt.key === answerState.selected && !answerState.isCorrect) {
            cls += 'border-clay/40 bg-clay/10 text-clay/80';
          } else {
            cls += 'border-white/5 bg-white/3 text-white/30';
          }
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleAnswer(opt.key)}
              disabled={!!answerState || submitting}
              className={cls}
            >
              <span className="text-white/30 mr-2 text-[10px] uppercase">{opt.key}.</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {answerState && (
        <div className="mb-4">
          <div className={`text-xs mb-1 font-medium ${answerState.isCorrect ? 'text-sage' : 'text-clay/80'}`}>
            {answerState.isCorrect ? `Doğru! +${answerState.xpEarned} XP` : 'Yanlış'}
          </div>
          {answerState.explanation && (
            <p className="text-xs text-white/40 leading-relaxed">{answerState.explanation}</p>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
          >
            {currentIdx + 1 >= questions.length ? 'Bitir' : 'Sonraki →'}
          </button>
        </div>
      )}

      {/* Option labels hint */}
      {!answerState && !submitting && (
        <div className="flex gap-1 mt-1">
          {OPTION_LABELS.map((k) => (
            <span key={k} className="text-[8px] text-white/10 uppercase">{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
