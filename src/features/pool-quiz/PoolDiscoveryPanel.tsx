import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    fetchPoolMovies,
    fetchPoolQuiz,
    submitPoolSwipe,
    submitPoolAnswer,
    type PoolMovie,
    type PoolQuestion,
    type PoolOptionKey,
    type PoolLanguageCode,
} from '../../lib/poolQuizApi';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const QUESTION_TIME = 15;

const COPY: Record<PoolLanguageCode, {
    title: string; sub: string; noMovies: string; takeQuiz: string; skip: string;
    correct: string; wrong: string; next: string; finish: string; xp: string; back: string;
    of: string; loading: string; timeUp: string; score: string;
    doğru: string; yanlış: string; başarı: string;
}> = {
    tr: { title: 'Film Keşfet', sub: 'Sağ kaydır — quiz çöz', noMovies: 'Film bulunamadı.', takeQuiz: 'Quiz Çöz', skip: 'Geç', correct: 'Doğru', wrong: 'Yanlış', next: 'Sonraki', finish: 'Bitir', xp: 'XP', back: 'Kapat', of: '/', loading: 'Yükleniyor...', timeUp: 'Süre doldu!', score: 'Skorun', doğru: 'Doğru', yanlış: 'Yanlış', başarı: 'Başarı' },
    en: { title: 'Discover Films', sub: 'Swipe right — take quiz', noMovies: 'No movies found.', takeQuiz: 'Take Quiz', skip: 'Skip', correct: 'Correct', wrong: 'Wrong', next: 'Next', finish: 'Finish', xp: 'XP', back: 'Close', of: '/', loading: 'Loading...', timeUp: "Time's up!", score: 'Your Score', doğru: 'Correct', yanlış: 'Wrong', başarı: 'Success' },
    es: { title: 'Descubrir', sub: 'Desliza — haz quiz', noMovies: 'No se encontraron películas.', takeQuiz: 'Hacer Quiz', skip: 'Saltar', correct: 'Correcto', wrong: 'Incorrecto', next: 'Siguiente', finish: 'Terminar', xp: 'XP', back: 'Cerrar', of: '/', loading: 'Cargando...', timeUp: '¡Tiempo!', score: 'Tu puntuación', doğru: 'Correcto', yanlış: 'Incorrecto', başarı: 'Éxito' },
    fr: { title: 'Découvrir', sub: 'Glissez — faites le quiz', noMovies: 'Aucun film trouvé.', takeQuiz: 'Faire le Quiz', skip: 'Passer', correct: 'Correct', wrong: 'Incorrect', next: 'Suivant', finish: 'Terminer', xp: 'XP', back: 'Fermer', of: '/', loading: 'Chargement...', timeUp: 'Temps écoulé!', score: 'Votre score', doğru: 'Correct', yanlış: 'Incorrect', başarı: 'Succès' },
};

type Revealed = { selected: PoolOptionKey; isCorrect: boolean; correctKey: PoolOptionKey } | null;

type QuizState =
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'active'; movieId: string; title: string; poster: string | null; questions: PoolQuestion[]; current: number; answers: Map<string, { selected: PoolOptionKey; correct: boolean; explanation: string; correctOption: PoolOptionKey }>; submitting: boolean }
    | { phase: 'result'; title: string; total: number; correct: number; xp: number };

const gradeInfo = (correct: number, total: number) => {
    const pct = total > 0 ? correct / total : 0;
    if (pct >= 0.8) return { letter: 'S', color: '#facc15', label: '🏆 Mükemmel!' };
    if (pct >= 0.6) return { letter: 'A', color: '#4ade80', label: '🎉 Harika!' };
    if (pct >= 0.4) return { letter: 'B', color: '#60a5fa', label: '👍 İyi İş!' };
    return { letter: 'C', color: '#f87171', label: '💪 Devam Et!' };
};

// ── CSS injected once ──────────────────────────────────────
const QUIZ_STYLES = `
@keyframes pdFlashCorrect {
  0% { opacity: 0; }
  15% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes pdFlashWrong {
  0% { opacity: 0; }
  15% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes pdScalePop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.12); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes pdSlideUp {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes pdFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes pdPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.35); }
  100% { transform: scale(1); }
}
@keyframes pdConfetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-200px) rotate(720deg); opacity: 0; }
}
.pd-flash-correct { animation: pdFlashCorrect 0.9s ease-out forwards; }
.pd-flash-wrong   { animation: pdFlashWrong 0.9s ease-out forwards; }
.pd-circle-pop    { animation: pdScalePop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.pd-slide-up      { animation: pdSlideUp 0.4s ease-out forwards; }
.pd-fade-in       { animation: pdFadeIn 0.3s ease-out forwards; }
.pd-score-pulse   { animation: pdPulse 0.35s ease-out; }
.pd-option-btn    { transition: transform 0.08s ease, box-shadow 0.08s ease; }
.pd-option-btn:active { transform: scale(0.96) !important; }
`;

