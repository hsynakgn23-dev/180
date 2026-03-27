import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { showInterstitialAd } from '../lib/mobileAds';
import {
  fetchPoolMovies,
  fetchPoolQuiz,
  submitPoolSwipe,
  submitPoolAnswer,
  startRushSession,
  submitRushAnswer,
  completeRushSession,
  type PoolMovie,
  type PoolQuestion,
  type PoolOptionKey,
  type PoolLanguageCode,
  type RushMode,
  type RushSession,
} from '../lib/mobilePoolQuizApi';

// ────────────────────────────────────────────
// Sound effects — Web Audio API on web, expo-av on native
// ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SND_CORRECT = require('../../assets/sounds/correct.wav') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SND_WRONG = require('../../assets/sounds/wrong.wav') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SND_TIMEUP = require('../../assets/sounds/timeup.wav') as number;

// Web: use Web Audio API for instant playback
let _audioCtx: AudioContext | null = null;
const getAudioCtx = (): AudioContext | null => {
  if (Platform.OS !== 'web') return null;
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  }
  return _audioCtx;
};

const playTone = (freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.25) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
};

// Native: play wav file via expo-av
const playNativeSound = async (source: number) => {
  try {
    const { sound } = await Audio.Sound.createAsync(source);
    await sound.playAsync();
    // Auto-unload after playback
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) sound.unloadAsync();
    });
  } catch { /* silent fail */ }
};

const playCorrectSound = () => {
  if (Platform.OS === 'web') {
    playTone(523, 0.12, 'sine', 0.2);
    setTimeout(() => playTone(784, 0.18, 'sine', 0.25), 100);
  } else {
    playNativeSound(SND_CORRECT);
  }
};

const playWrongSound = () => {
  if (Platform.OS === 'web') {
    playTone(200, 0.25, 'square', 0.15);
    setTimeout(() => playTone(150, 0.2, 'square', 0.12), 120);
  } else {
    playNativeSound(SND_WRONG);
  }
};

const playTimeUpSound = () => {
  if (Platform.OS === 'web') {
    playTone(440, 0.1, 'triangle', 0.2);
    setTimeout(() => playTone(330, 0.1, 'triangle', 0.18), 100);
    setTimeout(() => playTone(220, 0.2, 'triangle', 0.15), 200);
  } else {
    playNativeSound(SND_TIMEUP);
  }
};

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

type QuizLanguage = PoolLanguageCode;

type PoolQuizState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'active'; movieId: string; title: string; questions: PoolQuestion[]; current: number; answers: Map<string, { selected: PoolOptionKey; correct: boolean; explanation: string; correctOption: PoolOptionKey }> }
  | { phase: 'result'; title: string; total: number; correct: number; xpEarned: number };

type RushPhase =
  | { phase: 'lobby' }
  | { phase: 'loading' }
  | { phase: 'playing'; session: RushSession; current: number; correct: number; answered: number; submitting: boolean; streak: number; flash: 'correct' | 'wrong' | null; flashKey: number; revealed: { selected: PoolOptionKey; isCorrect: boolean; correctKey: PoolOptionKey } | null; confettiKey: number }
  | { phase: 'result'; mode: RushMode; total: number; correct: number; xp: number };

// ────────────────────────────────────────────
// i18n
// ────────────────────────────────────────────

type RushCopyMode = 'rush_15' | 'rush_30';

const QUIZ_COPY: Record<QuizLanguage, {
  heroTitle: string; heroSub: string; noMovies: string;
  swipeQuiz: string; swipeSkip: string; freeLimit: string;
  rush: string; rushSub: string;
  correct: string; wrong: string; next: string; finish: string; result: string;
  xpEarned: string; tryAgain: string; back: string; loading: string;
  questionsOf: string; rushModes: Record<RushCopyMode, { label: string; sub: string }>;
  dailyLimit: string; score: string; yourScore: string;
  quitConfirm: string; quitYes: string; quitNo: string; timeUp: string;
}> = {
  tr: {
    heroTitle: 'Film Hafızan Ne Kadar Güçlü?',
    heroSub: 'Filmi gör, sağa çek, soruları çöz.',
    noMovies: 'Henüz havuzda film yok.',
    swipeQuiz: 'Quiz Çöz', swipeSkip: 'Geç',
    freeLimit: 'Günlük 3 film hakkından',
    rush: 'Quiz Rush',
    rushSub: 'Karışık filmlerden sorular. Zamana karşı yarış.',
    correct: 'Doğru', wrong: 'Yanlış', next: 'Sonraki', finish: 'Bitir',
    result: 'Tamamlandı', xpEarned: 'XP Kazandın', tryAgain: 'Tekrar', back: 'Kapat',
    loading: 'Hazırlanıyor...', questionsOf: ' / ',
    rushModes: {
      rush_15: { label: 'Hızlı 15', sub: '15 soru · 90 saniye' },
      rush_30: { label: 'Maraton 30', sub: '30 soru · 150 saniye' },
    },
    dailyLimit: 'Günlük limit doldu', score: 'Skor', yourScore: 'Skorun',
    quitConfirm: 'Çıkarsan kazandığın XP\'ler sıfırlanır. Emin misin?', quitYes: 'Evet, çık', quitNo: 'Devam et', timeUp: 'Süre doldu!',
  },
  en: {
    heroTitle: 'How Strong Is Your Film Memory?',
    heroSub: 'See the film, swipe right, answer questions.',
    noMovies: 'No films in the pool yet.',
    swipeQuiz: 'Take Quiz', swipeSkip: 'Skip',
    freeLimit: 'of 3 daily films',
    rush: 'Quiz Rush',
    rushSub: 'Mixed questions from random films. Race against time.',
    correct: 'Correct', wrong: 'Wrong', next: 'Next', finish: 'Finish',
    result: 'Completed', xpEarned: 'XP Earned', tryAgain: 'Retry', back: 'Close',
    loading: 'Preparing...', questionsOf: ' / ',
    rushModes: {
      rush_15: { label: 'Quick 15', sub: '15 questions · 90 seconds' },
      rush_30: { label: 'Marathon 30', sub: '30 questions · 150 seconds' },
    },
    dailyLimit: 'Daily limit reached', score: 'Score', yourScore: 'Your Score',
    quitConfirm: 'If you quit, all XP earned will be lost. Are you sure?', quitYes: 'Yes, quit', quitNo: 'Continue', timeUp: 'Time\'s up!',
  },
  es: {
    heroTitle: 'Que tan fuerte es tu memoria cinematica?',
    heroSub: 'Ve la pelicula, desliza, responde preguntas.',
    noMovies: 'Aun no hay peliculas en el pool.',
    swipeQuiz: 'Hacer Quiz', swipeSkip: 'Saltar',
    freeLimit: 'de 3 peliculas diarias',
    rush: 'Quiz Rush',
    rushSub: 'Preguntas mixtas de peliculas al azar. Contra el reloj.',
    correct: 'Correcto', wrong: 'Incorrecto', next: 'Siguiente', finish: 'Terminar',
    result: 'Completado', xpEarned: 'XP Ganado', tryAgain: 'Reintentar', back: 'Cerrar',
    loading: 'Preparando...', questionsOf: ' / ',
    rushModes: {
      rush_15: { label: 'Rapido 15', sub: '15 preguntas · 90 segundos' },
      rush_30: { label: 'Maraton 30', sub: '30 preguntas · 150 segundos' },
    },
    dailyLimit: 'Limite diario alcanzado', score: 'Puntuacion', yourScore: 'Tu Puntuacion',
    quitConfirm: 'Si sales, perderas todo el XP ganado. Estas seguro?', quitYes: 'Si, salir', quitNo: 'Continuar', timeUp: 'Tiempo agotado!',
  },
  fr: {
    heroTitle: 'Quelle est la force de votre memoire cinema?',
    heroSub: 'Voyez le film, glissez, repondez aux questions.',
    noMovies: 'Pas encore de films dans le pool.',
    swipeQuiz: 'Faire le Quiz', swipeSkip: 'Passer',
    freeLimit: 'sur 3 films quotidiens',
    rush: 'Quiz Rush',
    rushSub: 'Questions mixtes de films aleatoires. Contre la montre.',
    correct: 'Correct', wrong: 'Incorrect', next: 'Suivant', finish: 'Terminer',
    result: 'Termine', xpEarned: 'XP Gagne', tryAgain: 'Reessayer', back: 'Fermer',
    loading: 'Preparation...', questionsOf: ' / ',
    rushModes: {
      rush_15: { label: 'Rapide 15', sub: '15 questions · 90 secondes' },
      rush_30: { label: 'Marathon 30', sub: '30 questions · 150 secondes' },
    },
    dailyLimit: 'Limite quotidienne atteinte', score: 'Score', yourScore: 'Votre Score',
    quitConfirm: 'Si vous quittez, tout le XP gagne sera perdu. Etes-vous sur?', quitYes: 'Oui, quitter', quitNo: 'Continuer', timeUp: 'Temps ecoule!',
  },
};

const getCopy = (lang: QuizLanguage) => QUIZ_COPY[lang] || QUIZ_COPY.en;

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

