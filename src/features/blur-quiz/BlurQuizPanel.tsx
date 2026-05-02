import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { PosterImage } from '../../components/PosterImage';
import {
    fetchBlurMovie,
    verifyBlurGuess,
    requestBlurQuizJoker,
    type BlurQuizHints,
    type BlurQuizJokerKey,
} from '../../lib/blurQuizApi';
import type { PoolLanguageCode } from '../../lib/poolQuizApi';

// Blur values per step (0 = most blurred/hardest, 5 = clear/easiest)
const BLUR_PX = [40, 28, 18, 10, 4, 0];
const STEP_DURATION_MS = 5000;
const TOTAL_STEPS = BLUR_PX.length; // 6 steps → 30 seconds
const TOTAL_DURATION_MS = TOTAL_STEPS * STEP_DURATION_MS;

// XP per step (matches server formula: 50 - step*8)
const XP_PER_STEP = [50, 42, 34, 26, 18, 10];

const COPY: Record<PoolLanguageCode, {
    title: string; meta: string; start: string; inputPlaceholder: string;
    submit: string; timeUp: string; correct: string; wrong: string;
    xpEarned: string; correctTitle: string; playAgain: string; loading: string;
    jokers: Record<BlurQuizJokerKey, string>;
    hint: string; potentialXp: string; jokerCost: string; guessLabel: string;
    desc: string; retryBody: string;
}> = {
    tr: {
        title: 'BULANIK FİLM', meta: 'Bulanık posterden filmi tahmin et',
        start: 'Başla', inputPlaceholder: 'Film adını yaz...', submit: 'Tahmin Et',
        timeUp: 'Süre Doldu!', correct: 'DOĞRU!', wrong: 'YANLIŞ!',
        xpEarned: 'XP kazandın', correctTitle: 'Doğru cevap', playAgain: 'Tekrar Oyna',
        loading: 'Yükleniyor...',
        jokers: { director: 'Yönetmen', year: 'Yıl', cast: 'Oyuncular', genre: 'Tür' },
        hint: 'İpucu', potentialXp: 'olası XP', jokerCost: 'Her joker -5 XP',
        guessLabel: 'Tahminin',
        desc: 'Film posteri bulanık başlar ve zamanla netleşir. 4 joker hakkın var. Film adını yazarak tahmin et!',
        retryBody: 'Cok yakin bir eslesme bulduk ama filmi aciga cikarmamak icin otomatik kabul etmiyoruz. Tahminini biraz daha net yazip tekrar dene.',
    },
    en: {
        title: 'BLUR QUIZ', meta: 'Guess the film from the blurred poster',
        start: 'Start', inputPlaceholder: 'Type the film title...', submit: 'Guess',
        timeUp: "Time's Up!", correct: 'CORRECT!', wrong: 'WRONG!',
        xpEarned: 'XP earned', correctTitle: 'Correct answer', playAgain: 'Play Again',
        loading: 'Loading...',
        jokers: { director: 'Director', year: 'Year', cast: 'Cast', genre: 'Genre' },
        hint: 'Hint', potentialXp: 'potential XP', jokerCost: 'Each joker costs -5 XP',
        guessLabel: 'Your guess',
        desc: 'The poster starts blurred and clears over time. You have 4 joker hints. Type the film title to guess!',
        retryBody: 'We found a very close match, but we do not reveal the title or auto-accept it. Tighten the spelling and try again.',
    },
    es: {
        title: 'FOTO BORROSA', meta: 'Adivina la película por el póster borroso',
        start: 'Comenzar', inputPlaceholder: 'Escribe el título...', submit: 'Adivinar',
        timeUp: '¡Tiempo!', correct: '¡CORRECTO!', wrong: '¡INCORRECTO!',
        xpEarned: 'XP ganados', correctTitle: 'Respuesta correcta', playAgain: 'Jugar de nuevo',
        loading: 'Cargando...',
        jokers: { director: 'Director', year: 'Año', cast: 'Reparto', genre: 'Género' },
        hint: 'Pista', potentialXp: 'XP potencial', jokerCost: 'Cada comodín cuesta -5 XP',
        guessLabel: 'Tu respuesta',
        desc: 'El póster empieza borroso y se aclara con el tiempo. Tienes 4 pistas comodín. ¡Escribe el título!',
        retryBody: 'Encontramos una coincidencia muy cercana, pero no mostramos el titulo ni lo aceptamos automaticamente. Ajusta tu respuesta y prueba otra vez.',
    },
    fr: {
        title: 'AFFICHE FLOUE', meta: "Devinez le film depuis l'affiche floue",
        start: 'Commencer', inputPlaceholder: 'Tapez le titre du film...', submit: 'Deviner',
        timeUp: 'Temps écoulé!', correct: 'CORRECT!', wrong: 'FAUX!',
        xpEarned: 'XP gagnés', correctTitle: 'Bonne réponse', playAgain: 'Rejouer',
        loading: 'Chargement...',
        jokers: { director: 'Réalisateur', year: 'Année', cast: 'Casting', genre: 'Genre' },
        hint: 'Indice', potentialXp: 'XP potentiel', jokerCost: 'Chaque indice coûte -5 XP',
        guessLabel: 'Votre réponse',
        desc: "L'affiche commence floue et s'éclaircit. Vous avez 4 indices. Écrivez le titre pour deviner!",
        retryBody: 'Nous avons trouve une correspondance tres proche, mais nous ne revelons pas le titre et nous ne l acceptons pas automatiquement. Precisez votre reponse et reessayez.',
    },
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const BLUR_STYLES = `
@keyframes blurFlash {
  0% { opacity: 0; transform: scale(0.94); }
  25% { opacity: 1; transform: scale(1.02); }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes blurSlideUp {
  from { transform: translateY(18px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes blurPop {
  0% { transform: scale(0.7); opacity: 0; }
  65% { transform: scale(1.12); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes blurConfetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-130px) rotate(720deg); opacity: 0; }
}
`;

const BLUR_STYLE_ELEMENT_ID = 'blur-quiz-panel-styles';

const injectStyles = () => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(BLUR_STYLE_ELEMENT_ID)) return;
    const el = document.createElement('style');
    el.id = BLUR_STYLE_ELEMENT_ID;
    el.textContent = BLUR_STYLES;
    document.head.appendChild(el);
};

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveState = {
    phase: 'active';
    movieId: string;
    sessionId: string;
    posterPath: string;
    hints: BlurQuizHints;
    blurStep: number;
    guess: string;
    submitting: boolean;
    jokers: Set<BlurQuizJokerKey>;
    elapsedMs: number;
};