let styleInjected = false;
const injectStyles = () => {
    if (styleInjected) return;
    styleInjected = true;
    const s = document.createElement('style');
    s.textContent = QUIZ_STYLES;
    document.head.appendChild(s);
};

// ── Timer Bar ──────────────────────────────────────────────
const TimerBar: React.FC<{ timeLeft: number; total: number; pulse?: boolean }> = ({ timeLeft, total, pulse }) => {
    const pct = timeLeft / total;
    const color = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#ef4444';
    return (
        <div className={`mb-3 ${pulse ? 'pd-score-pulse' : ''}`}>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct * 100}%`, backgroundColor: color }}
                />
            </div>
            <div className="flex justify-end mt-1">
                <span className="text-xs font-mono font-bold" style={{ color }}>{timeLeft}s</span>
            </div>
        </div>
    );
};

// ── Option Button ──────────────────────────────────────────
const OptionBtn: React.FC<{
    opt: { key: PoolOptionKey; label: string };
    result: 'correct' | 'wrong' | 'reveal' | null;
    disabled: boolean;
    onClick: () => void;
}> = ({ opt, result, disabled, onClick }) => {
    const borderColor =
        result === 'correct' ? '#4ade80' :
        result === 'wrong'   ? '#f87171' :
        result === 'reveal'  ? '#4ade80' :
        'rgba(255,255,255,0.08)';

    const bgColor =
        result === 'correct' ? 'rgba(74,222,128,0.18)' :
        result === 'wrong'   ? 'rgba(248,113,113,0.18)' :
        result === 'reveal'  ? 'rgba(74,222,128,0.10)' :
        'rgba(255,255,255,0.03)';

    const badgeBg =
        result === 'correct' ? '#4ade80' :
        result === 'wrong'   ? '#f87171' :
        result === 'reveal'  ? 'rgba(74,222,128,0.5)' :
        'rgba(255,255,255,0.10)';

    const badgeText = result === 'correct' || result === 'reveal' ? '✓' : result === 'wrong' ? '✗' : opt.key.toUpperCase();
    const badgeColor = result === 'correct' || result === 'wrong' ? '#0a0a0a' : result === 'reveal' ? '#4ade80' : '#999';

    return (
        <button
            className="pd-option-btn w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-left cursor-pointer border"
            style={{ borderColor, backgroundColor: bgColor, opacity: disabled && !result ? 0.45 : 1 }}
            disabled={disabled}
            onClick={onClick}
        >
            <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all duration-200"
                style={{ backgroundColor: badgeBg, color: badgeColor }}
            >
                {badgeText}
            </span>
            <span className="text-white/90 leading-snug">{opt.label}</span>
        </button>
    );
};

// ── Score Row ──────────────────────────────────────────────
const ScoreRow: React.FC<{ correct: number; wrong: number }> = ({ correct, wrong }) => {
    const prevCorrect = useRef(correct);
    const prevWrong = useRef(wrong);
    const [cpulse, setCpulse] = useState(false);
    const [wpulse, setWpulse] = useState(false);

    useEffect(() => {
        if (correct !== prevCorrect.current) {
            prevCorrect.current = correct;
            setCpulse(true);
            setTimeout(() => setCpulse(false), 400);
        }
    }, [correct]);
    useEffect(() => {
        if (wrong !== prevWrong.current) {
            prevWrong.current = wrong;
            setWpulse(true);
            setTimeout(() => setWpulse(false), 400);
        }
    }, [wrong]);

    return (
        <div className="mt-4 flex items-center justify-center gap-8 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className={`flex items-center gap-2 ${cpulse ? 'pd-score-pulse' : ''}`}>
                <span className="text-lg">✅</span>
                <span className="text-2xl font-black text-emerald-400 tabular-nums">{correct}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className={`flex items-center gap-2 ${wpulse ? 'pd-score-pulse' : ''}`}>
                <span className="text-lg">❌</span>
                <span className="text-2xl font-black text-red-400 tabular-nums">{wrong}</span>
            </div>
        </div>
    );
};

// ── Confetti ───────────────────────────────────────────────
const CONFETTI_COLORS = ['#4ade80', '#facc15', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#f87171'];

const Confetti: React.FC<{ trigger: number }> = ({ trigger }) => {
    const [particles, setParticles] = useState<{ id: number; x: number; color: string; size: number; delay: number }[]>([]);
    const prevTrigger = useRef(0);

    useEffect(() => {
        if (trigger === 0 || trigger === prevTrigger.current) return;
        prevTrigger.current = trigger;
        setParticles(
            Array.from({ length: 22 }, (_, i) => ({
                id: Date.now() + i,
                x: 15 + Math.random() * 70,
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                size: 6 + Math.random() * 7,
                delay: Math.random() * 0.2,
            }))
        );
        setTimeout(() => setParticles([]), 1200);
    }, [trigger]);

    if (!particles.length) return null;
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl" style={{ zIndex: 20 }}>
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-sm"
                    style={{
                        left: `${p.x}%`,
                        bottom: '30%',
                        width: p.size,
                        height: p.size * 1.4,
                        backgroundColor: p.color,
                        animation: `pdConfetti 1s ease-out ${p.delay}s forwards`,
                    }}
                />
            ))}
        </div>
    );
};

// ── Result Screen ──────────────────────────────────────────
const ResultScreen: React.FC<{ title: string; total: number; correct: number; xp: number; onClose: () => void; copy: (typeof COPY)[PoolLanguageCode] }> = ({ total, correct, xp, onClose, copy }) => {
    const grade = gradeInfo(correct, total);
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const [xpDisplay, setXpDisplay] = useState(0);

    useEffect(() => {
        const steps = 30;
        const interval = 800 / steps;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            setXpDisplay(Math.round((xp / steps) * step));
            if (step >= steps) clearInterval(timer);
        }, interval);
        return () => clearInterval(timer);
    }, [xp]);

    return (
        <div className="p-6 flex flex-col items-center text-center">
            {/* Grade circle */}
            <div className="pd-circle-pop mb-2" style={{ animationFillMode: 'both' }}>
                <div
                    className="w-24 h-24 rounded-full border-[3px] flex flex-col items-center justify-center mb-2"
                    style={{ borderColor: grade.color, boxShadow: `0 0 24px ${grade.color}44` }}
                >
                    <span className="text-4xl font-black" style={{ color: grade.color }}>{grade.letter}</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: grade.color }}>{grade.label}</p>
            </div>

            {/* Stats row */}
            <div className="pd-slide-up flex items-center justify-center gap-6 mb-4 mt-4" style={{ animationDelay: '0.35s', animationFillMode: 'both', opacity: 0 }}>
                <div>
                    <p className="text-3xl font-black text-emerald-400 tabular-nums">{correct}</p>
                    <p className="text-xs text-white/40 uppercase tracking-wider mt-0.5">{copy.doğru}</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div>
                    <p className="text-3xl font-black text-red-400 tabular-nums">{total - correct}</p>
                    <p className="text-xs text-white/40 uppercase tracking-wider mt-0.5">{copy.yanlış}</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div>
                    <p className="text-3xl font-black text-yellow-400 tabular-nums">{pct}%</p>
                    <p className="text-xs text-white/40 uppercase tracking-wider mt-0.5">{copy.başarı}</p>
                </div>
            </div>

            {/* XP */}
            <div className="pd-slide-up inline-flex items-center gap-2 bg-white/[0.06] rounded-full px-5 py-2.5 mb-6" style={{ animationDelay: '0.45s', animationFillMode: 'both', opacity: 0 }}>
                <span className="text-yellow-400 text-lg">⚡</span>
                <span className="text-lg font-black text-white/90 tabular-nums">+{xpDisplay}</span>
                <span className="text-sm text-white/50">{copy.xp}</span>
            </div>

            {/* Close button */}
            <div className="pd-slide-up w-full" style={{ animationDelay: '0.55s', animationFillMode: 'both', opacity: 0 }}>
                <button
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: '#8A9A5B' }}
                    onClick={onClose}
                >
                    {copy.back}
                </button>
            </div>
        </div>
    );
};

// ── Main Panel ─────────────────────────────────────────────
export const PoolDiscoveryPanel: React.FC = () => {
    const { language: rawLang } = useLanguage();
    const lang = (rawLang as PoolLanguageCode) || 'en';
    const copy = COPY[lang] || COPY.en;

    const [movies, setMovies] = useState<PoolMovie[]>([]);
    const [loading, setLoading] = useState(true);
    const [idx, setIdx] = useState(0);
    const [quiz, setQuiz] = useState<QuizState>({ phase: 'idle' });
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
    const [revealed, setRevealed] = useState<Revealed>(null);
    const [confettiKey, setConfettiKey] = useState(0);
    const [flashKey, setFlashKey] = useState(0);
    const [flashType, setFlashType] = useState<'correct' | 'wrong' | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { injectStyles(); }, []);

    useEffect(() => {
        setLoading(true);
        fetchPoolMovies({ language: lang, limit: 20 }).then((res) => {
            if (res.ok) setMovies(res.movies);
            setLoading(false);
        });
    }, [lang]);

    // Per-question timer
    useEffect(() => {
        if (quiz.phase !== 'active' || revealed) { timerRef.current && clearInterval(timerRef.current); return; }
        setTimeLeft(QUESTION_TIME);
        timerRef.current = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) {
                    clearInterval(timerRef.current!);
                    // auto-timeout
                    setQuiz((q) => {
                        if (q.phase !== 'active') return q;
                        const cur = q.questions[q.current];
                        if (!cur || q.answers.has(cur.id)) return q;
                        const newAnswers = new Map(q.answers);
                        newAnswers.set(cur.id, { selected: '_timeout' as PoolOptionKey, correct: false, explanation: '', correctOption: 'a' });
                        return { ...q, answers: newAnswers };
                    });
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => { timerRef.current && clearInterval(timerRef.current); };
    }, [quiz.phase, quiz.phase === 'active' ? (quiz as any).current : -1, revealed]);

    const current = movies[idx] ?? null;

    const handleSkip = useCallback(() => {
        if (!current) return;
        void submitPoolSwipe(current.id, 'left');
        setIdx((i) => i + 1);
    }, [current]);

    const handleQuiz = useCallback(async () => {
        if (!current) return;
        void submitPoolSwipe(current.id, 'right');
        setQuiz({ phase: 'loading' });
        const res = await fetchPoolQuiz(current.id, lang);
        if (res.ok) {
            setQuiz({ phase: 'active', movieId: res.movie_id, title: res.title, poster: current.poster_path, questions: res.questions, current: 0, answers: new Map(), submitting: false });
        } else {
            setQuiz({ phase: 'idle' });
        }
    }, [current, lang]);

    const handleAnswer = useCallback(async (questionId: string, selected: PoolOptionKey) => {
        if (quiz.phase !== 'active' || quiz.submitting || quiz.answers.has(questionId) || revealed) return;
        timerRef.current && clearInterval(timerRef.current);
        setQuiz((q) => q.phase === 'active' ? { ...q, submitting: true } : q);

        const res = await submitPoolAnswer({ movie_id: quiz.movieId, question_id: questionId, selected_option: selected, language: lang });
        let isCorrect = false;
        let correctKey: PoolOptionKey = 'a';
        let explanation = '';
        if (res.ok) {
            isCorrect = res.is_correct;
            correctKey = res.correct_option;
            explanation = res.explanation;
        }

        // Flash
        setFlashType(isCorrect ? 'correct' : 'wrong');
        setFlashKey((k) => k + 1);
        if (isCorrect) setConfettiKey((k) => k + 1);

        // Show reveal state for 900ms
        setRevealed({ selected, isCorrect, correctKey });
        setQuiz((q) => q.phase === 'active' ? { ...q, submitting: false } : q);

        revealTimeout.current = setTimeout(() => {
            setRevealed(null);
            setFlashType(null);
            const newAnswers = new Map<string, { selected: PoolOptionKey; correct: boolean; explanation: string; correctOption: PoolOptionKey }>();
            setQuiz((q) => {
                if (q.phase !== 'active') return q;
                const m = new Map(q.answers);
                m.set(questionId, { selected, correct: isCorrect, explanation, correctOption: correctKey });
                return { ...q, answers: m, submitting: false };
            });
        }, 900);
    }, [quiz, lang, revealed]);

    const handleNext = useCallback(() => {
        if (quiz.phase !== 'active') return;
        setQuiz((q) => q.phase === 'active' ? { ...q, current: Math.min(q.current + 1, q.questions.length - 1) } : q);
    }, [quiz.phase]);

    const handleFinish = useCallback(() => {
        if (quiz.phase !== 'active') return;
        timerRef.current && clearInterval(timerRef.current);
        revealTimeout.current && clearTimeout(revealTimeout.current);
        const correctCount = Array.from(quiz.answers.values()).filter((a) => a.correct).length;
        const totalXp = correctCount * 10 + (quiz.questions.length - correctCount) * 2;
        setQuiz({ phase: 'result', title: quiz.title, total: quiz.questions.length, correct: correctCount, xp: totalXp });
        setIdx((i) => i + 1);
    }, [quiz]);

    // ── Result ──
    if (quiz.phase === 'result') {
        return (
            <div className="rounded-2xl bg-[#111] border border-white/[0.07] overflow-hidden">
                <ResultScreen
                    title={quiz.title}
                    total={quiz.total}
                    correct={quiz.correct}
                    xp={quiz.xp}
                    onClose={() => setQuiz({ phase: 'idle' })}
                    copy={copy}
                />
            </div>
        );
    }

    // ── Quiz loading ──
    if (quiz.phase === 'loading') {
        return (
            <div className="rounded-2xl bg-[#111] border border-white/[0.07] p-10 text-center">
                <div className="animate-pulse text-white/40 text-sm">{copy.loading}</div>
            </div>
        );
    }

    // ── Quiz active ──
    if (quiz.phase === 'active') {
        const q = quiz.questions[quiz.current];
        const answer = q ? quiz.answers.get(q.id) : undefined;
        const isAnswered = Boolean(answer);
        const isTimeUp = isAnswered && (answer?.selected as string) === '_timeout';

        const correctCount = Array.from(quiz.answers.values()).filter((a) => a.correct).length;
        const wrongCount = Array.from(quiz.answers.values()).filter((a) => !a.correct).length;

        return (
            <div className="rounded-2xl bg-[#111] border border-white/[0.07] overflow-hidden relative">
                {/* Flash overlay */}
                {flashType && (
                    <div
                        key={flashKey}
                        className={`absolute inset-0 z-10 pointer-events-none flex items-center justify-center rounded-2xl ${flashType === 'correct' ? 'pd-flash-correct' : 'pd-flash-wrong'}`}
                        style={{ backgroundColor: flashType === 'correct' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)' }}
                    >
                        <span style={{ fontSize: 56, opacity: 0.9 }}>{flashType === 'correct' ? '✓' : '✗'}</span>
                    </div>
                )}

                {/* Confetti */}
                <Confetti trigger={confettiKey} />

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.05]">
                    <div className="flex items-center gap-2.5">
                        {quiz.poster && (
                            <img src={`${TMDB_IMAGE_BASE}${quiz.poster}`} alt={quiz.title}
                                className="w-9 h-12 object-cover rounded-lg shadow" />
                        )}
                        <div>
                            <p className="text-sm font-bold text-white/90 leading-tight">{quiz.title}</p>
                            <p className="text-xs text-white/35 mt-0.5">Soru {quiz.current + 1}{copy.of}{quiz.questions.length}</p>
                        </div>
                    </div>
                    <button onClick={() => setQuiz({ phase: 'idle' })}
                        className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.10] transition text-base">
                        ✕
                    </button>
                </div>

                <div className="px-5 pb-5 pt-4">
                    {/* Progress dots */}
                    <div className="flex gap-1.5 mb-4">
                        {quiz.questions.map((_, i) => {
                            const ans = quiz.answers.get(quiz.questions[i].id);
                            let bg = 'rgba(255,255,255,0.08)';
                            if (i === quiz.current) bg = 'rgba(255,255,255,0.6)';
                            else if (ans) bg = ans.correct ? '#4ade80' : '#f87171';
                            return <div key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ backgroundColor: bg }} />;
                        })}
                    </div>

                    {/* Timer bar */}
                    {!isAnswered && !revealed && <TimerBar timeLeft={timeLeft} total={QUESTION_TIME} />}

                    {/* Time's up */}
                    {isTimeUp && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                            <span className="text-red-400">⏰</span>
                            <span className="text-red-400 text-sm font-semibold">{copy.timeUp}</span>
                        </div>
                    )}

                    {q && (
                        <>
                            <p className="text-sm text-white/90 leading-relaxed mb-4 font-semibold">{q.question}</p>

                            <div className="space-y-2.5">
                                {q.options.map((opt) => {
                                    let result: 'correct' | 'wrong' | 'reveal' | null = null;

                                    if (revealed) {
                                        if (opt.key === revealed.selected && revealed.isCorrect) result = 'correct';
                                        else if (opt.key === revealed.selected && !revealed.isCorrect) result = 'wrong';
                                        else if (opt.key === revealed.correctKey && !revealed.isCorrect) result = 'reveal';
                                    } else if (answer) {
                                        if (opt.key === answer.selected && answer.correct) result = 'correct';
                                        else if (opt.key === answer.selected && !answer.correct) result = 'wrong';
                                        else if (opt.key === answer.correctOption && !answer.correct) result = 'reveal';
                                    }

                                    return (
                                        <OptionBtn
                                            key={opt.key}
                                            opt={opt}
                                            result={result}
                                            disabled={isAnswered || quiz.submitting || !!revealed}
                                            onClick={() => void handleAnswer(q.id, opt.key)}
                                        />
                                    );
                                })}
                            </div>

                            {/* Explanation */}
                            {answer && !revealed && answer.explanation && (
                                <div className={`mt-3 rounded-2xl p-3.5 border ${answer.correct ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-red-400/20 bg-red-400/5'}`}>
                                    <span className={`text-xs font-black uppercase tracking-wider ${answer.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isTimeUp ? copy.timeUp : answer.correct ? copy.correct : copy.wrong}
                                    </span>
                                    <p className="text-xs text-white/50 mt-1 leading-relaxed">{answer.explanation}</p>
                                </div>
                            )}

                            {/* Score bar */}
                            {quiz.answers.size > 0 && (
                                <ScoreRow correct={correctCount} wrong={wrongCount} />
                            )}

                            {isAnswered && !revealed && quiz.current < quiz.questions.length - 1 && (
                                <button
                                    className="mt-3 w-full rounded-2xl bg-white/[0.08] border border-white/[0.10] py-3 text-sm font-bold text-white/80 hover:bg-white/[0.13] transition active:scale-[0.98]"
                                    onClick={handleNext}>
                                    {copy.next} →
                                </button>
                            )}
                            {isAnswered && !revealed && quiz.current === quiz.questions.length - 1 && (
                                <button
                                    className="mt-3 w-full rounded-2xl py-3 text-sm font-bold text-white hover:opacity-90 transition active:scale-[0.98]"
                                    style={{ backgroundColor: '#8A9A5B' }}
                                    onClick={handleFinish}>
                                    {copy.finish}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Discovery card ──
    return (
        <div className="rounded-2xl bg-[#111] border border-white/[0.07] overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white/40 text-sm">🎬</span>
                    <h3 className="text-xs font-black tracking-widest text-white/60 uppercase">{copy.title}</h3>
                </div>
                <p className="text-xs text-white/30">{copy.sub}</p>
            </div>

            {loading && (
                <div className="px-5 pb-10 text-center">
                    <div className="animate-pulse text-white/30 text-sm">{copy.loading}</div>
                </div>
            )}

            {!loading && !current && (
                <div className="px-5 pb-10 text-center">
                    <p className="text-sm text-white/30">{copy.noMovies}</p>
                </div>
            )}

            {!loading && current && (
                <>
                    {/* Poster card */}
                    {current.poster_path && (
                        <div className="relative mx-4 rounded-2xl overflow-hidden shadow-xl" style={{ height: 320, backgroundColor: '#000' }}>
                            <img
                                src={`${TMDB_IMAGE_BASE}${current.poster_path}`}
                                alt={current.title}
                                className="w-full h-full object-cover"
                            />
                            {/* Gradient */}
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
                            {/* Film info */}
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                <h4 className="text-base font-black text-white leading-tight">{current.title}</h4>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {current.release_year && (
                                        <span className="text-xs text-white/60">{current.release_year}</span>
                                    )}
                                    {current.vote_average != null && (
                                        <span className="text-xs text-yellow-400 font-semibold">★ {current.vote_average.toFixed(1)}</span>
                                    )}
                                    {current.genres && current.genres.length > 0 && (
                                        <span className="text-xs text-white/40">{current.genres.slice(0, 2).join(' · ')}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 p-4">
                        <button
                            className="flex items-center justify-center gap-2 flex-1 rounded-2xl border border-red-400/25 bg-red-400/5 py-3.5 text-sm font-bold text-red-400 hover:bg-red-400/12 transition active:scale-[0.97]"
                            onClick={handleSkip}
                        >
                            <span className="text-base">✕</span> {copy.skip}
                        </button>
                        <button
                            className="flex items-center justify-center gap-2 flex-1 rounded-2xl py-3.5 text-sm font-bold text-white transition active:scale-[0.97] hover:opacity-90"
                            style={{ backgroundColor: '#8A9A5B' }}
                            onClick={() => void handleQuiz()}
                        >
                            <span className="text-base">▶</span> {copy.takeQuiz}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