const IMAGE_PROXY_BASE = String(process.env.EXPO_PUBLIC_IMAGE_PROXIES || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || 'https://images.weserv.nl/?url=';

const buildPosterUri = (posterPath: string | null | undefined): string | null => {
  if (!posterPath) return null;
  const url = `${TMDB_IMAGE_BASE}${posterPath.startsWith('/') ? posterPath : `/${posterPath}`}`;
  if (Platform.OS !== 'web') return url;
  return `${IMAGE_PROXY_BASE}${encodeURIComponent(url)}`;
};

// ────────────────────────────────────────────
// PoolQuizModal — quiz for a selected film
// ────────────────────────────────────────────

// Per-question time limit (seconds)
const QUESTION_TIME_LIMIT = 15;

const PoolQuizModal = ({
  visible,
  movieId,
  language,
  isDawn,
  onClose,
  onXpGained,
}: {
  visible: boolean;
  movieId: string | null;
  language: QuizLanguage;
  isDawn: boolean;
  onClose: () => void;
  onXpGained?: (xp: number) => void;
}) => {
  const [state, setState] = useState<PoolQuizState>({ phase: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [revealed, setRevealed] = useState<{ selected: PoolOptionKey; isCorrect: boolean; correctKey: PoolOptionKey } | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerPulseRef = useRef(new Animated.Value(1));
  const copy = getCopy(language);
  const accent = isDawn ? '#A57164' : '#8A9A5B';

  // Track which questions have correct answers (for demo mode)
  const demoAnswersRef = useRef<Map<string, PoolOptionKey>>(new Map());
  // Refs for timer callback access
  const stateRef = useRef(state);
  const submittingRef = useRef(submitting);
  useEffect(() => { stateRef.current = state; });
  useEffect(() => { submittingRef.current = submitting; });

  // Clear timer helper
  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    timerPulseRef.current.stopAnimation();
    timerPulseRef.current.setValue(1);
  }, []);

  // Start timer for current question
  const startTimer = useCallback(() => {
    clearTimer();
    setTimeLeft(QUESTION_TIME_LIMIT);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  // Pulse animation when time is low
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && state.phase === 'active' && !state.answers.has(state.questions[state.current]?.id)) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulseRef.current, { toValue: 1.15, duration: 300, useNativeDriver: true }),
          Animated.timing(timerPulseRef.current, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      timerPulseRef.current.stopAnimation();
      timerPulseRef.current.setValue(1);
    }
  }, [timeLeft, state]);

  // Auto-fail when timer reaches 0
  useEffect(() => {
    if (timeLeft !== 0) return;
    const s = stateRef.current;
    if (s.phase !== 'active' || submittingRef.current) return;
    const q = s.questions[s.current];
    if (!q || s.answers.has(q.id)) return;
    // Time's up — mark wrong
    playTimeUpSound();
    const demoCorrect = demoAnswersRef.current.get(q.id);
    const demoQ = Object.values(DEMO_QUESTIONS).flatMap((d) => d.questions).find((dq) => dq.id === q.id);
    const newAnswers = new Map(s.answers);
    newAnswers.set(q.id, {
      selected: '_timeout' as PoolOptionKey, // no selection — time expired
      correct: false,
      explanation: demoQ?.explanation || '',
      correctOption: demoCorrect || 'a',
    });
    setState({ ...s, answers: newAnswers });
  }, [timeLeft]);

  useEffect(() => {
    if (!visible || !movieId) { setState({ phase: 'idle' }); clearTimer(); return; }
    setState({ phase: 'loading' });
    demoAnswersRef.current = new Map();

    fetchPoolQuiz({ movie_id: movieId, language }).then((res) => {
      if (res.ok) {
        setState({ phase: 'active', movieId: res.movie_id, title: res.title, questions: res.questions, current: 0, answers: new Map() });
      } else {
        const demo = DEMO_QUESTIONS[movieId];
        if (demo) {
          demo.questions.forEach((q) => demoAnswersRef.current.set(q.id, q.correct));
          setState({
            phase: 'active',
            movieId,
            title: demo.title,
            questions: demo.questions.map((q) => ({ id: q.id, question: q.question, options: q.options })),
            current: 0,
            answers: new Map(),
          });
        } else {
          setState({ phase: 'idle' });
        }
      }
    }).catch(() => {
      const demo = DEMO_QUESTIONS[movieId];
      if (demo) {
        demo.questions.forEach((q) => demoAnswersRef.current.set(q.id, q.correct));
        setState({
          phase: 'active',
          movieId,
          title: demo.title,
          questions: demo.questions.map((q) => ({ id: q.id, question: q.question, options: q.options })),
          current: 0,
          answers: new Map(),
        });
      } else {
        setState({ phase: 'idle' });
      }
    });
  }, [visible, movieId, language, clearTimer]);

  // Start timer when question changes
  useEffect(() => {
    if (state.phase === 'active' && !state.answers.has(state.questions[state.current]?.id)) {
      startTimer();
    }
    return () => clearTimer();
  }, [state.phase === 'active' ? state.current : null, startTimer, clearTimer]);

  const handleAnswer = useCallback(async (questionId: string, selected: PoolOptionKey) => {
    if (state.phase !== 'active' || submitting || revealed) return;
    clearTimer();
    setSubmitting(true);

    const res = await submitPoolAnswer({ movie_id: state.movieId, question_id: questionId, selected_option: selected, language }).catch(() => null);

    let isCorrect = false;
    let correctKey: PoolOptionKey = 'a';
    let explanation = '';

    if (res && res.ok) {
      isCorrect = res.is_correct;
      correctKey = res.correct_option;
      explanation = res.explanation;
    } else {
      const demoCorrect = demoAnswersRef.current.get(questionId);
      isCorrect = selected === demoCorrect;
      correctKey = demoCorrect || 'a';
      const demoQ = Object.values(DEMO_QUESTIONS).flatMap((d) => d.questions).find((q) => q.id === questionId);
      explanation = demoQ?.explanation || '';
    }

    if (isCorrect) { playCorrectSound(); setConfettiKey((k) => k + 1); }
    else playWrongSound();

    // Show reveal state for 900ms then commit answer
    setRevealed({ selected, isCorrect, correctKey });
    await new Promise<void>((r) => setTimeout(r, 900));
    setRevealed(null);

    const newAnswers = new Map(stateRef.current.phase === 'active' ? stateRef.current.answers : new Map());
    newAnswers.set(questionId, { selected, correct: isCorrect, explanation, correctOption: correctKey });
    setState((prev) => prev.phase === 'active' ? { ...prev, answers: newAnswers } : prev);
    setSubmitting(false);
  }, [state, submitting, revealed, language, clearTimer]);

  const handleNext = useCallback(() => {
    if (state.phase !== 'active') return;
    setState({ ...state, current: Math.min(state.current + 1, state.questions.length - 1) });
  }, [state]);

  const handleFinish = useCallback(() => {
    if (state.phase !== 'active') return;
    clearTimer();
    const correctCount = Array.from(state.answers.values()).filter((a) => a.correct).length;
    const totalXp = correctCount * 10 + (state.questions.length - correctCount) * 2;
    // Show interstitial ad before result screen (free users)
    void showInterstitialAd().then(() => {
      setState({ phase: 'result', title: state.title, total: state.questions.length, correct: correctCount, xpEarned: totalXp });
      if (totalXp > 0) onXpGained?.(totalXp);
    });
  }, [state, onXpGained, clearTimer]);

  const handleQuit = useCallback(() => {
    setShowQuitConfirm(true);
  }, []);

  const confirmQuit = useCallback(() => {
    clearTimer();
    setShowQuitConfirm(false);
    setState({ phase: 'idle' });
    onClose();
  }, [clearTimer, onClose]);

  if (!visible) return null;

  // Timer bar color: green → yellow → red
  const timerPct = timeLeft / QUESTION_TIME_LIMIT;
  const timerColor = timerPct > 0.5 ? accent : timerPct > 0.25 ? '#EAB308' : '#EF4444';

  // Result phase — full screen, no top bar
  if (state.phase === 'result') {
    return (
      <Modal visible animationType="fade" transparent={false}>
        <RushResultScreen
          total={state.total}
          correct={state.correct}
          xp={state.xpEarned}
          accent={accent}
          copy={copy}
          onRetry={onClose}
        />
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View style={qs.modalBg}>
        {/* Top bar with quit button */}
        <View style={qs.modalTopBar}>
          <Pressable onPress={handleQuit} hitSlop={12} accessibilityRole="button" accessibilityLabel={copy.back}>
            <Ionicons name="close" size={22} color="#8e8b84" />
          </Pressable>
          <Text style={qs.modalTopTitle} numberOfLines={1}>
            {state.phase === 'active' ? state.title : copy.loading}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Confetti blast on correct answer */}
        <ConfettiBlast trigger={confettiKey} />

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {state.phase === 'loading' && (
            <ActivityIndicator size="large" color={accent} style={{ marginTop: 60 }} />
          )}

          {state.phase === 'active' && (() => {
            const q = state.questions[state.current];
            if (!q) return null;
            const answer = state.answers.get(q.id);
            const isAnswered = Boolean(answer);
            const isTimeUp = isAnswered && (answer?.selected as string) === '_timeout';
            return (
              <View>
                {/* Progress dots */}
                <View style={qs.quizProgress}>
                  {state.questions.map((_, i) => (
                    <View key={i} style={[qs.quizDot,
                      i === state.current && { backgroundColor: accent },
                      i < state.current && state.answers.has(state.questions[i].id) && {
                        backgroundColor: state.answers.get(state.questions[i].id)?.correct ? '#4ade80' : '#f87171',
                      },
                    ]} />
                  ))}
                </View>

                {/* Timer bar */}
                {!isAnswered && !revealed && (
                  <Animated.View style={{ transform: [{ scale: timerPulseRef.current }], marginBottom: 14 }}>
                    <View style={qs.timerBarBg}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <View style={[qs.timerBarFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerColor }]} />
                    </View>
                    <Text style={[qs.timerCountdown, { color: timerColor }]}>{timeLeft}s</Text>
                  </Animated.View>
                )}

                {/* Time's up banner */}
                {isTimeUp && (
                  <View style={qs.timeUpBanner}>
                    <Ionicons name="alarm-outline" size={18} color="#EF4444" />
                    <Text style={qs.timeUpText}>{copy.timeUp}</Text>
                  </View>
                )}

                <Text style={qs.questionText}>{q.question}</Text>

                {/* Options — RushOption with press + reveal animation */}
                <View style={{ gap: 10, marginTop: 8 }}>
                  {q.options.map((opt) => {
                    // Reveal state (during 900ms window)
                    let revResult: 'correct' | 'wrong' | 'reveal' | null = null;
                    if (revealed) {
                      if (opt.key === revealed.selected && revealed.isCorrect) revResult = 'correct';
                      else if (opt.key === revealed.selected && !revealed.isCorrect) revResult = 'wrong';
                      else if (opt.key === revealed.correctKey && !revealed.isCorrect) revResult = 'reveal';
                    }
                    // Committed answer state (after 900ms)
                    if (!revealed && answer) {
                      if (opt.key === answer.selected && answer.correct) revResult = 'correct';
                      else if (opt.key === answer.selected && !answer.correct) revResult = 'wrong';
                      else if (opt.key === answer.correctOption && !answer.correct) revResult = 'reveal';
                    }
                    return (
                      <RushOption
                        key={opt.key}
                        opt={opt}
                        onPress={() => { if (!isAnswered && !revealed) void handleAnswer(q.id, opt.key); }}
                        disabled={isAnswered || !!submitting || !!revealed}
                        result={revResult}
                      />
                    );
                  })}
                </View>

                {/* Explanation after committed answer */}
                {answer && !revealed && (
                  <View style={qs.explanationBox}>
                    <Text style={[qs.feedbackTag, { color: answer.correct ? '#4ade80' : '#f87171' }]}>
                      {isTimeUp ? copy.timeUp : answer.correct ? copy.correct : copy.wrong}
                    </Text>
                    {answer.explanation ? <Text style={qs.explanationText}>{answer.explanation}</Text> : null}
                  </View>
                )}

                {/* Score bar below options */}
                {state.answers.size > 0 && (
                  <RushScoreBar
                    correct={Array.from(state.answers.values()).filter((a) => a.correct).length}
                    wrong={Array.from(state.answers.values()).filter((a) => !a.correct).length}
                  />
                )}

                {isAnswered && !revealed && state.current < state.questions.length - 1 && (
                  <Pressable style={[qs.actionBtn, { backgroundColor: accent, marginTop: 12 }]} onPress={handleNext} accessibilityRole="button">
                    <Text style={qs.actionBtnText}>{copy.next}</Text>
                  </Pressable>
                )}
                {isAnswered && !revealed && state.current === state.questions.length - 1 && (
                  <Pressable style={[qs.actionBtn, { backgroundColor: accent, marginTop: 12 }]} onPress={handleFinish} accessibilityRole="button">
                    <Text style={qs.actionBtnText}>{copy.finish}</Text>
                  </Pressable>
                )}
              </View>
            );
          })()}

        </ScrollView>

        {/* Quit confirmation overlay */}
        {showQuitConfirm && (
          <View style={qs.quitOverlay}>
            <View style={qs.quitBox}>
              <Ionicons name="warning-outline" size={32} color="#EF4444" />
              <Text style={qs.quitMsg}>{copy.quitConfirm}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <Pressable style={[qs.quitBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]} onPress={() => setShowQuitConfirm(false)}>
                  <Text style={[qs.quitBtnText, { color: '#E5E4E2' }]}>{copy.quitNo}</Text>
                </Pressable>
                <Pressable style={[qs.quitBtn, { backgroundColor: '#EF4444' }]} onPress={confirmQuit}>
                  <Text style={qs.quitBtnText}>{copy.quitYes}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ────────────────────────────────────────────
// RushTimer — animated countdown with circular progress feel
// ────────────────────────────────────────────

const RushTimer = ({ expiresAt, totalSeconds, onExpired }: { expiresAt: string; totalSeconds: number; onExpired: () => void }) => {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) { clearInterval(interval); onExpired(); }
    }, 250);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  // Pulse when under 15s
  useEffect(() => {
    if (remaining <= 15 && remaining > 0) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    pulse.setValue(1);
  }, [remaining <= 15, pulse]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const timerColor = pct > 0.4 ? '#8A9A5B' : pct > 0.2 ? '#EAB308' : '#EF4444';

  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ scale: pulse }] }}>
      <View style={qs.rushTimerRing}>
        <View style={[qs.rushTimerBarBg, { overflow: 'hidden' }]}>
          <View style={[qs.rushTimerBarFill, { width: `${pct * 100}%`, backgroundColor: timerColor }]} />
        </View>
      </View>
      <Text style={[qs.timerText, { color: timerColor, marginTop: 2 }]}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </Animated.View>
  );
};