type Phase =
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'error' }
    | ActiveState
    | { phase: 'result'; correct: boolean; correctTitle: string; xpEarned: number; guess: string };

// ── Component ─────────────────────────────────────────────────────────────────
export function BlurQuizPanel() {
    const { language } = useLanguage();
    const lang = (language as PoolLanguageCode) || 'tr';
    const c = COPY[lang] || COPY.tr;

    const [state, setState] = useState<Phase>({ phase: 'idle' });
    const [flashKey, setFlashKey] = useState(0);
    const [flashType, setFlashType] = useState<'correct' | 'wrong' | null>(null);
    const [confettiKey, setConfettiKey] = useState(0);
    const [confettiParticles, setConfettiParticles] = useState<Array<{
        id: string;
        left: string;
        color: string;
        delay: string;
        size: string;
    }>>([]);
    const [seenIds, setSeenIds] = useState<string[]>([]);

    useEffect(() => {
        injectStyles();
    }, []);

    // Keep a ref in sync with the active state so callbacks can read it without stale closure issues
    const activeRef = useRef<ActiveState | null>(null);
    useEffect(() => {
        activeRef.current = state.phase === 'active' ? state : null;
    });

    useEffect(() => {
        if (confettiKey <= 0) {
            setConfettiParticles([]);
            return;
        }

        setConfettiParticles(Array.from({ length: 16 }, (_, i) => ({
            id: `${confettiKey}-${i}`,
            left: `${Math.random() * 90 + 5}%`,
            color: ['#8A9A5B', '#facc15', '#f97316', '#60a5fa', '#f472b6'][i % 5],
            delay: `${Math.random() * 0.4}s`,
            size: `${Math.random() * 6 + 6}px`,
        })));
    }, [confettiKey]);

    const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const submittingRef = useRef(false);

    const clearStepTimer = useCallback(() => {
        if (stepTimerRef.current) {
            clearInterval(stepTimerRef.current);
            stepTimerRef.current = null;
        }
    }, []);

    // Auto-submit on timeout
    const submitRef = useRef<((timeUp?: boolean) => Promise<void>) | null>(null);

    const startTimer = useCallback((initialElapsedMs = 0) => {
        clearStepTimer();
        const startTime = Date.now() - initialElapsedMs;
        stepTimerRef.current = setInterval(() => {
            setState((prev) => {
                if (prev.phase !== 'active') { clearStepTimer(); return prev; }
                const elapsed = Date.now() - startTime;
                if (elapsed >= TOTAL_DURATION_MS) {
                    clearStepTimer();
                    // Trigger time-up submit asynchronously
                    setTimeout(() => submitRef.current?.(true), 0);
                    return { ...prev, blurStep: TOTAL_STEPS - 1, elapsedMs: TOTAL_DURATION_MS };
                }
                const newStep = Math.min(TOTAL_STEPS - 1, Math.floor(elapsed / STEP_DURATION_MS));
                return { ...prev, blurStep: newStep, elapsedMs: elapsed };
            });
        }, 250);
    }, [clearStepTimer]);

    useEffect(() => {
        return () => clearStepTimer();
    }, [clearStepTimer]);

    const doSubmit = useCallback(async (timeUp = false) => {
        if (submittingRef.current) return;
        const s = activeRef.current;
        if (!s) return;
        const resumeElapsedMs = s.elapsedMs;
        submittingRef.current = true;
        clearStepTimer();

        setState((prev) => prev.phase === 'active' ? { ...prev, submitting: true } : prev);

        const guess = timeUp ? '' : s.guess.trim();
        const res = await verifyBlurGuess({
            session_id: s.sessionId,
            guess,
        });

        if (res.ok && (res.needs_retry || res.needs_confirmation) && !timeUp) {
            if (typeof window !== 'undefined') {
                window.alert(c.retryBody);
            }
            submittingRef.current = false;
            setState((prev) =>
                prev.phase === 'active' && prev.movieId === s.movieId
                    ? { ...prev, submitting: false }
                    : prev
            );
            startTimer(resumeElapsedMs);
            setTimeout(() => inputRef.current?.focus(), 0);
            return;
        }

        const correct = res.ok ? res.correct : false;
        const correctTitle =
            res.ok && res.correct
                ? String(res.matched_title || guess || s.guess.trim())
                : '';
        const xpEarned = res.ok ? res.xp_earned : 0;

        setFlashType(correct ? 'correct' : 'wrong');
        setFlashKey((k) => k + 1);
        if (correct) setConfettiKey((k) => k + 1);

        setState({
            phase: 'result',
            correct,
            correctTitle,
            xpEarned,
            guess: guess || s.guess.trim(),
        });
        submittingRef.current = false;
    }, [c.retryBody, clearStepTimer, startTimer]);

    // Keep submitRef in sync
    useEffect(() => {
        submitRef.current = doSubmit;
    });

    const loadMovie = useCallback(async (currentSeenIds: string[]) => {
        submittingRef.current = false;
        setState({ phase: 'loading' });
        const res = await fetchBlurMovie({ excludeIds: currentSeenIds });
        if (!res.ok) {
            setState({ phase: 'error' });
            return;
        }
        setSeenIds((prev) => [...prev, res.movie_id]);
        setState({
            phase: 'active',
            movieId: res.movie_id,
            sessionId: res.session_id,
            posterPath: res.poster_path,
            hints: res.hints,
            blurStep: 0,
            guess: '',
            submitting: false,
            jokers: new Set(),
            elapsedMs: 0,
        });
        startTimer();
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [startTimer]);

    const handleJoker = useCallback(async (key: BlurQuizJokerKey) => {
        const activeState = activeRef.current;
        if (!activeState || activeState.jokers.has(key)) return;

        const result = await requestBlurQuizJoker({
            session_id: activeState.sessionId,
            joker_key: key,
        });
        if (!result.ok) return;

        setState((prev) => {
            if (prev.phase !== 'active' || prev.sessionId !== activeState.sessionId || prev.jokers.has(key)) {
                return prev;
            }
            const next = new Set(prev.jokers);
            next.add(key);
            return { ...prev, jokers: next };
        });
    }, []);

    // ── Derived ───────────────────────────────────────────────────────────────
    const isActive = state.phase === 'active';
    const blurStep = isActive ? state.blurStep : 0;
    const timeProgress = isActive ? Math.max(0, 1 - state.elapsedMs / TOTAL_DURATION_MS) : 0;
    const potentialXp = isActive
        ? Math.max(10, XP_PER_STEP[state.blurStep] - state.jokers.size * 5)
        : 0;
    const posterPath = isActive ? state.posterPath : null;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Flash overlay */}
            {flashType && (
                <div
                    key={flashKey}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
                        backgroundColor: flashType === 'correct' ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)',
                        animation: 'blurFlash 0.7s ease-out forwards',
                    }}
                />
            )}

            {/* Confetti */}
            {confettiKey > 0 && confettiParticles.map((p) => (
                <div
                    key={p.id}
                    style={{
                        position: 'fixed', top: '45%', left: p.left, width: p.size, height: p.size,
                        backgroundColor: p.color, borderRadius: '2px', zIndex: 9998, pointerEvents: 'none',
                        animation: `blurConfetti 1.1s ${p.delay} ease-out forwards`,
                    }}
                />
            ))}

            {/* Header */}
            <div className="px-4 py-4 sm:px-6 border-b border-white/10 flex items-center justify-between">
                <div>
                    <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-sage">{c.title}</h2>
                    <p className="text-white/40 text-[11px] mt-0.5">{c.meta}</p>
                </div>
                {isActive && (
                    <div className="text-right">
                        <span className="text-sage font-bold text-sm">{potentialXp}</span>
                        <span className="text-white/30 text-[10px] ml-1">{c.potentialXp}</span>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6">

                {/* IDLE */}
                {state.phase === 'idle' && (
                    <div className="text-center py-8" style={{ animation: 'blurSlideUp 0.4s ease-out' }}>
                        <div className="mx-auto mb-6 w-36 h-52 rounded-xl overflow-hidden border border-white/10 relative flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)' }}>
                            <div style={{ fontSize: 44, zIndex: 1, position: 'relative' }}>🎬</div>
                            <div style={{
                                position: 'absolute', inset: 0,
                                backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                            }} />
                        </div>
                        <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto leading-relaxed">{c.desc}</p>
                        <button
                            type="button"
                            onClick={() => void loadMovie(seenIds)}
                            className="px-8 py-3 rounded-xl bg-sage text-white font-bold tracking-wider text-sm hover:bg-sage/80 transition-colors uppercase"
                        >
                            {c.start}
                        </button>
                    </div>
                )}

                {/* LOADING */}
                {state.phase === 'loading' && (
                    <div className="text-center py-16 text-white/40 text-sm">{c.loading}</div>
                )}

                {/* ERROR */}
                {state.phase === 'error' && (
                    <div className="text-center py-12" style={{ animation: 'blurSlideUp 0.4s ease-out' }}>
                        <p className="text-sm text-red-400/70 mb-4">
                            {lang === 'tr' ? 'Film yüklenemedi. Lütfen tekrar dene.' : 'Failed to load movie. Please try again.'}
                        </p>
                        <button
                            onClick={() => loadMovie(seenIds)}
                            className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-sm transition"
                        >
                            {lang === 'tr' ? 'Tekrar Dene' : 'Retry'}
                        </button>
                    </div>
                )}

                {/* ACTIVE */}
                {state.phase === 'active' && posterPath && (
                    <div style={{ animation: 'blurSlideUp 0.3s ease-out' }}>
                        {/* Timer bar */}
                        <div className="mb-4 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div style={{
                                height: '100%',
                                width: `${timeProgress * 100}%`,
                                background: timeProgress > 0.4 ? '#8A9A5B' : timeProgress > 0.2 ? '#f97316' : '#ef4444',
                                transition: 'width 0.25s linear, background 0.5s ease',
                                borderRadius: '9999px',
                            }} />
                        </div>

                        {/* Poster */}
                        <div className="flex justify-center mb-5">
                            <div className="relative rounded-xl overflow-hidden border border-white/10"
                                style={{ width: 200, height: 280 }}>
                                <PosterImage
                                    posterPath={posterPath}
                                    size="large"
                                    alt="?"
                                    style={{
                                        width: '100%', height: '100%', objectFit: 'cover',
                                        filter: `blur(${BLUR_PX[blurStep]}px)`,
                                        transform: blurStep < 2 ? 'scale(1.09)' : 'scale(1)',
                                        transition: 'filter 0.9s ease, transform 0.9s ease',
                                        userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none',
                                    }}
                                    draggable={false}
                                />
                                <div style={{
                                    position: 'absolute', bottom: 6, right: 6,
                                    background: 'rgba(0,0,0,0.65)', borderRadius: 5, padding: '2px 7px',
                                    fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em',
                                }}>
                                    {blurStep + 1}/{TOTAL_STEPS}
                                </div>
                            </div>
                        </div>

                        {/* Revealed joker hints */}
                        {state.jokers.size > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2 justify-center">
                                {state.jokers.has('director') && state.hints.director && (
                                    <HintChip label={c.jokers.director} value={state.hints.director} />
                                )}
                                {state.jokers.has('year') && state.hints.release_year != null && (
                                    <HintChip label={c.jokers.year} value={String(state.hints.release_year)} />
                                )}
                                {state.jokers.has('cast') && state.hints.cast.length > 0 && (
                                    <HintChip label={c.jokers.cast} value={state.hints.cast.join(', ')} />
                                )}
                                {state.jokers.has('genre') && state.hints.genre && (
                                    <HintChip label={c.jokers.genre} value={state.hints.genre} />
                                )}
                            </div>
                        )}

                        {/* Input row */}
                        <div className="flex gap-2 mb-4">
                            <input
                                ref={inputRef}
                                type="text"
                                value={state.guess}
                                onChange={(e) => setState((prev) =>
                                    prev.phase === 'active' ? { ...prev, guess: e.target.value } : prev
                                )}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && state.guess.trim()) void doSubmit();
                                }}
                                placeholder={c.inputPlaceholder}
                                disabled={state.submitting}
                                className="flex-1 rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-sage/50 transition-colors"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <button
                                type="button"
                                onClick={() => void doSubmit()}
                                disabled={!state.guess.trim() || state.submitting}
                                className="px-5 py-3 rounded-xl bg-sage text-white font-bold text-sm uppercase tracking-wide disabled:opacity-30 hover:bg-sage/80 transition-colors"
                            >
                                {c.submit}
                            </button>
                        </div>

                        {/* Joker buttons */}
                        <div className="grid grid-cols-4 gap-2">
                            {(['director', 'year', 'cast', 'genre'] as BlurQuizJokerKey[]).map((key) => {
                                const used = state.jokers.has(key);
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleJoker(key)}
                                        disabled={used || state.submitting}
                                        className="py-2 px-1 rounded-lg border text-[11px] font-medium tracking-wide uppercase transition-all"
                                        style={{
                                            borderColor: used ? 'rgba(255,255,255,0.05)' : 'rgba(138,154,91,0.35)',
                                            background: used ? 'rgba(255,255,255,0.03)' : 'rgba(138,154,91,0.08)',
                                            color: used ? 'rgba(255,255,255,0.2)' : 'rgba(138,154,91,0.85)',
                                            cursor: used ? 'default' : 'pointer',
                                        }}
                                    >
                                        {used ? '✓' : c.hint} · {c.jokers[key]}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-center text-white/20 text-[10px] mt-2 tracking-wide">{c.jokerCost}</p>
                    </div>
                )}

                {/* RESULT */}
                {state.phase === 'result' && (
                    <div className="text-center py-6" style={{ animation: 'blurSlideUp 0.4s ease-out' }}>
                        <div
                            className="text-2xl font-black tracking-[0.15em] mb-1"
                            style={{
                                color: state.correct ? '#4ade80' : '#f87171',
                                animation: 'blurPop 0.5s ease-out',
                            }}
                        >
                            {state.correct ? c.correct : c.wrong}
                        </div>

                        {state.correctTitle ? (
                            <>
                                <div className="text-white/35 text-[10px] mb-3 tracking-widest uppercase">{c.correctTitle}</div>
                                <div className="text-white font-bold text-xl mb-5 tracking-wide">{state.correctTitle}</div>
                            </>
                        ) : null}

                        {state.correct && state.xpEarned > 0 && (
                            <div className="mb-5">
                                <span className="text-3xl font-black text-sage" style={{ animation: 'blurPop 0.6s ease-out' }}>
                                    +{state.xpEarned}
                                </span>
                                <span className="text-white/40 text-sm ml-2">{c.xpEarned}</span>
                            </div>
                        )}

                        {!state.correct && state.guess && (
                            <div className="mb-5 text-white/30 text-sm">
                                {c.guessLabel}: <span className="text-white/50 italic">"{state.guess}"</span>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => void loadMovie(seenIds)}
                            className="px-8 py-3 rounded-xl bg-sage text-white font-bold tracking-wider text-sm hover:bg-sage/80 transition-colors uppercase"
                        >
                            {c.playAgain}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

// ── HintChip ──────────────────────────────────────────────────────────────────
function HintChip({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="rounded-lg px-3 py-1.5 text-xs"
            style={{
                background: 'rgba(138,154,91,0.1)',
                border: '1px solid rgba(138,154,91,0.22)',
                animation: 'blurSlideUp 0.3s ease-out',
            }}
        >
            <span className="text-sage/55 uppercase tracking-wider mr-1.5" style={{ fontSize: 9 }}>{label}</span>
            <span className="text-white/75 font-medium">{value}</span>
        </div>
    );
}
