import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    startRushSession,
    submitRushAnswer,
    completeRushSession,
    type PoolLanguageCode,
    type PoolOptionKey,
    type RushMode,
    type RushSession,
} from '../../lib/poolQuizApi';

const COPY: Record<PoolLanguageCode, {
    title: string; meta: string; correct: string; wrong: string;
    result: string; xp: string; tryAgain: string; timeUp: string;
    subscribersOnly: string; dailyLimit: string; loading: string;
    doğru: string; yanlış: string; başarı: string;
    modes: Record<'rush_15' | 'rush_30', { label: string; sub: string; color: string }>;
}> = {
    tr: {
        title: 'QUIZ RUSH', meta: 'Zamanla yarış, film bilgini kanıtla', correct: 'DOĞRU', wrong: 'YANLIŞ',
        result: 'Sonuç', xp: 'XP', tryAgain: 'Tekrar', timeUp: 'Süre Doldu!', subscribersOnly: 'Sadece aboneler', dailyLimit: 'Günlük limit doldu', loading: 'Yükleniyor...',
        doğru: 'Doğru', yanlış: 'Yanlış', başarı: 'Başarı',
        modes: { rush_15: { label: 'Quick 15', sub: '15 soru · 90 sn', color: '#8A9A5B' }, rush_30: { label: 'Marathon 30', sub: '30 soru · 150 sn', color: '#FFA500' } },
    },
    en: {
        title: 'QUIZ RUSH', meta: 'Race against time, prove your film knowledge', correct: 'CORRECT', wrong: 'WRONG',
        result: 'Result', xp: 'XP', tryAgain: 'Try Again', timeUp: "Time's Up!", subscribersOnly: 'Subscribers only', dailyLimit: 'Daily limit reached', loading: 'Loading...',
        doğru: 'Correct', yanlış: 'Wrong', başarı: 'Success',
        modes: { rush_15: { label: 'Quick 15', sub: '15 questions · 90s', color: '#8A9A5B' }, rush_30: { label: 'Marathon 30', sub: '30 questions · 150s', color: '#FFA500' } },
    },
    es: {
        title: 'QUIZ RUSH', meta: 'Compite contra el tiempo', correct: 'CORRECTO', wrong: 'INCORRECTO',
        result: 'Resultado', xp: 'XP', tryAgain: 'Reintentar', timeUp: '¡Tiempo!', subscribersOnly: 'Solo suscriptores', dailyLimit: 'Límite diario', loading: 'Cargando...',
        doğru: 'Correcto', yanlış: 'Incorrecto', başarı: 'Éxito',
        modes: { rush_15: { label: 'Quick 15', sub: '15 preguntas · 90s', color: '#8A9A5B' }, rush_30: { label: 'Marathon 30', sub: '30 preguntas · 150s', color: '#FFA500' } },
    },
    fr: {
        title: 'QUIZ RUSH', meta: 'Course contre la montre', correct: 'CORRECT', wrong: 'INCORRECT',
        result: 'Résultat', xp: 'XP', tryAgain: 'Réessayer', timeUp: 'Temps écoulé!', subscribersOnly: 'Abonnés uniquement', dailyLimit: 'Limite quotidienne', loading: 'Chargement...',
        doğru: 'Correct', yanlış: 'Incorrect', başarı: 'Succès',
        modes: { rush_15: { label: 'Quick 15', sub: '15 questions · 90s', color: '#8A9A5B' }, rush_30: { label: 'Marathon 30', sub: '30 questions · 150s', color: '#FFA500' } },
    },
};

const toPoolOptionKey = (value: string): PoolOptionKey | null =>
    value === 'a' || value === 'b' || value === 'c' || value === 'd' ? value : null;

type Phase =
    | { phase: 'lobby' }
    | { phase: 'loading' }
    | { phase: 'playing'; session: RushSession; current: number; correct: number; answered: number; submitting: boolean; flash: 'correct' | 'wrong' | null; flashKey: number }
    | { phase: 'result'; mode: RushMode; total: number; correct: number; xp: number };