// Rush answer flash feedback
const RushFlash = ({ type }: { type: 'correct' | 'wrong' | null }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!type) return;
    opacity.setValue(1);
    Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
  }, [type, opacity]);
  if (!type) return null;
  return (
    <Animated.View style={[qs.rushFlash, { opacity, backgroundColor: type === 'correct' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)' }]}>
      <Ionicons name={type === 'correct' ? 'checkmark-circle' : 'close-circle'} size={42} color={type === 'correct' ? '#4ade80' : '#f87171'} />
    </Animated.View>
  );
};

// ────────────────────────────────────────────
// Demo films (fallback until pool is populated)
// ────────────────────────────────────────────

const DEMO_FILMS: PoolMovie[] = [
  { id: 'demo-1', title: 'American Pie', poster_path: '/5P68by2Thn8wHAziyWGEw2O7hco.jpg', release_year: 1999, vote_average: 6.6, question_count: 5 },
  { id: 'demo-2', title: 'Dune', poster_path: '/gDzOcq0pfeCeqMBwKIJlSmQpjkZ.jpg', release_year: 2021, vote_average: 7.8, question_count: 5 },
  { id: 'demo-3', title: 'Donnie Darko', poster_path: '/fhQoQfejY1hUcwyuLgpBrYs6uFt.jpg', release_year: 2001, vote_average: 7.8, question_count: 5 },
  { id: 'demo-4', title: 'The Tomorrow War', poster_path: '/34nDCQZwaEvsy4CFO5hkGRFDCVU.jpg', release_year: 2021, vote_average: 6.8, question_count: 5 },
  { id: 'demo-5', title: 'Flipped', poster_path: '/6zDYFigohwncqFL00MKbFV01dWb.jpg', release_year: 2010, vote_average: 8.0, question_count: 5 },
];

// ────────────────────────────────────────────
// Demo questions (fallback until API is live)
// ────────────────────────────────────────────

const DEMO_QUESTIONS: Record<string, { title: string; questions: Array<{ id: string; question: string; correct: PoolOptionKey; explanation: string; options: Array<{ key: PoolOptionKey; label: string }> }> }> = {
  'demo-1': {
    title: 'American Pie',
    questions: [
      { id: 'dq1', question: 'American Pie filminde Jim\'in babasini canlandiran oyuncu kimdir?', correct: 'b', explanation: 'Eugene Levy, serinin tum filmlerinde Jim\'in babasi rolunu oynamistir.', options: [{ key: 'a', label: 'Steve Martin' }, { key: 'b', label: 'Eugene Levy' }, { key: 'c', label: 'John Cleese' }, { key: 'd', label: 'Bob Newhart' }] },
      { id: 'dq2', question: 'Film hangi yil vizyona girmistir?', correct: 'c', explanation: 'American Pie 1999 yazinda vizyona girdi ve buyuk gisze basarisi elde etti.', options: [{ key: 'a', label: '1997' }, { key: 'b', label: '1998' }, { key: 'c', label: '1999' }, { key: 'd', label: '2000' }] },
      { id: 'dq3', question: 'Filmdeki liseli arkadaslar hangi etkinlik oncesi bir andasma yapar?', correct: 'a', explanation: 'Dort arkadas mezuniyet balosu oncesinde bakireliklerini kaybetme sozulesir.', options: [{ key: 'a', label: 'Mezuniyet balosu' }, { key: 'b', label: 'Yaz tatili' }, { key: 'c', label: 'Futbol maci' }, { key: 'd', label: 'Yilbasi partisi' }] },
      { id: 'dq4', question: 'Stifler\'in annesi kavramini populer yapan karakter kimdir?', correct: 'd', explanation: 'Jennifer Coolidge, Stifler\'in annesi Jeanine Stifler rolunu canlandirmistir.', options: [{ key: 'a', label: 'Shannon Elizabeth' }, { key: 'b', label: 'Tara Reid' }, { key: 'c', label: 'Mena Suvari' }, { key: 'd', label: 'Jennifer Coolidge' }] },
      { id: 'dq5', question: 'Filmin yonetmeni kimdir?', correct: 'b', explanation: 'Paul Weitz, kardesii Chris Weitz ile birlikte filmi yonetmistir.', options: [{ key: 'a', label: 'Judd Apatow' }, { key: 'b', label: 'Paul Weitz' }, { key: 'c', label: 'Todd Phillips' }, { key: 'd', label: 'Adam McKay' }] },
    ],
  },
  'demo-2': {
    title: 'Dune',
    questions: [
      { id: 'dq6', question: 'Dune filminde Paul Atreides\'i canlandiran oyuncu kimdir?', correct: 'a', explanation: 'Timothee Chalamet, Paul Atreides rolunu ustaca yorumlamistir.', options: [{ key: 'a', label: 'Timothee Chalamet' }, { key: 'b', label: 'Tom Holland' }, { key: 'c', label: 'Robert Pattinson' }, { key: 'd', label: 'Ansel Elgort' }] },
      { id: 'dq7', question: 'Arrakis gezegeninde en degerli kaynak nedir?', correct: 'c', explanation: 'Baharat (Melange), evrende en degerli maddedir ve sadece Arrakis\'te bulunur.', options: [{ key: 'a', label: 'Altin' }, { key: 'b', label: 'Su' }, { key: 'c', label: 'Baharat (Melange)' }, { key: 'd', label: 'Petrol' }] },
      { id: 'dq8', question: 'Filmin yonetmeni kimdir?', correct: 'b', explanation: 'Denis Villeneuve, Blade Runner 2049 ve Arrival filmlerinin de yonetmenidir.', options: [{ key: 'a', label: 'Christopher Nolan' }, { key: 'b', label: 'Denis Villeneuve' }, { key: 'c', label: 'Ridley Scott' }, { key: 'd', label: 'David Lynch' }] },
      { id: 'dq9', question: 'Arrakis\'in yerli halki nasil adlandirilir?', correct: 'a', explanation: 'Fremenler, Arrakis collerinde yasayan ve baharat dongusuyle ic ice gecmis bir halktir.', options: [{ key: 'a', label: 'Fremen' }, { key: 'b', label: 'Sardaukar' }, { key: 'c', label: 'Harkonnen' }, { key: 'd', label: 'Bene Gesserit' }] },
      { id: 'dq10', question: 'Atreides ailesinin dusmani hangi ailedir?', correct: 'd', explanation: 'Baron Vladimir Harkonnen liderligindeki Harkonnen ailesi, Atreides\'lerin ezeli dusmanidır.', options: [{ key: 'a', label: 'Corrino' }, { key: 'b', label: 'Ordos' }, { key: 'c', label: 'Fenring' }, { key: 'd', label: 'Harkonnen' }] },
    ],
  },
  'demo-3': {
    title: 'Donnie Darko',
    questions: [
      { id: 'dq11', question: 'Donnie Darko\'yu canlandiran oyuncu kimdir?', correct: 'a', explanation: 'Jake Gyllenhaal, bu kult filmle tanindi.', options: [{ key: 'a', label: 'Jake Gyllenhaal' }, { key: 'b', label: 'Tobey Maguire' }, { key: 'c', label: 'Elijah Wood' }, { key: 'd', label: 'Joseph Gordon-Levitt' }] },
      { id: 'dq12', question: 'Donnie\'ye gorunen tavsan karakterinin adi nedir?', correct: 'c', explanation: 'Frank, Donnie\'ye dunyanin sonunu haber veren gizemli tavsan figurdur.', options: [{ key: 'a', label: 'Harvey' }, { key: 'b', label: 'Roger' }, { key: 'c', label: 'Frank' }, { key: 'd', label: 'Peter' }] },
      { id: 'dq13', question: 'Film hangi on yilin atmosferini yansitir?', correct: 'b', explanation: 'Film 1988\'de gecmektedir ve 80\'lerin kulturel atmosferini basariyla yansitir.', options: [{ key: 'a', label: '1970\'ler' }, { key: 'b', label: '1980\'ler' }, { key: 'c', label: '1990\'lar' }, { key: 'd', label: '2000\'ler' }] },
      { id: 'dq14', question: 'Filmin ana temasi nedir?', correct: 'b', explanation: 'Zaman yolculugu ve paralel evrenler filmin merkezinde yer alir.', options: [{ key: 'a', label: 'Uzay kesfii' }, { key: 'b', label: 'Zaman yolculugu' }, { key: 'c', label: 'Seri cinayet' }, { key: 'd', label: 'Savaş' }] },
      { id: 'dq15', question: 'Donnie\'nin evine ne duser?', correct: 'a', explanation: 'Bir ucak motoru gizemli bir sekilde Donnie\'nin yatak odasina duser.', options: [{ key: 'a', label: 'Ucak motoru' }, { key: 'b', label: 'Meteor' }, { key: 'c', label: 'Uydu' }, { key: 'd', label: 'Helikopter' }] },
    ],
  },
};

// ────────────────────────────────────────────
// Demo rush questions (mixed films, fallback)
// ────────────────────────────────────────────

const DEMO_RUSH_QUESTIONS: Array<{
  id: string; question_id: string; movie_title: string; question: string;
  correct: PoolOptionKey; explanation: string;
  options: Array<{ key: PoolOptionKey; label: string }>;
}> = [
  { id: 'dr1', question_id: 'dq1', movie_title: 'American Pie', question: 'American Pie filminde Jim\'in babasini canlandiran oyuncu kimdir?', correct: 'b', explanation: 'Eugene Levy, serinin tum filmlerinde Jim\'in babasi rolunu oynamistir.', options: [{ key: 'a', label: 'Steve Martin' }, { key: 'b', label: 'Eugene Levy' }, { key: 'c', label: 'John Cleese' }, { key: 'd', label: 'Bob Newhart' }] },
  { id: 'dr2', question_id: 'dq6', movie_title: 'Dune', question: 'Dune filminde Paul Atreides\'i canlandiran oyuncu kimdir?', correct: 'a', explanation: 'Timothee Chalamet, Paul Atreides rolunu ustaca yorumlamistir.', options: [{ key: 'a', label: 'Timothee Chalamet' }, { key: 'b', label: 'Tom Holland' }, { key: 'c', label: 'Robert Pattinson' }, { key: 'd', label: 'Ansel Elgort' }] },
  { id: 'dr3', question_id: 'dq12', movie_title: 'Donnie Darko', question: 'Donnie\'ye gorunen tavsan karakterinin adi nedir?', correct: 'c', explanation: 'Frank, Donnie\'ye dunyanin sonunu haber veren gizemli tavsan figurdur.', options: [{ key: 'a', label: 'Harvey' }, { key: 'b', label: 'Roger' }, { key: 'c', label: 'Frank' }, { key: 'd', label: 'Peter' }] },
  { id: 'dr4', question_id: 'dq7', movie_title: 'Dune', question: 'Arrakis gezegeninde en degerli kaynak nedir?', correct: 'c', explanation: 'Baharat (Melange), evrende en degerli maddedir.', options: [{ key: 'a', label: 'Altin' }, { key: 'b', label: 'Su' }, { key: 'c', label: 'Baharat (Melange)' }, { key: 'd', label: 'Petrol' }] },
  { id: 'dr5', question_id: 'dq3', movie_title: 'American Pie', question: 'Filmdeki liseli arkadaslar hangi etkinlik oncesi bir andasma yapar?', correct: 'a', explanation: 'Dort arkadas mezuniyet balosu oncesinde sozlesir.', options: [{ key: 'a', label: 'Mezuniyet balosu' }, { key: 'b', label: 'Yaz tatili' }, { key: 'c', label: 'Futbol maci' }, { key: 'd', label: 'Yilbasi partisi' }] },
  { id: 'dr6', question_id: 'dq14', movie_title: 'Donnie Darko', question: 'Filmin ana temasi nedir?', correct: 'b', explanation: 'Zaman yolculugu ve paralel evrenler filmin merkezinde yer alir.', options: [{ key: 'a', label: 'Uzay kesfii' }, { key: 'b', label: 'Zaman yolculugu' }, { key: 'c', label: 'Seri cinayet' }, { key: 'd', label: 'Savas' }] },
  { id: 'dr7', question_id: 'dq8', movie_title: 'Dune', question: 'Dune filminin yonetmeni kimdir?', correct: 'b', explanation: 'Denis Villeneuve, Blade Runner 2049 ve Arrival filmlerinin de yonetmenidir.', options: [{ key: 'a', label: 'Christopher Nolan' }, { key: 'b', label: 'Denis Villeneuve' }, { key: 'c', label: 'Ridley Scott' }, { key: 'd', label: 'David Lynch' }] },
  { id: 'dr8', question_id: 'dq15', movie_title: 'Donnie Darko', question: 'Donnie\'nin evine ne duser?', correct: 'a', explanation: 'Bir ucak motoru gizemli bir sekilde Donnie\'nin yatak odasina duser.', options: [{ key: 'a', label: 'Ucak motoru' }, { key: 'b', label: 'Meteor' }, { key: 'c', label: 'Uydu' }, { key: 'd', label: 'Helikopter' }] },
  { id: 'dr9', question_id: 'dq4', movie_title: 'American Pie', question: 'Stifler\'in annesi kavramini populer yapan oyuncu kimdir?', correct: 'd', explanation: 'Jennifer Coolidge, Stifler\'in annesi rolunu canlandirmistir.', options: [{ key: 'a', label: 'Shannon Elizabeth' }, { key: 'b', label: 'Tara Reid' }, { key: 'c', label: 'Mena Suvari' }, { key: 'd', label: 'Jennifer Coolidge' }] },
  { id: 'dr10', question_id: 'dq10', movie_title: 'Dune', question: 'Atreides ailesinin dusmani hangi ailedir?', correct: 'd', explanation: 'Baron Vladimir Harkonnen liderligindeki Harkonnen ailesi ezeli dusmandir.', options: [{ key: 'a', label: 'Corrino' }, { key: 'b', label: 'Ordos' }, { key: 'c', label: 'Fenring' }, { key: 'd', label: 'Harkonnen' }] },
  { id: 'dr11', question_id: 'dq2', movie_title: 'American Pie', question: 'American Pie hangi yil vizyona girmistir?', correct: 'c', explanation: 'American Pie 1999 yazinda vizyona girdi.', options: [{ key: 'a', label: '1997' }, { key: 'b', label: '1998' }, { key: 'c', label: '1999' }, { key: 'd', label: '2000' }] },
  { id: 'dr12', question_id: 'dq11', movie_title: 'Donnie Darko', question: 'Donnie Darko\'yu canlandiran oyuncu kimdir?', correct: 'a', explanation: 'Jake Gyllenhaal, bu kult filmle tanindi.', options: [{ key: 'a', label: 'Jake Gyllenhaal' }, { key: 'b', label: 'Tobey Maguire' }, { key: 'c', label: 'Elijah Wood' }, { key: 'd', label: 'Joseph Gordon-Levitt' }] },
  { id: 'dr13', question_id: 'dq9', movie_title: 'Dune', question: 'Arrakis\'in yerli halki nasil adlandirilir?', correct: 'a', explanation: 'Fremenler, Arrakis collerinde yasayan bir halktir.', options: [{ key: 'a', label: 'Fremen' }, { key: 'b', label: 'Sardaukar' }, { key: 'c', label: 'Harkonnen' }, { key: 'd', label: 'Bene Gesserit' }] },
  { id: 'dr14', question_id: 'dq5', movie_title: 'American Pie', question: 'American Pie\'in yonetmeni kimdir?', correct: 'b', explanation: 'Paul Weitz, kardesii Chris Weitz ile birlikte filmi yonetmistir.', options: [{ key: 'a', label: 'Judd Apatow' }, { key: 'b', label: 'Paul Weitz' }, { key: 'c', label: 'Todd Phillips' }, { key: 'd', label: 'Adam McKay' }] },
  { id: 'dr15', question_id: 'dq13', movie_title: 'Donnie Darko', question: 'Film hangi on yilin atmosferini yansitir?', correct: 'b', explanation: 'Film 1988\'de gecmektedir ve 80\'lerin kulturel atmosferini yansitir.', options: [{ key: 'a', label: '1970\'ler' }, { key: 'b', label: '1980\'ler' }, { key: 'c', label: '1990\'lar' }, { key: 'd', label: '2000\'ler' }] },
  { id: 'dr16', question_id: 'extra1', movie_title: 'The Tomorrow War', question: 'The Tomorrow War filminin bascrol oyuncusu kimdir?', correct: 'a', explanation: 'Chris Pratt, Dan Forester karakterini canlandirmistir.', options: [{ key: 'a', label: 'Chris Pratt' }, { key: 'b', label: 'Chris Evans' }, { key: 'c', label: 'Chris Hemsworth' }, { key: 'd', label: 'Chris Pine' }] },
  { id: 'dr17', question_id: 'extra2', movie_title: 'The Tomorrow War', question: 'Filmde insanlik hangi tehditle karsi karsiya kalir?', correct: 'b', explanation: 'Whitespike adli uzayli yaratiklar insanligi yok etme tehdidir.', options: [{ key: 'a', label: 'Zombiler' }, { key: 'b', label: 'Uzaylilar' }, { key: 'c', label: 'Robotlar' }, { key: 'd', label: 'Virusler' }] },
  { id: 'dr18', question_id: 'extra3', movie_title: 'Flipped', question: 'Flipped filmi hangi yil vizyona girmistir?', correct: 'c', explanation: 'Rob Reiner yonetmenligindeki film 2010 yilinda vizyona girdi.', options: [{ key: 'a', label: '2008' }, { key: 'b', label: '2009' }, { key: 'c', label: '2010' }, { key: 'd', label: '2011' }] },
  { id: 'dr19', question_id: 'extra4', movie_title: 'Flipped', question: 'Flipped filminin yonetmeni kimdir?', correct: 'a', explanation: 'Rob Reiner, The Princess Bride ve Stand By Me filmlerinin de yonetmenidir.', options: [{ key: 'a', label: 'Rob Reiner' }, { key: 'b', label: 'Richard Linklater' }, { key: 'c', label: 'John Hughes' }, { key: 'd', label: 'Cameron Crowe' }] },
  { id: 'dr20', question_id: 'extra5', movie_title: 'The Tomorrow War', question: 'The Tomorrow War hangi platformda yayinlanmistir?', correct: 'd', explanation: 'Film sinema yerine Amazon Prime Video\'da yayinlandi.', options: [{ key: 'a', label: 'Netflix' }, { key: 'b', label: 'Disney+' }, { key: 'c', label: 'HBO Max' }, { key: 'd', label: 'Amazon Prime Video' }] },
  { id: 'dr21', question_id: 'extra6', movie_title: 'Flipped', question: 'Flipped filminde hikaye kac karakterin bakis acisindan anlatilir?', correct: 'b', explanation: 'Film, Juli ve Bryce\'in bakis acisindan paralel olarak anlatilir.', options: [{ key: 'a', label: '1' }, { key: 'b', label: '2' }, { key: 'c', label: '3' }, { key: 'd', label: '4' }] },
  { id: 'dr22', question_id: 'extra7', movie_title: 'American Pie', question: 'American Pie serisinde kac ana film vardir?', correct: 'c', explanation: 'Ana seri 4 filmden olusur: American Pie, AP2, American Wedding ve American Reunion.', options: [{ key: 'a', label: '2' }, { key: 'b', label: '3' }, { key: 'c', label: '4' }, { key: 'd', label: '5' }] },
  { id: 'dr23', question_id: 'extra8', movie_title: 'Dune', question: 'Dune romaninin yazari kimdir?', correct: 'a', explanation: 'Frank Herbert, 1965\'te Dune romanini yayinlamistir.', options: [{ key: 'a', label: 'Frank Herbert' }, { key: 'b', label: 'Isaac Asimov' }, { key: 'c', label: 'Arthur C. Clarke' }, { key: 'd', label: 'Philip K. Dick' }] },
  { id: 'dr24', question_id: 'extra9', movie_title: 'Donnie Darko', question: 'Donnie Darko filminin turunu en iyi tanimlayan nedir?', correct: 'c', explanation: 'Film bilim kurgu, dram ve psikolojik gerilim unsurlarini birlestirir.', options: [{ key: 'a', label: 'Komedi' }, { key: 'b', label: 'Aksiyon' }, { key: 'c', label: 'Psikolojik bilim kurgu' }, { key: 'd', label: 'Korku' }] },
  { id: 'dr25', question_id: 'extra10', movie_title: 'The Tomorrow War', question: 'The Tomorrow War filminde zaman yolculugu hangi yila yapilir?', correct: 'd', explanation: 'Askerler 2051 yilina teleport edilerek uzaylilara karsi savasir.', options: [{ key: 'a', label: '2030' }, { key: 'b', label: '2040' }, { key: 'c', label: '2045' }, { key: 'd', label: '2051' }] },
  { id: 'dr26', question_id: 'extra11', movie_title: 'Flipped', question: 'Flipped filminde Juli\'nin en cok deger verdigi sey nedir?', correct: 'b', explanation: 'Juli, evinin onundeki cicnar agacina cok baglidir ve kesilmesine karsi cikar.', options: [{ key: 'a', label: 'Kedisi' }, { key: 'b', label: 'Cicnar agaci' }, { key: 'c', label: 'Bisikleti' }, { key: 'd', label: 'Gunlugu' }] },
  { id: 'dr27', question_id: 'extra12', movie_title: 'Dune', question: 'Paul Atreides\'in annesi hangi orgute mensuptur?', correct: 'b', explanation: 'Lady Jessica, gizli Bene Gesserit tarikatinin bir uyesidir.', options: [{ key: 'a', label: 'Fremen' }, { key: 'b', label: 'Bene Gesserit' }, { key: 'c', label: 'Spacing Guild' }, { key: 'd', label: 'Sardaukar' }] },
  { id: 'dr28', question_id: 'extra13', movie_title: 'American Pie', question: 'Jim\'in utanc verici aninin yayinlandigi cihaz nedir?', correct: 'a', explanation: 'Jim\'in web kamerasi anı tum okula internet uzerinden yayilir.', options: [{ key: 'a', label: 'Web kamerasi' }, { key: 'b', label: 'Telefon' }, { key: 'c', label: 'Video kamera' }, { key: 'd', label: 'Polaroid' }] },
  { id: 'dr29', question_id: 'extra14', movie_title: 'Donnie Darko', question: 'Film hangi ulkede gecmektedir?', correct: 'a', explanation: 'Film Virginia eyaletinde kucuk bir Amerikan kasabasinda gecmektedir.', options: [{ key: 'a', label: 'ABD' }, { key: 'b', label: 'Ingiltere' }, { key: 'c', label: 'Kanada' }, { key: 'd', label: 'Avustralya' }] },
  { id: 'dr30', question_id: 'extra15', movie_title: 'The Tomorrow War', question: 'Filmde uzayli yaratiklarin adi nedir?', correct: 'c', explanation: 'Whitespike olarak adlandirilan yaratiklar son derece hizli ve olumculdur.', options: [{ key: 'a', label: 'Xenomorph' }, { key: 'b', label: 'Kaiju' }, { key: 'c', label: 'Whitespike' }, { key: 'd', label: 'Predator' }] },
];

// Poster lookup for rush film thumbnails
const RUSH_POSTER_MAP: Record<string, string> = {
  'American Pie': '/5P68by2Thn8wHAziyWGEw2O7hco.jpg',
  'Dune': '/gDzOcq0pfeCeqMBwKIJlSmQpjkZ.jpg',
  'Donnie Darko': '/fhQoQfejY1hUcwyuLgpBrYs6uFt.jpg',
  'The Tomorrow War': '/34nDCQZwaEvsy4CFO5hkGRFDCVU.jpg',
  'Flipped': '/6zDYFigohwncqFL00MKbFV01dWb.jpg',
};

const buildDemoRushSession = (mode: RushMode): RushSession => {
  const count = mode === 'rush_15' ? 15 : 30;
  const questions = DEMO_RUSH_QUESTIONS.slice(0, count).map((q) => ({
    id: q.id,
    question_id: q.question_id,
    movie_title: q.movie_title,
    question: q.question,
    options: q.options,
  }));
  const durationSec = mode === 'rush_15' ? 90 : 150;
  return {
    id: `demo-rush-${Date.now()}`,
    mode,
    expires_at: new Date(Date.now() + durationSec * 1000).toISOString(),
    questions,
  };
};

// ────────────────────────────────────────────
// ConfettiBlast — correct answer celebration
// ────────────────────────────────────────────

const CONFETTI_COLORS = ['#4ade80','#facc15','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#f87171'];
const CONFETTI_COUNT = 38;

type ConfettiParticle = {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  isCircle: boolean;
};

const ConfettiBlast = ({ trigger }: { trigger: number }) => {
  const particles = useRef<ConfettiParticle[]>([]);
  const prevTrigger = useRef(0);

  useEffect(() => {
    if (particles.current.length === 0) {
      particles.current = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(0),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 8,
        isCircle: Math.random() > 0.5,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (trigger === 0 || trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;

    const anims = particles.current.map((p) => {
      const startX = (Math.random() - 0.5) * 60;
      const endX = startX + (Math.random() - 0.5) * 260;
      const endY = -(180 + Math.random() * 220);
      const rotations = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 5);

      p.x.setValue(startX);
      p.y.setValue(0);
      p.rotate.setValue(0);
      p.opacity.setValue(1);

      return Animated.parallel([
        Animated.timing(p.x, { toValue: endX, duration: 700 + Math.random() * 400, useNativeDriver: true, easing: (t) => t }),
        Animated.sequence([
          Animated.timing(p.y, { toValue: endY * 0.6, duration: 400 + Math.random() * 200, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: endY + 60, duration: 350 + Math.random() * 200, useNativeDriver: true }),
        ]),
        Animated.timing(p.rotate, { toValue: rotations, duration: 900 + Math.random() * 300, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.delay(500 + Math.random() * 200),
          Animated.timing(p.opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.stagger(18, anims).start();
  }, [trigger]);

  if (trigger === 0) return null;

  return (
    <View style={qs.confettiContainer} pointerEvents="none">
      {particles.current.map((p, i) => {
        const rotateDeg = p.rotate.interpolate({ inputRange: [-10, 10], outputRange: ['-3600deg', '3600deg'] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              bottom: '8%',
              left: '50%',
              width: p.size,
              height: p.isCircle ? p.size : p.size * 1.6,
              borderRadius: p.isCircle ? p.size / 2 : 2,
              backgroundColor: p.color,
              transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: rotateDeg }],
              opacity: p.opacity,
            }}
          />
        );
      })}
    </View>
  );
};

// ────────────────────────────────────────────
// RushResultScreen — animated end screen
// ────────────────────────────────────────────

const RushResultScreen = ({
  total, correct, xp, accent, onRetry, copy,
}: {
  total: number; correct: number; xp: number;
  accent: string; onRetry: () => void; copy: ReturnType<typeof getCopy>;
}) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const grade = pct >= 80 ? 'S' : pct >= 60 ? 'A' : pct >= 40 ? 'B' : 'C';
  const gradeColor = pct >= 80 ? '#facc15' : pct >= 60 ? '#4ade80' : pct >= 40 ? '#60a5fa' : '#f87171';
  const gradeLabel = pct >= 80 ? 'Mükemmel!' : pct >= 60 ? 'Harika!' : pct >= 40 ? 'İyi İş!' : 'Devam Et!';

  // Entrance animations
  const circleScale  = useRef(new Animated.Value(0)).current;
  const gradeOpacity = useRef(new Animated.Value(0)).current;
  const statsSlide   = useRef(new Animated.Value(40)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const btnSlide     = useRef(new Animated.Value(30)).current;
  const btnOpacity   = useRef(new Animated.Value(0)).current;
  const confettiKey  = useRef(pct >= 60 ? 1 : 0).current;

  // XP counter
  const [xpDisplay, setXpDisplay] = useState(0);

  useEffect(() => {
    // Sequence: circle pops → grade fades → stats slide up → btn slides up
    Animated.sequence([
      Animated.spring(circleScale, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 14 }),
      Animated.parallel([
        Animated.timing(gradeOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(statsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(statsSlide,   { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(btnSlide,   { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    // XP count-up
    const target = xp;
    const steps  = 30;
    const interval = 800 / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setXpDisplay(Math.round((target / steps) * step));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      {/* Confetti for good scores */}
      <ConfettiBlast trigger={confettiKey} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 0 }}>

        {/* Grade circle */}
        <Animated.View style={{ transform: [{ scale: circleScale }], alignItems: 'center', marginBottom: 8 }}>
          <View style={[qs.rushResultCircle, { borderColor: gradeColor, shadowColor: gradeColor }]}>
            <Text style={[qs.rushResultGrade, { color: gradeColor }]}>{grade}</Text>
          </View>
          <Animated.Text style={[qs.rushResultGradeLabel, { color: gradeColor, opacity: gradeOpacity }]}>{gradeLabel}</Animated.Text>
        </Animated.View>

        {/* Stats row */}
        <Animated.View style={[qs.rushResultStatsRow, { opacity: statsOpacity, transform: [{ translateY: statsSlide }] }]}>
          <View style={qs.rushResultStatBox}>
            <Text style={[qs.rushResultStatNum, { color: '#4ade80' }]}>{correct}</Text>
            <Text style={qs.rushResultStatLabel}>Doğru</Text>
          </View>
          <View style={qs.rushResultStatDivider} />
          <View style={qs.rushResultStatBox}>
            <Text style={[qs.rushResultStatNum, { color: '#f87171' }]}>{total - correct}</Text>
            <Text style={qs.rushResultStatLabel}>Yanlış</Text>
          </View>
          <View style={qs.rushResultStatDivider} />
          <View style={qs.rushResultStatBox}>
            <Text style={[qs.rushResultStatNum, { color: '#facc15' }]}>{pct}%</Text>
            <Text style={qs.rushResultStatLabel}>Başarı</Text>
          </View>
        </Animated.View>

        {/* XP earned */}
        <Animated.View style={[qs.rushResultXpBox, { opacity: statsOpacity, transform: [{ translateY: statsSlide }] }]}>
          <Ionicons name="flash" size={22} color={accent} />
          <Text style={[qs.rushResultXpNum, { color: accent }]}>+{xpDisplay}</Text>
          <Text style={qs.rushResultXpLabel}>XP</Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={{ width: '100%', gap: 10, opacity: btnOpacity, transform: [{ translateY: btnSlide }], marginTop: 28 }}>
          <Pressable style={[qs.actionBtn, { backgroundColor: accent }]} onPress={onRetry} accessibilityRole="button">
            <Ionicons name="refresh" size={18} color="#0a0a0a" style={{ marginRight: 6 }} />
            <Text style={qs.actionBtnText}>{copy.tryAgain}</Text>
          </Pressable>
        </Animated.View>

      </View>
    </View>
  );
};

// ────────────────────────────────────────────
// RushOption — animated pressable option button
// ────────────────────────────────────────────

const RushOption = ({
  opt, onPress, disabled, result,
}: {
  opt: { key: PoolOptionKey; label: string };
  onPress: () => void;
  disabled: boolean;
  result?: 'correct' | 'wrong' | 'reveal' | null; // correct=this was right & selected, wrong=selected but wrong, reveal=correct but not selected
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const highlightOpacity = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  // When result arrives, flash highlight in
  useEffect(() => {
    if (result) {
      Animated.timing(highlightOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      highlightOpacity.setValue(0);
    }
  }, [result, highlightOpacity]);

  const highlightColor =
    result === 'correct' ? 'rgba(74,222,128,0.25)' :
    result === 'reveal'  ? 'rgba(74,222,128,0.15)' :
    result === 'wrong'   ? 'rgba(248,113,113,0.30)' :
    'rgba(255,255,255,0.06)';

  const borderColor =
    result === 'correct' ? '#4ade80' :
    result === 'reveal'  ? '#4ade80' :
    result === 'wrong'   ? '#f87171' :
    'rgba(255,255,255,0.10)';

  const badgeBg =
    result === 'correct' ? '#4ade80' :
    result === 'reveal'  ? 'rgba(74,222,128,0.4)' :
    result === 'wrong'   ? '#f87171' :
    'rgba(255,255,255,0.10)';

  const badgeTextColor =
    result === 'correct' || result === 'wrong' ? '#0a0a0a' : '#ccc';

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled} accessibilityRole="button">
      <Animated.View style={[qs.rushOptionBtn, { transform: [{ scale }], borderColor }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: highlightColor, opacity: highlightOpacity }]} />
        <View style={[qs.rushOptionBadge, { backgroundColor: badgeBg }]}>
          <Text style={[qs.rushOptionBadgeText, { color: badgeTextColor }]}>
            {result === 'correct' || result === 'reveal' ? '✓' : result === 'wrong' ? '✗' : opt.key.toUpperCase()}
          </Text>
        </View>
        <Text style={qs.rushOptionLabel} numberOfLines={2}>{opt.label}</Text>
      </Animated.View>
    </Pressable>
  );
};

// ────────────────────────────────────────────
// RushScoreBar — animated correct/wrong counter
// ────────────────────────────────────────────

const RushScoreBar = ({ correct, wrong }: { correct: number; wrong: number }) => {
  const correctScale = useRef(new Animated.Value(1)).current;
  const wrongScale = useRef(new Animated.Value(1)).current;
  const prevCorrect = useRef(correct);
  const prevWrong = useRef(wrong);

  useEffect(() => {
    if (correct !== prevCorrect.current) {
      prevCorrect.current = correct;
      Animated.sequence([
        Animated.spring(correctScale, { toValue: 1.4, useNativeDriver: true, speed: 60, bounciness: 10 }),
        Animated.spring(correctScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }),
      ]).start();
    }
  }, [correct, correctScale]);

  useEffect(() => {
    if (wrong !== prevWrong.current) {
      prevWrong.current = wrong;
      Animated.sequence([
        Animated.spring(wrongScale, { toValue: 1.4, useNativeDriver: true, speed: 60, bounciness: 10 }),
        Animated.spring(wrongScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }),
      ]).start();
    }
  }, [wrong, wrongScale]);

  return (
    <View style={qs.rushScoreRow}>
      <Animated.View style={[qs.rushScoreItem, { transform: [{ scale: correctScale }] }]}>
        <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
        <Text style={[qs.rushScoreNum, { color: '#4ade80' }]}>{correct}</Text>
      </Animated.View>
      <View style={qs.rushScoreDivider} />
      <Animated.View style={[qs.rushScoreItem, { transform: [{ scale: wrongScale }] }]}>
        <Ionicons name="close-circle" size={24} color="#f87171" />
        <Text style={[qs.rushScoreNum, { color: '#f87171' }]}>{wrong}</Text>
      </Animated.View>
    </View>
  );
};

// ────────────────────────────────────────────
// QuizHomeScreen — main Quiz tab
// ────────────────────────────────────────────

export const QuizHomeScreen = ({
  language,
  isDawn,
  isSignedIn,
  isPremium = false,
  onRequireAuth,
  onRequirePaywall,
}: {
  language: QuizLanguage;
  isDawn: boolean;
  isSignedIn: boolean;
  isPremium?: boolean;
  onRequireAuth?: () => void;
  onRequirePaywall?: () => void;
}) => {
  const copy = getCopy(language);
  const accent = isDawn ? '#A57164' : '#8A9A5B';
  const accentFaded = isDawn ? 'rgba(165,113,100,0.12)' : 'rgba(138,154,91,0.12)';

  const [movies, setMovies] = useState<PoolMovie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [currentFilmIndex, setCurrentFilmIndex] = useState(0);
  const [dailyQuizCount, setDailyQuizCount] = useState(0);
  const [quizMovieId, setQuizMovieId] = useState<string | null>(null);
  const [quizVisible, setQuizVisible] = useState(false);
  const [rush, setRush] = useState<RushPhase>({ phase: 'lobby' });

  const DAILY_FREE_LIMIT = 3;
  const dailyLimitReached = dailyQuizCount >= DAILY_FREE_LIMIT;

  useEffect(() => {
    setMoviesLoading(true);
    fetchPoolMovies({ language, limit: 50 }).then((res) => {
      if (res.ok && res.movies.length > 0) {
        setMovies(res.movies);
      } else {
        // Fallback demo films until pool is populated
        setMovies(DEMO_FILMS);
      }
      setMoviesLoading(false);
    }).catch(() => {
      setMovies(DEMO_FILMS);
      setMoviesLoading(false);
    });
  }, [language]);

  const currentFilm = movies.length > 0 ? movies[currentFilmIndex % movies.length] : null;
  const posterUri = buildPosterUri(currentFilm?.poster_path);

  // ── Swipe gesture (ref-based to avoid stale closures) ──
  const dragXRef = useRef(0);
  const swipingRef = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const flyingOut = useRef(false);
  const SWIPE_THRESHOLD = 80;
  const [dragDisplay, setDragDisplay] = useState(0); // only for indicator visibility
  const CARD_ID = 'swipe-film-card';

  const getCardEl = useCallback((): HTMLElement | null => {
    if (Platform.OS !== 'web') return null;
    return document.querySelector(`[data-testid="${CARD_ID}"]`) as HTMLElement | null;
  }, []);

  const applyCardTransform = useCallback((dx: number, transition?: string) => {
    const el = getCardEl();
    if (!el) return;
    el.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
    el.style.transition = transition || 'none';
  }, [getCardEl]);

  const handleSwipeRight = useCallback(() => {
    if (!isSignedIn) { onRequireAuth?.(); return; }
    if (!currentFilm || dailyLimitReached) return;
    void submitPoolSwipe({ movie_id: currentFilm.id, direction: 'right' });
    flyingOut.current = true;
    applyCardTransform(500, 'transform 0.3s ease-out, opacity 0.3s ease-out');
    const cardEl = getCardEl();
    if (cardEl) cardEl.style.opacity = '0';
    setTimeout(() => {
      setQuizMovieId(currentFilm.id);
      setQuizVisible(true);
      dragXRef.current = 0;
      swipingRef.current = false;
      flyingOut.current = false;
      setDragDisplay(0);
      applyCardTransform(0);
      const resetEl = getCardEl();
      if (resetEl) resetEl.style.opacity = '1';
    }, 300);
  }, [isSignedIn, onRequireAuth, currentFilm, dailyLimitReached, applyCardTransform]);

  const handleSwipeLeft = useCallback(() => {
    if (!currentFilm) return;
    void submitPoolSwipe({ movie_id: currentFilm.id, direction: 'left' });
    flyingOut.current = true;
    applyCardTransform(-500, 'transform 0.3s ease-out, opacity 0.3s ease-out');
    const cardEl = getCardEl();
    if (cardEl) cardEl.style.opacity = '0';
    setTimeout(() => {
      setCurrentFilmIndex((i) => i + 1);
      dragXRef.current = 0;
      swipingRef.current = false;
      flyingOut.current = false;
      setDragDisplay(0);
      applyCardTransform(0);
      const resetEl = getCardEl();
      if (resetEl) resetEl.style.opacity = '1';
    }, 300);
  }, [currentFilm, applyCardTransform]);

  const swipeRightRef = useRef(handleSwipeRight);
  swipeRightRef.current = handleSwipeRight;
  const swipeLeftRef = useRef(handleSwipeLeft);
  swipeLeftRef.current = handleSwipeLeft;

  const mouseDownRef = useRef(false);

  // Unified pointer handler — works for both touch and mouse on web
  type PointerEvent = { nativeEvent?: { touches?: Array<{ pageX: number; pageY: number }>; pageX?: number; pageY?: number }; pageX?: number; pageY?: number };
  const getPointerXY = (e: PointerEvent): { x: number; y: number } | null => {
    // Touch event
    if (e.nativeEvent?.touches?.[0]) {
      const t = e.nativeEvent.touches[0];
      return { x: t.pageX, y: t.pageY };
    }
    // Mouse/pointer event from web
    if (e.nativeEvent?.pageX != null) {
      return { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    }
    if (e.pageX != null) {
      return { x: e.pageX, y: e.pageY };
    }
    return null;
  };

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (flyingOut.current) return;
    const pt = getPointerXY(e);
    if (!pt) return;
    touchStartX.current = pt.x;
    touchStartY.current = pt.y;
    swipingRef.current = false;
    dragXRef.current = 0;
    mouseDownRef.current = true;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (flyingOut.current || !mouseDownRef.current) return;
    const pt = getPointerXY(e);
    if (!pt) return;
    const dx = pt.x - touchStartX.current;
    const dy = pt.y - touchStartY.current;
    if (!swipingRef.current && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipingRef.current = true;
    }
    if (swipingRef.current) {
      dragXRef.current = dx;
      applyCardTransform(dx);
      const bucket = dx < -30 ? -1 : dx > 30 ? 1 : 0;
      setDragDisplay((prev) => {
        const prevBucket = prev < -30 ? -1 : prev > 30 ? 1 : 0;
        return prevBucket !== bucket ? dx : prev;
      });
    }
  }, [applyCardTransform]);

  const onPointerUp = useCallback(() => {
    if (flyingOut.current || !mouseDownRef.current) return;
    mouseDownRef.current = false;
    const dx = dragXRef.current;
    if (dx > SWIPE_THRESHOLD) {
      swipeRightRef.current();
    } else if (dx < -SWIPE_THRESHOLD) {
      swipeLeftRef.current();
    } else {
      dragXRef.current = 0;
      swipingRef.current = false;
      setDragDisplay(0);
      applyCardTransform(0, 'transform 0.2s ease-out');
    }
  }, [applyCardTransform]);

  // Attach mouse listeners on web (touch events handled via RN props)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = getCardEl();
    if (!el) return;
    const down = (e: MouseEvent) => { e.preventDefault(); onPointerDown({ pageX: e.pageX, pageY: e.pageY }); };
    const move = (e: MouseEvent) => { onPointerMove({ pageX: e.pageX, pageY: e.pageY }); };
    const up = () => { onPointerUp(); };
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      el.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  });

  const showLeftIndicator = dragDisplay < -30;
  const showRightIndicator = dragDisplay > 30;

  const handleQuizClose = useCallback(() => {
    setQuizVisible(false);
    setQuizMovieId(null);
    setDailyQuizCount((c) => c + 1);
    setCurrentFilmIndex((i) => i + 1);
    // TODO: show interstitial ad here for free users
  }, []);

  const rushDemoRef = useRef(false);

  const handleRushStart = useCallback(async (mode: RushMode) => {
    if (!isSignedIn) { onRequireAuth?.(); return; }
    if (!isPremium && mode === 'rush_30') { onRequirePaywall?.(); return; }
    setRush({ phase: 'loading' });
    const res = await startRushSession({ mode, language }).catch(() => null);
    if (res && res.ok) {
      rushDemoRef.current = false;
      setRush({ phase: 'playing', session: res.session, current: 0, correct: 0, answered: 0, submitting: false, streak: 0, flash: null, flashKey: 0, revealed: null, confettiKey: 0 });
    } else {
      // Fallback to demo rush
      rushDemoRef.current = true;
      const demoSession = buildDemoRushSession(mode);
      setRush({ phase: 'playing', session: demoSession, current: 0, correct: 0, answered: 0, submitting: false, streak: 0, flash: null, flashKey: 0, revealed: null, confettiKey: 0 });
    }
  }, [isSignedIn, language, onRequireAuth]);

  const handleRushAnswer = useCallback(async (selected: PoolOptionKey) => {
    if (rush.phase !== 'playing' || rush.submitting || rush.revealed) return;
    const q = rush.session.questions[rush.current];
    if (!q) return;

    if (rushDemoRef.current) {
      const demoQ = DEMO_RUSH_QUESTIONS.find((d) => d.id === q.id);
      const isCorrect = selected === demoQ?.correct;
      const correctKey = demoQ?.correct ?? selected;
      if (isCorrect) playCorrectSound(); else playWrongSound();

      // Step 1: show revealed state (highlight selected + reveal correct) + confetti if correct
      setRush((prev) => prev.phase === 'playing'
        ? { ...prev, submitting: true, revealed: { selected, isCorrect, correctKey }, confettiKey: isCorrect ? prev.confettiKey + 1 : prev.confettiKey }
        : prev,
      );

      // Step 2: after 900ms, advance to next question
      await new Promise<void>((r) => setTimeout(r, 900));
      const nc = rush.correct + (isCorrect ? 1 : 0);
      const na = rush.answered + 1;
      const newStreak = isCorrect ? rush.streak + 1 : 0;
      const flash = isCorrect ? 'correct' as const : 'wrong' as const;
      const fk = rush.flashKey + 1;
      if (rush.current + 1 >= rush.session.questions.length) {
        const xp = nc * 8 + (na - nc) * 2;
        void showInterstitialAd().then(() => setRush({ phase: 'result', mode: rush.session.mode, total: na, correct: nc, xp }));
      } else {
        setRush((prev) => prev.phase === 'playing'
          ? { ...prev, current: prev.current + 1, correct: nc, answered: na, submitting: false, streak: newStreak, flash, flashKey: fk, revealed: null }
          : prev,
        );
      }
      return;
    }

    setRush((prev) => prev.phase === 'playing' ? { ...prev, submitting: true } : prev);
    const res = await submitRushAnswer({ session_id: rush.session.id, attempt_id: q.id, selected_option: selected });
    if (res.ok) {
      if (res.is_correct) playCorrectSound(); else playWrongSound();
      const correctKey = res.correct_option ?? selected;
      setRush((prev) => prev.phase === 'playing'
        ? { ...prev, revealed: { selected, isCorrect: res.is_correct, correctKey } }
        : prev,
      );
      await new Promise<void>((r) => setTimeout(r, 900));
      const nc = rush.correct + (res.is_correct ? 1 : 0);
      const na = rush.answered + 1;
      const newStreak = res.is_correct ? rush.streak + 1 : 0;
      const flash = res.is_correct ? 'correct' as const : 'wrong' as const;
      const fk = rush.flashKey + 1;
      if (rush.current + 1 >= rush.session.questions.length) {
        const c = await completeRushSession({ session_id: rush.session.id });
        void showInterstitialAd().then(() => setRush({ phase: 'result', mode: rush.session.mode, total: na, correct: nc, xp: c.ok ? c.xp_earned : 0 }));
      } else {
        setRush((prev) => prev.phase === 'playing'
          ? { ...prev, current: prev.current + 1, correct: nc, answered: na, submitting: false, streak: newStreak, flash, flashKey: fk, revealed: null }
          : prev,
        );
      }
    } else if (res.expired) {
      const c = await completeRushSession({ session_id: rush.session.id });
      void showInterstitialAd().then(() => setRush({ phase: 'result', mode: rush.session.mode, total: rush.answered, correct: rush.correct, xp: c.ok ? c.xp_earned : 0 }));
    } else {
      setRush((prev) => prev.phase === 'playing' ? { ...prev, submitting: false } : prev);
    }
  }, [rush]);

  const handleRushExpired = useCallback(async () => {
    if (rush.phase !== 'playing') return;
    if (rushDemoRef.current) {
      const xp = rush.correct * 8 + (rush.answered - rush.correct) * 2;
      void showInterstitialAd().then(() => setRush({ phase: 'result', mode: rush.session.mode, total: rush.answered, correct: rush.correct, xp }));
      return;
    }
    const c = await completeRushSession({ session_id: rush.session.id });
    void showInterstitialAd().then(() => setRush({ phase: 'result', mode: rush.session.mode, total: rush.answered, correct: rush.correct, xp: c.ok ? c.xp_earned : 0 }));
  }, [rush]);

  // ── Rush modal ──
  const rushModal = useMemo(() => {
    if (rush.phase === 'lobby') return null;
    if (rush.phase === 'loading') return (
      <Modal visible animationType="fade" transparent={false}>
        <View style={qs.modalBg}>
          <ActivityIndicator size="large" color={accent} style={{ marginTop: 120 }} />
          <Text style={[qs.loadText, { textAlign: 'center', marginTop: 16 }]}>{copy.loading}</Text>
        </View>
      </Modal>
    );
    if (rush.phase === 'playing') {
      const q = rush.session.questions[rush.current];
      const totalQ = rush.session.questions.length;
      const progressPct = totalQ > 0 ? ((rush.current + 1) / totalQ) * 100 : 0;
      const totalSecs = rush.session.mode === 'rush_15' ? 90 : 150;
      const wrongCount = rush.answered - rush.correct;
      const posterPath = q ? RUSH_POSTER_MAP[q.movie_title] : null;
      const thumbUri = posterPath ? buildPosterUri(posterPath) : null;
      return (
        <Modal visible animationType="fade" transparent={false}>
          <View style={qs.modalBg}>
            {/* Top bar: quit + title + timer */}
            <View style={qs.modalTopBar}>
              <Pressable onPress={() => {
                setRush({ phase: 'result', mode: rush.session.mode, total: rush.answered, correct: rush.correct, xp: 0 });
              }} hitSlop={12} accessibilityRole="button">
                <Ionicons name="close" size={22} color="#8e8b84" />
              </Pressable>
              <Text style={qs.modalTopTitle}>{copy.rush}</Text>
              {rush.session.expires_at && <RushTimer expiresAt={rush.session.expires_at} totalSeconds={totalSecs} onExpired={handleRushExpired} />}
            </View>

            {/* Progress bar */}
            <View style={qs.rushProgressBarBg}>
              <View style={[qs.rushProgressBarFill, { width: `${progressPct}%`, backgroundColor: accent }]} />
            </View>

            {/* Question area — flex fill */}
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
              {/* Flash feedback overlay */}
              <RushFlash key={rush.flashKey} type={rush.flash} />
              {/* Confetti blast on correct answer */}
              <ConfettiBlast trigger={rush.confettiKey} />

              {q && (
                <>
                  {/* Film header with poster thumbnail */}
                  <View style={qs.rushFilmHeader}>
                    {thumbUri && Platform.OS === 'web' ? (
                      <View style={[qs.rushFilmThumb, { backgroundImage: `url(${thumbUri})`, backgroundSize: 'cover', backgroundPosition: 'center' } as object]} />
                    ) : thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={qs.rushFilmThumb} resizeMode="cover" />
                    ) : (
                      <View style={[qs.rushFilmThumb, { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="film-outline" size={16} color="#555" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={qs.rushFilmName}>{q.movie_title}</Text>
                      <Text style={qs.rushQNumber}>Soru {rush.current + 1} / {totalQ}</Text>
                    </View>
                    {rush.streak >= 2 && (
                      <View style={qs.rushStreakBadge}>
                        <Ionicons name="flame" size={16} color="#FFA500" />
                        <Text style={qs.rushStreakText}>{rush.streak}</Text>
                      </View>
                    )}
                  </View>

                  {/* Question text */}
                  <Text style={qs.rushQuestionText}>{q.question}</Text>

                  {/* Options — press + reveal animation */}
                  <View style={{ gap: 10, marginTop: 8 }}>
                    {q.options.map((opt) => {
                      const rev = rush.revealed;
                      let result: 'correct' | 'wrong' | 'reveal' | null = null;
                      if (rev) {
                        if (opt.key === rev.selected && rev.isCorrect) result = 'correct';
                        else if (opt.key === rev.selected && !rev.isCorrect) result = 'wrong';
                        else if (opt.key === rev.correctKey && !rev.isCorrect) result = 'reveal';
                      }
                      return (
                        <RushOption key={opt.key} opt={opt} onPress={() => void handleRushAnswer(opt.key)} disabled={!!rush.submitting || !!rush.revealed} result={result} />
                      );
                    })}
                  </View>

                  {/* Correct / Wrong counter — animated, below options */}
                  <RushScoreBar correct={rush.correct} wrong={wrongCount} />
                </>
              )}
            </View>

            {/* Bottom bar — only progress */}
            <View style={qs.rushBottomBar}>
              <Text style={[qs.rushBottomProgress, { flex: 1, textAlign: 'center' }]}>{rush.current + 1} / {totalQ}</Text>
            </View>
          </View>
        </Modal>
      );
    }
    if (rush.phase === 'result') {
      return (
        <Modal visible animationType="fade" transparent={false}>
          <RushResultScreen
            total={rush.total}
            correct={rush.correct}
            xp={rush.xp}
            accent={accent}
            copy={copy}
            onRetry={() => setRush({ phase: 'lobby' })}
          />
        </Modal>
      );
    }
    return null;
  }, [rush, accent, copy, handleRushAnswer, handleRushExpired]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ── Hero ── */}
      <View style={qs.heroBox}>
        <Ionicons name="flash" size={28} color={accent} style={{ marginBottom: 8 }} />
        <Text style={qs.heroTitle}>{copy.heroTitle}</Text>
        <Text style={qs.heroSub}>{copy.heroSub}</Text>
      </View>

      {/* ── Tinder-style Film Card ── */}
      <View style={qs.swipeSection}>
        {moviesLoading && <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />}
        {!moviesLoading && movies.length === 0 && (
          <View style={qs.emptyBox}>
            <Ionicons name="film-outline" size={36} color="#333" />
            <Text style={qs.emptyText}>{copy.noMovies}</Text>
          </View>
        )}
        {!moviesLoading && currentFilm && (
          <View
            testID={CARD_ID}
            style={qs.swipeCard}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          >
            {posterUri ? (
              Platform.OS === 'web' ? (
                <View style={[qs.swipePoster, { backgroundImage: `url(${posterUri})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } as object]} />
              ) : (
                <Image source={{ uri: posterUri }} style={qs.swipePoster} resizeMode="contain" />
              )
            ) : (
              <View style={[qs.swipePoster, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="film-outline" size={48} color="#444" />
              </View>
            )}
            {/* Swipe direction stamps on card */}
            {showLeftIndicator && (
              <View style={[qs.swipeStamp, qs.swipeStampLeft]}>
                <Text style={qs.swipeStampTextLeft}>SKIP</Text>
              </View>
            )}
            {showRightIndicator && (
              <View style={[qs.swipeStamp, qs.swipeStampRight]}>
                <Text style={qs.swipeStampTextRight}>QUIZ</Text>
              </View>
            )}
            <View style={qs.swipeOverlay}>
              <Text style={qs.swipeTitle} numberOfLines={2}>{currentFilm.title}</Text>
              <Text style={qs.swipeMeta}>
                {currentFilm.release_year || ''}{currentFilm.vote_average != null ? ` · ★${currentFilm.vote_average.toFixed(1)}` : ''}
              </Text>
            </View>
            {currentFilm.question_count > 0 && (
              <View style={[qs.filmBadge, { backgroundColor: accent }]}>
                <Ionicons name="flash" size={11} color="#fff" />
                <Text style={qs.filmBadgeText}>{currentFilm.question_count}</Text>
              </View>
            )}
          </View>
        )}

        {/* Daily limit indicator */}
        {!moviesLoading && currentFilm && (
          <Text style={[qs.dailyCounter, dailyLimitReached && { color: '#f87171' }]}>
            {dailyLimitReached ? copy.dailyLimit : `${dailyQuizCount} ${copy.freeLimit}`}
          </Text>
        )}

        {/* Swipe buttons */}
        {!moviesLoading && currentFilm && (
          <View style={qs.swipeBtnRow}>
            <Pressable
              style={[qs.swipeBtnPill, qs.swipeBtnSkip]}
              onPress={handleSwipeLeft}
              accessibilityRole="button"
              accessibilityLabel={copy.swipeSkip}
            >
              <Ionicons name="close" size={20} color="#f87171" />
              <Text style={[qs.swipeBtnPillText, { color: '#f87171' }]}>{copy.swipeSkip}</Text>
            </Pressable>
            <Pressable
              style={[qs.swipeBtnPill, qs.swipeBtnQuiz, dailyLimitReached && { opacity: 0.35 }]}
              onPress={handleSwipeRight}
              disabled={dailyLimitReached}
              accessibilityRole="button"
              accessibilityLabel={copy.swipeQuiz}
            >
              <Ionicons name="checkmark" size={20} color={accent} />
              <Text style={[qs.swipeBtnPillText, { color: accent }]}>{copy.swipeQuiz}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Quiz Rush Section ── */}
      <View style={qs.rushSection}>
        <View style={qs.rushHeader}>
          <Ionicons name="timer-outline" size={18} color={accent} />
          <Text style={qs.rushHeaderTitle}>{copy.rush}</Text>
        </View>
        <Text style={qs.rushHeaderSub}>{copy.rushSub}</Text>

        <View style={qs.rushCardRow}>
          {(['rush_15', 'rush_30'] as RushMode[]).map((mode) => {
            const modeInfo = copy.rushModes[mode as RushCopyMode];
            const isMarathon = mode === 'rush_30';
            return (
              <Pressable
                key={mode}
                style={[qs.rushCardNew, isMarathon && { borderColor: 'rgba(255,165,0,0.25)' }]}
                onPress={() => void handleRushStart(mode)}
                accessibilityRole="button"
              >
                {/* Premium lock badge for Marathon 30 */}
                {isMarathon && !isPremium && (
                  <View style={qs.premiumLockBadge}>
                    <Ionicons name="star" size={10} color="#B8860B" />
                    <Text style={qs.premiumLockText}>PRO</Text>
                  </View>
                )}
                <View style={[qs.rushCardIconCircle, { backgroundColor: isMarathon ? 'rgba(255,165,0,0.12)' : accentFaded }]}>
                  <Ionicons name={isMarathon ? 'rocket' : 'flash'} size={22} color={isMarathon ? '#FFA500' : accent} />
                </View>
                <Text style={[qs.rushCardTitle, isMarathon && { color: '#FFA500' }]}>{modeInfo.label}</Text>
                <Text style={qs.rushCardDetail}>{modeInfo.sub}</Text>
                <View style={[qs.rushCardPlayBtn, { backgroundColor: isMarathon ? 'rgba(255,165,0,0.15)' : accentFaded }]}>
                  <Ionicons name={isMarathon && !isPremium ? 'lock-closed' : 'play'} size={14} color={isMarathon ? '#FFA500' : accent} />
                  <Text style={[qs.rushCardPlayText, { color: isMarathon ? '#FFA500' : accent }]}>{isMarathon && !isPremium ? 'PRO' : 'START'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Modals */}
      <PoolQuizModal visible={quizVisible} movieId={quizMovieId} language={language} isDawn={isDawn} onClose={handleQuizClose} />
      {rushModal}
    </ScrollView>
  );
};

// ────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────

const ff = (w: string) => Platform.OS === 'web' ? 'Inter, system-ui, sans-serif'
  : w === '700' || w === '800' || w === '900' ? 'Inter_700Bold'
  : w === '600' ? 'Inter_600SemiBold'
  : w === '500' ? 'Inter_500Medium' : 'Inter_400Regular';

const qs = StyleSheet.create({
  // Hero
  heroBox: {
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: 'center',
  },
  heroTitle: {
    color: '#E5E4E2',
    fontSize: 18,
    fontFamily: ff('700'),
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  heroSub: {
    color: '#8e8b84',
    fontSize: 12,
    fontFamily: ff('500'),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#E5E4E2',
    fontSize: 11,
    fontFamily: ff('600'),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionSub: {
    color: '#6b6760',
    fontSize: 11,
    fontFamily: ff('500'),
    fontWeight: '500',
    marginBottom: 12,
  },

  // Tinder-style swipe card
  swipeSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  swipeCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  swipePoster: {
    width: '100%',
    height: 380,
    backgroundColor: '#111',
  },
  swipeStamp: {
    position: 'absolute',
    top: '35%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
    zIndex: 10,
  },
  swipeStampLeft: {
    right: 20,
    borderColor: '#f87171',
    backgroundColor: 'rgba(0,0,0,0.6)',
    transform: [{ rotate: '12deg' }],
  },
  swipeStampRight: {
    left: 20,
    borderColor: '#4ade80',
    backgroundColor: 'rgba(0,0,0,0.6)',
    transform: [{ rotate: '-12deg' }],
  },
  swipeStampTextLeft: {
    color: '#f87171',
    fontSize: 22,
    fontFamily: ff('900'),
    fontWeight: '900',
    letterSpacing: 2,
  },
  swipeStampTextRight: {
    color: '#4ade80',
    fontSize: 22,
    fontFamily: ff('900'),
    fontWeight: '900',
    letterSpacing: 2,
  },
  swipeOverlay: {
    padding: 14,
  },
  swipeTitle: {
    color: '#E5E4E2',
    fontSize: 18,
    fontFamily: ff('700'),
    fontWeight: '700',
    lineHeight: 24,
  },
  swipeMeta: {
    color: '#6b6760',
    fontSize: 12,
    fontFamily: ff('500'),
    fontWeight: '500',
    marginTop: 4,
  },
  dailyCounter: {
    color: '#6b6760',
    fontSize: 11,
    fontFamily: ff('600'),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.3,
  },
  swipeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  swipeBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  swipeBtnSkip: {
    borderColor: 'rgba(248,113,113,0.4)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  swipeBtnQuiz: {
    borderColor: 'rgba(138,154,91,0.4)',
    backgroundColor: 'rgba(138,154,91,0.06)',
  },
  swipeBtnPillText: {
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filmBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  filmBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: '#555',
    fontSize: 12,
    fontFamily: ff('400'),
  },

  // Rush cards
  rushSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  rushHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rushHeaderTitle: {
    color: '#E5E4E2',
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  rushHeaderSub: {
    color: '#6b6760',
    fontSize: 11,
    fontFamily: ff('500'),
    fontWeight: '500',
    marginBottom: 14,
  },
  rushCardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rushCardNew: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 8,
  },
  rushCardIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  rushCardTitle: {
    color: '#E5E4E2',
    fontSize: 15,
    fontFamily: ff('700'),
    fontWeight: '700',
  },
  rushCardDetail: {
    color: '#6b6760',
    fontSize: 10,
    fontFamily: ff('500'),
    fontWeight: '500',
    textAlign: 'center',
  },
  rushCardPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 4,
  },
  rushCardPlayText: {
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1,
  },
  premiumLockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(184,134,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(184,134,11,0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  premiumLockText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B8860B',
    letterSpacing: 0.5,
  },
  rushTag: {
    color: '#6b6760',
    fontSize: 10,
    fontFamily: ff('600'),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 3,
  },

  // Modal
  modalBg: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTopTitle: {
    color: '#E5E4E2',
    fontSize: 15,
    fontFamily: ff('600'),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  // Quiz
  quizProgress: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
    justifyContent: 'center',
  },
  quizDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  questionText: {
    color: '#E5E4E2',
    fontSize: 15,
    fontFamily: ff('500'),
    fontWeight: '500',
    lineHeight: 23,
    marginBottom: 18,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  optionCorrect: {
    borderColor: 'rgba(74,222,128,0.4)',
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  optionWrong: {
    borderColor: 'rgba(248,113,113,0.4)',
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  optionKey: {
    color: '#6b6760',
    fontSize: 12,
    fontFamily: ff('700'),
    fontWeight: '700',
    marginRight: 12,
    width: 16,
  },
  optionLabel: {
    color: '#E5E4E2',
    fontSize: 13,
    fontFamily: ff('500'),
    fontWeight: '500',
    flex: 1,
    lineHeight: 19,
  },
  explanationBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  feedbackTag: {
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  explanationText: {
    color: '#8e8b84',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: ff('600'),
    fontWeight: '600',
  },

  // Result
  resultCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  resultScoreBig: {
    color: '#E5E4E2',
    fontSize: 36,
    fontFamily: ff('800'),
    fontWeight: '800',
  },
  resultScoreSm: {
    color: '#6b6760',
    fontSize: 14,
    fontFamily: ff('600'),
    fontWeight: '600',
    marginTop: -2,
  },
  resultLabel: {
    color: '#8e8b84',
    fontSize: 13,
    fontFamily: ff('600'),
    fontWeight: '600',
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resultXp: {
    fontSize: 18,
    fontFamily: ff('700'),
    fontWeight: '700',
    marginTop: 6,
  },

  // Timer bar
  timerBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerCountdown: {
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    marginTop: 4,
  },
  timeUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  timeUpText: {
    color: '#EF4444',
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
  },
  timerText: {
    color: '#E5E4E2',
    fontSize: 18,
    fontFamily: ff('700'),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Quit confirmation
  quitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  quitBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quitMsg: {
    color: '#E5E4E2',
    fontSize: 14,
    fontFamily: ff('500'),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 12,
  },
  quitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
  },

  // Rush playing
  rushTimerRing: {
    width: '100%',
    marginBottom: 2,
  },
  rushTimerBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rushTimerBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  rushProgressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rushProgressBarFill: {
    height: '100%',
  },
  rushStatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  rushStatItem: {
    alignItems: 'center',
  },
  rushStatValue: {
    color: '#E5E4E2',
    fontSize: 16,
    fontFamily: ff('700'),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rushStatLabel: {
    color: '#6b6760',
    fontSize: 9,
    fontFamily: ff('600'),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  rushStreakBadge: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,165,0,0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 3,
  },
  rushStreakText: {
    color: '#FFA500',
    fontSize: 16,
    fontFamily: ff('800'),
    fontWeight: '800',
  },
  rushFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 50,
    pointerEvents: 'none',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  // Rush playing — film header
  rushFilmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rushFilmThumb: {
    width: 40,
    height: 56,
    borderRadius: 6,
    overflow: 'hidden',
  },
  rushFilmName: {
    color: '#E5E4E2',
    fontSize: 14,
    fontFamily: ff('700'),
    fontWeight: '700',
  },
  rushQNumber: {
    color: '#6b6760',
    fontSize: 11,
    fontFamily: ff('600'),
    fontWeight: '600',
    marginTop: 2,
  },
  rushQuestionText: {
    color: '#E5E4E2',
    fontSize: 16,
    fontFamily: ff('600'),
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 12,
  },
  // Rush options — bigger
  rushOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  rushOptionBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rushOptionBadgeText: {
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
    color: '#8e8b84',
  },
  rushScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rushScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rushScoreNum: {
    fontSize: 26,
    fontFamily: ff('900'),
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  rushScoreDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  // Result screen
  rushResultCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    marginBottom: 10,
  },
  rushResultGrade: {
    fontSize: 58,
    fontFamily: ff('900'),
    fontWeight: '900',
    letterSpacing: -2,
  },
  rushResultGradeLabel: {
    fontSize: 18,
    fontFamily: ff('700'),
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  rushResultStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginTop: 24,
    width: '100%',
  },
  rushResultStatBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  rushResultStatNum: {
    fontSize: 28,
    fontFamily: ff('900'),
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  rushResultStatLabel: {
    fontSize: 11,
    fontFamily: ff('600'),
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rushResultStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rushResultXpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rushResultXpNum: {
    fontSize: 32,
    fontFamily: ff('900'),
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  rushResultXpLabel: {
    fontSize: 16,
    fontFamily: ff('700'),
    color: '#888',
    fontWeight: '700',
  },
  rushOptionLabel: {
    color: '#E5E4E2',
    fontSize: 14,
    fontFamily: ff('500'),
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  // Rush bottom stats bar
  rushBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  rushBottomStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rushBottomStatNum: {
    fontSize: 16,
    fontFamily: ff('800'),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rushBottomProgress: {
    color: '#6b6760',
    fontSize: 12,
    fontFamily: ff('600'),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rushFilmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  rushFilmChipText: {
    color: '#8e8b84',
    fontSize: 11,
    fontFamily: ff('600'),
    fontWeight: '600',
  },
  rushPctText: {
    fontSize: 22,
    fontFamily: ff('800'),
    fontWeight: '800',
    marginTop: 4,
  },
  rushCounter: {
    color: '#8e8b84',
    fontSize: 12,
    fontFamily: ff('600'),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  rushFilmHint: {
    color: '#6b6760',
    fontSize: 11,
    fontFamily: ff('500'),
    fontWeight: '500',
    marginBottom: 6,
  },

  loadText: {
    color: '#6b6760',
    fontSize: 13,
    fontFamily: ff('500'),
    fontWeight: '500',
  },
});