const gradeInfo = (correct: number, total: number) => {
    const pct = total > 0 ? correct / total : 0;
    if (pct >= 0.8) return { letter: 'S', color: '#facc15', label: '🏆 Mükemmel!' };
    if (pct >= 0.6) return { letter: 'A', color: '#4ade80', label: '🎉 Harika!' };
    if (pct >= 0.4) return { letter: 'B', color: '#60a5fa', label: '👍 İyi İş!' };
    return { letter: 'C', color: '#f87171', label: '💪 Devam Et!' };
};

// ── CSS injected once ─────────────────────────────────────
const RUSH_STYLES = `
@keyframes rushFlash {
  0% { opacity: 0; }
  20% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes rushCirclePop {
  0% { transform: scale(0.4); opacity: 0; }
  65% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes rushSlideUp {
  from { transform: translateY(28px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes rushPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
}
@keyframes rushConfetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-220px) rotate(720deg); opacity: 0; }
}
.rush-flash-overlay { animation: rushFlash 0.6s ease-out forwards; }
.rush-circle-pop    { animation: rushCirclePop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.rush-slide-up      { animation: rushSlideUp 0.4s ease-out forwards; }
.rush-score-pulse   { animation: rushPulse 0.35s ease-out; }
.rush-option-btn    { transition: transform 0.08s ease; cursor: pointer; }
.rush-option-btn:active { transform: scale(0.96) !important; }
`;

let styleInjected = false;
const injectStyles = () => {
    if (styleInjected) return;
    styleInjected = true;
    const s = document.createElement('style');
    s.textContent = RUSH_STYLES;
    document.head.appendChild(s);
};

// ── Rush Timer ────────────────────────────────────────────
const RushTimer: React.FC<{ expiresAt: string; totalSeconds: number; onExpired: () => void }> = ({ expiresAt, totalSeconds, onExpired }) => {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    const expired = useRef(false);

    useEffect(() => {
        expired.current = false;
        const interval = setInterval(() => {
            const secs = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
            setRemaining(secs);
            if (secs <= 0 && !expired.current) { expired.current = true; clearInterval(interval); onExpired(); }
        }, 250);
        return () => clearInterval(interval);
    }, [expiresAt, onExpired]);

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const pct = remaining / totalSeconds;
    const color = pct > 0.4 ? '#4ade80' : pct > 0.2 ? '#facc15' : '#ef4444';
    const urgent = remaining <= 15;

    return (
        <div className="flex items-center gap-2.5">
            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct * 100}%`, backgroundColor: color }}
                />
            </div>
            <span
                className={`font-mono text-sm font-black tabular-nums transition-colors ${urgent ? 'animate-pulse' : ''}`}
                style={{ color }}
            >
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
        </div>
    );
};

// ── Option Button ─────────────────────────────────────────
const RushOptionBtn: React.FC<{
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
            className="rush-option-btn w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-left border"
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

// ── Score Bar ─────────────────────────────────────────────
const RushScoreBar: React.FC<{ correct: number; wrong: number }> = ({ correct, wrong }) => {
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
        <div className="flex items-center justify-center gap-8 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className={`flex items-center gap-2 ${cpulse ? 'rush-score-pulse' : ''}`}>
                <span className="text-xl">✅</span>
                <span className="text-2xl font-black text-emerald-400 tabular-nums">{correct}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className={`flex items-center gap-2 ${wpulse ? 'rush-score-pulse' : ''}`}>
                <span className="text-xl">❌</span>
                <span className="text-2xl font-black text-red-400 tabular-nums">{wrong}</span>
            </div>
        </div>
    );
};

// ── Confetti ──────────────────────────────────────────────
const CONFETTI_COLORS = ['#4ade80', '#facc15', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#f87171'];

const Confetti: React.FC<{ trigger: number }> = ({ trigger }) => {
    const [particles, setParticles] = useState<{ id: number; x: number; color: string; size: number; delay: number }[]>([]);
    const prevTrigger = useRef(0);

    useEffect(() => {
        if (trigger === 0 || trigger === prevTrigger.current) return;
        prevTrigger.current = trigger;
        setParticles(
            Array.from({ length: 18 }, (_, i) => ({
                id: Date.now() + i,
                x: 20 + Math.random() * 60,
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                size: 5 + Math.random() * 7,
                delay: Math.random() * 0.15,
            }))
        );
        setTimeout(() => setParticles([]), 1200);
    }, [trigger]);

    if (!particles.length) return null;
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 20 }}>
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-sm"
                    style={{
                        left: `${p.x}%`,
                        bottom: '25%',
                        width: p.size,
                        height: p.size * 1.5,
                        backgroundColor: p.color,
                        animation: `rushConfetti 1s ease-out ${p.delay}s forwards`,
                    }}
                />
            ))}
        </div>
    );
};

// ── Result Screen ─────────────────────────────────────────
const ResultScreen: React.FC<{
    total: number; correct: number; xp: number;
    onRetry: () => void; copy: (typeof COPY)[PoolLanguageCode];
}> = ({ total, correct, xp, onRetry, copy }) => {
    const grade = gradeInfo(correct, total);
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const [xpDisplay, setXpDisplay] = useState(0);
    const confettiTrigger = pct >= 60 ? 1 : 0;

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
        <div className="relative p-6 flex flex-col items-center text-center">
            <Confetti trigger={confettiTrigger} />

            {/* Grade circle */}
            <div className="rush-circle-pop mb-2" style={{ animationFillMode: 'both' }}>
                <div
                    className="w-24 h-24 rounded-full border-[3px] flex flex-col items-center justify-center mb-2"
                    style={{ borderColor: grade.color, boxShadow: `0 0 28px ${grade.color}44` }}
                >
                    <span className="text-4xl font-black" style={{ color: grade.color }}>{grade.letter}</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: grade.color }}>{grade.label}</p>
            </div>

            {/* Stats row */}
            <div
                className="rush-slide-up flex items-center justify-center gap-6 mb-4 mt-5"
                style={{ animationDelay: '0.35s', animationFillMode: 'both', opacity: 0 }}
            >
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
            <div
                className="rush-slide-up inline-flex items-center gap-2 bg-white/[0.06] rounded-full px-5 py-2.5 mb-6"
                style={{ animationDelay: '0.45s', animationFillMode: 'both', opacity: 0 }}
            >
                <span className="text-yellow-400 text-lg">⚡</span>
                <span className="text-lg font-black text-white/90 tabular-nums">+{xpDisplay}</span>
                <span className="text-sm text-white/50">{copy.xp}</span>
            </div>

            {/* Retry button */}
            <div
                className="rush-slide-up w-full"
                style={{ animationDelay: '0.55s', animationFillMode: 'both', opacity: 0 }}
            >
                <button
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: '#8A9A5B' }}
                    onClick={onRetry}
                >
                    ↺ {copy.tryAgain}
                </button>
            </div>
        </div>
    );
};

// ── Main Panel ────────────────────────────────────────────
export const QuizRushPanel: React.FC = () => {
    const { language: rawLang } = useLanguage();
    const lang = (rawLang as PoolLanguageCode) || 'en';
    const copy = COPY[lang] || COPY.en;

    const [phase, setPhase] = useState<Phase>({ phase: 'lobby' });
    const [revealed, setRevealed] = useState<{ selected: PoolOptionKey; isCorrect: boolean; correctKey: PoolOptionKey } | null>(null);
    const [confettiKey, setConfettiKey] = useState(0);
    const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { injectStyles(); }, []);

    const totalSecs = phase.phase === 'playing' && phase.session.mode === 'rush_30' ? 150 : 90;

    const handleStart = useCallback(async (mode: RushMode) => {
        setPhase({ phase: 'loading' });
        const res = await startRushSession(mode, lang);
        if (res.ok) setPhase({ phase: 'playing', session: res.session, current: 0, correct: 0, answered: 0, submitting: false, flash: null, flashKey: 0 });
        else setPhase({ phase: 'lobby' });
    }, [lang]);

    const handleAnswer = useCallback(async (selectedValue: string) => {
        const selected = toPoolOptionKey(selectedValue);
        if (!selected) return;
        if (phase.phase !== 'playing' || phase.submitting || revealed) return;
        const q = phase.session.questions[phase.current];
        if (!q) return;

        setPhase((p) => p.phase === 'playing' ? { ...p, submitting: true } : p);
        const res = await submitRushAnswer({ session_id: phase.session.id, attempt_id: q.id, selected_option: selected });

        if (res.ok) {
            const isCorrect = res.is_correct;
            const newCorrect = (phase.phase === 'playing' ? phase.correct : 0) + (isCorrect ? 1 : 0);
            const newAnswered = (phase.phase === 'playing' ? phase.answered : 0) + 1;
            const flash = isCorrect ? 'correct' as const : 'wrong' as const;

            if (isCorrect) setConfettiKey((k) => k + 1);

            // Set flash
            setPhase((p) => p.phase === 'playing'
                ? { ...p, flash, flashKey: p.flashKey + 1, submitting: false }
                : p
            );

            // Show reveal state briefly for current question
            setRevealed({ selected, isCorrect, correctKey: res.correct_option });

            revealTimeout.current = setTimeout(async () => {
                setRevealed(null);

                const nextIdx = (phase.phase === 'playing' ? phase.current : 0) + 1;
                const totalQuestions = phase.phase === 'playing' ? phase.session.questions.length : 0;

                if (nextIdx >= totalQuestions) {
                    const complete = await completeRushSession(phase.phase === 'playing' ? phase.session.id : '');
                    setPhase((p) => p.phase === 'playing'
                        ? { phase: 'result', mode: p.session.mode, total: newAnswered, correct: newCorrect, xp: complete.ok ? complete.xp_earned : 0 }
                        : p
                    );
                } else {
                    setPhase((p) => p.phase === 'playing'
                        ? { ...p, current: nextIdx, correct: newCorrect, answered: newAnswered, submitting: false, flash: null }
                        : p
                    );
                }
            }, 500);

        } else if ('expired' in res && res.expired) {
            const complete = await completeRushSession(phase.session.id);
            setPhase({ phase: 'result', mode: phase.session.mode, total: phase.answered, correct: phase.correct, xp: complete.ok ? complete.xp_earned : 0 });
        } else {
            setPhase((p) => p.phase === 'playing' ? { ...p, submitting: false } : p);
        }
    }, [phase, revealed]);

    const handleExpired = useCallback(async () => {
        if (phase.phase !== 'playing') return;
        const complete = await completeRushSession(phase.session.id);
        setPhase({ phase: 'result', mode: phase.session.mode, total: phase.answered, correct: phase.correct, xp: complete.ok ? complete.xp_earned : 0 });
    }, [phase]);

    // ── Lobby ──
    if (phase.phase === 'lobby') {
        return (
            <div className="rounded-2xl bg-[#111] border border-white/[0.07] p-5">
                <div className="mb-5">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-white/40">⚡</span>
                        <h3 className="text-xs font-black tracking-widest text-white/60 uppercase">{copy.title}</h3>
                    </div>
                    <p className="text-xs text-white/30">{copy.meta}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {(['rush_15', 'rush_30'] as const).map((mode) => {
                        const info = copy.modes[mode];
                        const isMarathon = mode === 'rush_30';
                        const locked = false;
                        return (
                            <button
                                key={mode}
                                className={`relative rounded-2xl border p-4 text-left transition-all ${locked ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110 cursor-pointer active:scale-[0.97]'}`}
                                style={{ borderColor: `${info.color}30`, background: `${info.color}08` }}
                                disabled={locked}
                                onClick={() => !locked && void handleStart(mode)}
                            >
                                {locked && (
                                    <div
                                        className="absolute top-2 right-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 border"
                                        style={{ backgroundColor: '#B8860B18', borderColor: '#B8860B44' }}
                                    >
                                        <span style={{ color: '#B8860B', fontSize: 9, fontWeight: 800 }}>PRO</span>
                                    </div>
                                )}
                                <div
                                    className="w-11 h-11 rounded-full flex items-center justify-center mb-3 text-xl"
                                    style={{ backgroundColor: `${info.color}18` }}
                                >
                                    {isMarathon ? '🚀' : '⚡'}
                                </div>
                                <p className="text-sm font-black text-white/90">{info.label}</p>
                                <p className="text-xs mt-0.5 font-semibold" style={{ color: info.color }}>{info.sub}</p>
                                <div
                                    className="flex items-center gap-1.5 mt-3 rounded-xl px-3 py-2"
                                    style={{ backgroundColor: `${info.color}15` }}
                                >
                                    <span style={{ color: info.color, fontSize: 11 }}>{locked ? '🔒' : '▶'}</span>
                                    <span className="text-xs font-black" style={{ color: info.color }}>
                                        {locked ? 'PRO' : 'BAŞLA'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Loading ──
    if (phase.phase === 'loading') {
        return (
            <div className="rounded-2xl bg-[#111] border border-white/[0.07] p-10 text-center">
                <div className="animate-pulse text-white/40 text-sm">{copy.loading}</div>
            </div>
        );
    }

    // ── Result ──
    if (phase.phase === 'result') {
        return (
            <div className="rounded-2xl bg-[#111] border border-white/[0.07] overflow-hidden relative">
                <ResultScreen
                    total={phase.total}
                    correct={phase.correct}
                    xp={phase.xp}
                    copy={copy}
                    onRetry={() => setPhase({ phase: 'lobby' })}
                />
            </div>
        );
    }

    // ── Playing ──
    const q = phase.session.questions[phase.current];
    const modeInfo = copy.modes[phase.session.mode as 'rush_15' | 'rush_30'];

    return (
        <div className="rounded-2xl bg-[#111] border border-white/[0.07] overflow-hidden relative">
            {/* Flash overlay */}
            {phase.flash && (
                <div
                    key={phase.flashKey}
                    className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center rounded-2xl rush-flash-overlay"
                    style={{ backgroundColor: phase.flash === 'correct' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)' }}
                >
                    <span style={{ fontSize: 60, opacity: 0.9 }}>{phase.flash === 'correct' ? '✓' : '✗'}</span>
                </div>
            )}

            {/* Confetti */}
            <Confetti trigger={confettiKey} />

            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPhase({ phase: 'lobby' })}
                        className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition text-sm"
                    >
                        ✕
                    </button>
                    <div>
                        <p className="text-xs font-black text-white/70 uppercase tracking-wide">{modeInfo.label}</p>
                        <p className="text-xs text-white/30">{phase.current + 1} / {phase.session.questions.length}</p>
                    </div>
                </div>
                {phase.session.expires_at && (
                    <RushTimer expiresAt={phase.session.expires_at} totalSeconds={totalSecs} onExpired={handleExpired} />
                )}
            </div>

            <div className="p-5">
                {/* Progress bar */}
                <div className="flex gap-0.5 mb-5">
                    {phase.session.questions.map((_, i) => (
                        <div
                            key={i}
                            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                            style={{
                                backgroundColor: i < phase.current
                                    ? 'rgba(255,255,255,0.35)'
                                    : i === phase.current
                                    ? 'rgba(255,255,255,0.80)'
                                    : 'rgba(255,255,255,0.08)',
                            }}
                        />
                    ))}
                </div>

                {q && (
                    <>
                        <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-1">{q.movie_title}</p>
                        <p className="text-sm text-white/90 leading-relaxed mb-4 font-semibold">{q.question}</p>

                        <div className="space-y-2.5">
                            {q.options.map((opt) => {
                                let result: 'correct' | 'wrong' | 'reveal' | null = null;
                                if (revealed) {
                                    if (opt.key === revealed.selected && revealed.isCorrect) result = 'correct';
                                    else if (opt.key === revealed.selected && !revealed.isCorrect) result = 'wrong';
                                    else if (opt.key === revealed.correctKey && !revealed.isCorrect) result = 'reveal';
                                }
                                return (
                                    <RushOptionBtn
                                        key={opt.key}
                                        opt={opt}
                                        result={result}
                                        disabled={phase.submitting || !!revealed}
                                        onClick={() => void handleAnswer(opt.key)}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Score bar */}
                <div className="mt-5">
                    <RushScoreBar correct={phase.correct} wrong={phase.answered - phase.correct} />
                </div>
            </div>
        </div>
    );
};
