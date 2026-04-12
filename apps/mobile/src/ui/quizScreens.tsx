import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { showInterstitialAd, showRewardedAd } from '../lib/mobileAds';
import {
  consumeQuizEntry,
  grantQuizRewardCredit,
  readQuizAccessSummary,
  type QuizAccessSummary,
} from '../lib/mobileQuizAccess';
import {
  fetchPoolMovies,
  fetchPoolQuiz,
  requestPoolFiftyFifty,
  submitPoolSwipe,
  submitPoolAnswer,
  startRushSession,
  submitRushAnswer,
  completeRushSession,
  requestRushJoker,
  fetchBlurMovie,
  verifyBlurGuess,
  useBlurQuizJoker,
  fetchSubscriptionStatus,
  type PoolMovie,
  type PoolQuestion,
  type PoolOptionKey,
  type PoolLanguageCode,
  type RushMode,
  type RushSession,
  type SubscriptionStatus,
  type BlurQuizHints,
  type BlurQuizJokerKey,
  type JokerSource,
} from '../lib/mobilePoolQuizApi';
import {
  type WalletInventoryKey,
  type WalletStoreItemKey,
} from '../../../../src/domain/progressionEconomy';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sound effects â€” Web Audio API on web, expo-av on native
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SND_CORRECT = require('../../assets/sounds/correct.wav') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SND_WRONG = require('../../assets/sounds/wrong.wav') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SND_TIMEUP = require('../../assets/sounds/timeup.wav') as number;

const DEFAULT_ACCESS_SUMMARY: QuizAccessSummary = {
  used: 0,
  rewardCredits: 0,
  freeLimit: 3,
  remaining: 3,
};
const DEFAULT_FREE_SUBSCRIPTION_STATUS: SubscriptionStatus = {
  tier: 'free',
  daily_rush_limit: 3,
  daily_rush_used: 0,
  show_ads: true,
};
const DEFAULT_PREMIUM_SUBSCRIPTION_STATUS: SubscriptionStatus = {
  tier: 'premium',
  daily_rush_limit: null,
  daily_rush_used: 0,
  show_ads: false,
};

const SELECTION_PENDING_MIN_MS = 180;
const RUSH_CORRECT_TIME_BONUS_SECONDS = 3;

const extendRushExpiresAt = (expiresAt: string | null, bonusSeconds: number): string | null => {
  if (!expiresAt || bonusSeconds <= 0) return expiresAt;
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return expiresAt;
  return new Date(expiresMs + bonusSeconds * 1000).toISOString();
};

const ensurePendingSelectionDuration = async (startedAt: number): Promise<void> => {
  const elapsed = Date.now() - startedAt;
  const remaining = SELECTION_PENDING_MIN_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
};

const runAfterQuizAd = async (showAds: boolean, callback: () => void): Promise<void> => {
  if (showAds) await showInterstitialAd();
  callback();
};

const requestRewardedUnlock = async (message: string): Promise<boolean> => {
  if (Platform.OS === 'web') return showRewardedAd();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    Alert.alert(
      'Ek hak kazan',
      message,
      [
        { text: 'Vazgec', style: 'cancel', onPress: () => finish(false) },
        {
          text: 'Reklam izle',
          onPress: () => {
            void showRewardedAd().then(finish);
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => finish(false),
      },
    );
  });
};

const requestBlurRetryNotice = async (
  copy: {
    blurRetryTitle: string;
    blurRetryBody: string;
    blurRetryAction: string;
  },
): Promise<void> => {
  if (Platform.OS === 'web') {
    const alertFn = (globalThis as { alert?: (value?: string) => void }).alert;
    if (typeof alertFn === 'function') alertFn(copy.blurRetryBody);
    return;
  }

  return new Promise((resolve) => {
    Alert.alert(
      copy.blurRetryTitle,
      copy.blurRetryBody,
      [
        { text: copy.blurRetryAction, onPress: () => resolve() },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(),
      },
    );
  });
};

const formatBonusJokerLabel = (count: number): string => `BONUS x${Math.max(1, count)}`;

const ff = (w: string) => Platform.OS === 'web' ? 'Inter, system-ui, sans-serif'
  : w === '700' || w === '800' || w === '900' ? 'Inter_700Bold'
  : w === '600' ? 'Inter_600SemiBold'
  : w === '500' ? 'Inter_500Medium' : 'Inter_400Regular';

// Web: use Web Audio API for instant playback
let _audioCtx: AudioContext | null = null;
let _audioCtxSuspendTimer: ReturnType<typeof setTimeout> | null = null;

const AUDIO_CTX_IDLE_MS = 12000;

const clearAudioCtxSuspendTimer = () => {
  if (_audioCtxSuspendTimer === null) return;
  clearTimeout(_audioCtxSuspendTimer);
  _audioCtxSuspendTimer = null;
};

const suspendAudioCtx = async (): Promise<void> => {
  clearAudioCtxSuspendTimer();
  const ctx = _audioCtx;
  if (!ctx || ctx.state !== 'running') return;
  await ctx.suspend().catch(() => undefined);
};

const closeAudioCtx = async (): Promise<void> => {
  clearAudioCtxSuspendTimer();
  const ctx = _audioCtx;
  _audioCtx = null;
  if (!ctx || ctx.state === 'closed') return;
  await ctx.close().catch(() => undefined);
};

const scheduleAudioCtxSuspend = () => {
  if (Platform.OS !== 'web') return;
  clearAudioCtxSuspendTimer();
  _audioCtxSuspendTimer = setTimeout(() => {
    void suspendAudioCtx();
  }, AUDIO_CTX_IDLE_MS);
};

const getAudioCtx = (): AudioContext | null => {
  if (Platform.OS !== 'web') return null;
  if (_audioCtx?.state === 'closed') {
    _audioCtx = null;
  }
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  }
  if (_audioCtx.state === 'suspended') {
    void _audioCtx.resume().catch(() => undefined);
  }
  clearAudioCtxSuspendTimer();
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
  scheduleAudioCtxSuspend();
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type QuizLanguage = PoolLanguageCode;
type PoolQuizJokerKey = 'fifty_fifty' | 'time_boost';
type RushJokerKey = 'fifty_fifty' | 'pass' | 'freeze';
type QuizWalletInventory = Partial<Record<WalletInventoryKey, number>>;
type QuizRewardSummary = {
  xp: number;
  tickets: number;
  arenaScore: number;
};

const EMPTY_QUIZ_REWARD: QuizRewardSummary = {
  xp: 0,
  tickets: 0,
  arenaScore: 0,
};

type PoolQuizState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'active'; movieId: string; title: string; questions: PoolQuestion[]; current: number; answers: Map<string, { selected: PoolOptionKey; correct: boolean; explanation: string; correctOption: PoolOptionKey }>; reward: QuizRewardSummary }
  | { phase: 'result'; title: string; total: number; correct: number; reward: QuizRewardSummary };

type RushPhase =
  | { phase: 'lobby' }
  | { phase: 'loading' }
  | { phase: 'playing'; session: RushSession; current: number; correct: number; answered: number; submitting: boolean; streak: number; flash: 'correct' | 'wrong' | null; flashKey: number; revealed: { selected: PoolOptionKey; isCorrect: boolean; correctKey: PoolOptionKey } | null; confettiKey: number; usedJokers: Set<RushJokerKey>; hiddenOptions: Record<string, PoolOptionKey[]> }
  | { phase: 'result'; mode: RushMode; total: number; correct: number; reward: QuizRewardSummary };

type BlurJokerKey = 'director' | 'year' | 'cast' | 'genre';

type BlurPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'active'; movieId: string; sessionId: string; posterPath: string; hints: BlurQuizHints; blurStep: number; guess: string; submitting: boolean; jokers: Set<BlurJokerKey>; elapsedMs: number }
  | { phase: 'result'; correct: boolean; correctTitle: string; reward: QuizRewardSummary; guess: string };

type BlurRevealWindow = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const BLUR_POSTER_WIDTH = 200;
const BLUR_POSTER_HEIGHT = 280;
const BLUR_PX = [24, 16, 10, 6, 2, 0];
const BLUR_SCALE = [1.05, 1.035, 1.02, 1.01, 1.005, 1];
const BLUR_REVEAL_WINDOWS: BlurRevealWindow[] = [
  { left: 18, top: 20, width: 70, height: 86 },
  { left: 110, top: 24, width: 58, height: 72 },
  { left: 58, top: 92, width: 76, height: 64 },
  { left: 26, top: 164, width: 66, height: 60 },
  { left: 102, top: 170, width: 72, height: 74 },
  { left: 72, top: 220, width: 56, height: 36 },
];
const BLUR_STEP_DURATION = 5000;
const BLUR_TOTAL_STEPS = BLUR_PX.length;
const BLUR_TOTAL_DURATION = BLUR_TOTAL_STEPS * BLUR_STEP_DURATION;
const BLUR_XP_PER_STEP = [50, 42, 34, 26, 18, 10];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// i18n
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type RushCopyMode = 'rush_15' | 'rush_30';
type QuizIntroState = { kind: 'swipe' } | { kind: RushCopyMode };

const QUIZ_COPY: Record<QuizLanguage, {
  heroTitle: string; heroSub: string; noMovies: string;
  swipeQuiz: string; swipeSkip: string; freeLimit: string;
  swipeIntroBody?: string; pickFilm?: string; startQuiz?: string;
  rush: string; rushSub: string;
  correct: string; wrong: string; next: string; finish: string; result: string;
  xpEarned: string; tryAgain: string; back: string; loading: string;
  questionsOf: string; rushModes: Record<RushCopyMode, { label: string; sub: string; intro?: string }>;
  dailyLimit: string; score: string; yourScore: string;
  quitConfirm: string; quitYes: string; quitNo: string; timeUp: string;
  blur: string; blurSub: string; blurStart: string; blurGuess: string;
  blurPlaceholder: string; blurCorrect: string; blurWrong: string;
  blurCorrectTitle: string; blurPlayAgain: string; blurJokerCost: string;
  blurGuessLabel: string; blurDesc: string; blurPotentialXp: string; blurAnswerHelp: string;
  blurRetryTitle: string; blurRetryBody: string; blurRetryAction: string;
  blurJokers: { director: string; year: string; cast: string; genre: string };
}> = {
  tr: {
    heroTitle: 'Film Hafizan Ne Kadar Guclu?',
    heroSub: 'Filmi gor, saga cek, sorulari coz.',
    noMovies: 'Henuz havuzda film yok.',
    swipeQuiz: 'Quiz Coz', swipeSkip: 'Gec',
    freeLimit: 'Gunluk 3 film hakkindan',
    rush: 'Quiz Rush',
    rushSub: 'Karisik filmlerden sorular. Zamana karsi yaris.',
    correct: 'Dogru', wrong: 'Yanlis', next: 'Sonraki', finish: 'Bitir',
    result: 'Tamamlandi', xpEarned: 'XP Kazandin', tryAgain: 'Tekrar', back: 'Kapat',
    loading: 'Hazirlaniyor...', questionsOf: ' / ',
    rushModes: {
      rush_15: { label: 'Hizli 15', sub: '15 soru | 90 saniye' },
      rush_30: { label: 'Maraton 30', sub: '30 soru | 150 saniye' },
    },
    dailyLimit: 'Gunluk limit doldu', score: 'Skor', yourScore: 'Skorun',
    quitConfirm: 'Cikarsan kazandigin XP\'ler sifirlanir. Emin misin?', quitYes: 'Evet, cik', quitNo: 'Devam et', timeUp: 'Sure doldu!',
    blur: 'Bulanik Film', blurSub: 'Bulanik posterden filmi tahmin et',
    blurStart: 'Basla', blurGuess: 'Tahmin Et', blurPlaceholder: 'Film adini yaz...',
    blurCorrect: 'DOGRU!', blurWrong: 'YANLIS!', blurCorrectTitle: 'Dogru cevap',
    blurPlayAgain: 'Tekrar Oyna', blurJokerCost: 'Her joker -5 XP', blurGuessLabel: 'Tahminin',
    blurDesc: 'Poster bulanik baslar, zamanla netlesir. 4 joker hakkin var.',
    blurPotentialXp: 'olasi XP',
    blurAnswerHelp: 'Yazim hatalari ve alternatif film isimleri kabul edilir.',
    blurRetryTitle: 'Yaklastin',
    blurRetryBody: 'Cok yakin bir eslesme bulduk ama filmi aciga cikarmamak icin otomatik kabul etmiyoruz. Tahminini biraz daha net yazarak tekrar dene.',
    blurRetryAction: 'Tamam',
    blurJokers: { director: 'Yonetmen', year: 'Yil', cast: 'Oyuncular', genre: 'Tur' },
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
      rush_15: { label: 'Quick 15', sub: '15 questions | 90 seconds' },
      rush_30: { label: 'Marathon 30', sub: '30 questions | 150 seconds' },
    },
    dailyLimit: 'Daily limit reached', score: 'Score', yourScore: 'Your Score',
    quitConfirm: 'If you quit, all XP earned will be lost. Are you sure?', quitYes: 'Yes, quit', quitNo: 'Continue', timeUp: 'Time\'s up!',
    blur: 'Blur Quiz', blurSub: 'Guess the film from the blurred poster',
    blurStart: 'Start', blurGuess: 'Guess', blurPlaceholder: 'Type the film title...',
    blurCorrect: 'CORRECT!', blurWrong: 'WRONG!', blurCorrectTitle: 'Correct answer',
    blurPlayAgain: 'Play Again', blurJokerCost: 'Each joker costs -5 XP', blurGuessLabel: 'Your guess',
    blurDesc: 'Poster starts blurred and clears over time. You have 4 joker hints.',
    blurPotentialXp: 'potential XP',
    blurAnswerHelp: 'Small typos and alternate titles are accepted.',
    blurRetryTitle: 'Close guess',
    blurRetryBody: 'We found a very close match, but we do not reveal the title or auto-accept it. Tighten the spelling and try again.',
    blurRetryAction: 'Got it',
    blurJokers: { director: 'Director', year: 'Year', cast: 'Cast', genre: 'Genre' },
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
      rush_15: { label: 'Rapido 15', sub: '15 preguntas | 90 segundos' },
      rush_30: { label: 'Maraton 30', sub: '30 preguntas | 150 segundos' },
    },
    dailyLimit: 'Limite diario alcanzado', score: 'Puntuacion', yourScore: 'Tu Puntuacion',
    quitConfirm: 'Si sales, perderas todo el XP ganado. Estas seguro?', quitYes: 'Si, salir', quitNo: 'Continuar', timeUp: 'Tiempo agotado!',
    blur: 'Foto Borrosa', blurSub: 'Adivina la pelicula por el poster borroso',
    blurStart: 'Comenzar', blurGuess: 'Adivinar', blurPlaceholder: 'Escribe el titulo...',
    blurCorrect: 'CORRECTO!', blurWrong: 'INCORRECTO!', blurCorrectTitle: 'Respuesta correcta',
    blurPlayAgain: 'Jugar de nuevo', blurJokerCost: 'Cada comodin cuesta -5 XP', blurGuessLabel: 'Tu respuesta',
    blurDesc: 'El poster empieza borroso y se aclara. Tienes 4 pistas comodin.',
    blurPotentialXp: 'XP potencial',
    blurAnswerHelp: 'Se aceptan pequenos errores y titulos alternativos.',
    blurRetryTitle: 'Estuviste cerca',
    blurRetryBody: 'Encontramos una coincidencia muy cercana, pero no mostramos el titulo ni lo aceptamos automaticamente. Ajusta tu respuesta y prueba otra vez.',
    blurRetryAction: 'Entendido',
    blurJokers: { director: 'Director', year: 'Ano', cast: 'Reparto', genre: 'Genero' },
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
      rush_15: { label: 'Rapide 15', sub: '15 questions | 90 secondes' },
      rush_30: { label: 'Marathon 30', sub: '30 questions | 150 secondes' },
    },
    dailyLimit: 'Limite quotidienne atteinte', score: 'Score', yourScore: 'Votre Score',
    quitConfirm: 'Si vous quittez, tout le XP gagne sera perdu. Etes-vous sur?', quitYes: 'Oui, quitter', quitNo: 'Continuer', timeUp: 'Temps ecoule!',
    blur: 'Affiche Floue', blurSub: "Devinez le film depuis l'affiche floue",
    blurStart: 'Commencer', blurGuess: 'Deviner', blurPlaceholder: 'Tapez le titre du film...',
    blurCorrect: 'CORRECT!', blurWrong: 'FAUX!', blurCorrectTitle: 'Bonne reponse',
    blurPlayAgain: 'Rejouer', blurJokerCost: 'Chaque indice coute -5 XP', blurGuessLabel: 'Votre reponse',
    blurDesc: "L'affiche commence floue et s'eclaircit. Vous avez 4 indices.",
    blurPotentialXp: 'XP potentiel',
    blurAnswerHelp: 'Les petites fautes et les titres alternatifs sont acceptes.',
    blurRetryTitle: 'Vous etes proche',
    blurRetryBody: 'Nous avons trouve une correspondance tres proche, mais nous ne revelons pas le titre et nous ne l acceptons pas automatiquement. Precisez votre reponse et reessayez.',
    blurRetryAction: 'Compris',
    blurJokers: { director: 'Realisateur', year: 'Annee', cast: 'Casting', genre: 'Genre' },
  },
};

const getCopy = (lang: QuizLanguage) => QUIZ_COPY[lang] || QUIZ_COPY.en;

const getTicketUnitLabel = (language: QuizLanguage): string => {
  switch (language) {
    case 'tr':
      return 'Bilet';
    case 'es':
      return 'Entrada';
    case 'fr':
      return 'Billet';
    default:
      return 'Ticket';
  }
};

const hasQuizReward = (reward: QuizRewardSummary): boolean =>
  reward.xp > 0 || reward.tickets > 0 || reward.arenaScore > 0;

const mergeQuizReward = (
  base: QuizRewardSummary,
  delta: Partial<QuizRewardSummary>,
): QuizRewardSummary => ({
  xp: base.xp + Math.max(0, Number(delta.xp) || 0),
  tickets: base.tickets + Math.max(0, Number(delta.tickets) || 0),
  arenaScore: base.arenaScore + Math.max(0, Number(delta.arenaScore) || 0),
});

const toQuizReward = (xp = 0, tickets = 0, arenaScore = 0): QuizRewardSummary => ({
  xp: Math.max(0, Number(xp) || 0),
  tickets: Math.max(0, Number(tickets) || 0),
  arenaScore: Math.max(0, Number(arenaScore) || 0),
});

type PressFeedbackTone = 'tile' | 'button' | 'pill' | 'chip' | 'icon' | 'option';

const getTactilePressStyle = (pressed: boolean, tone: PressFeedbackTone = 'button') => {
  if (!pressed) return null;
  switch (tone) {
    case 'tile':
      return qs.pressFeedbackTile;
    case 'pill':
      return qs.pressFeedbackPill;
    case 'chip':
      return qs.pressFeedbackChip;
    case 'icon':
      return qs.pressFeedbackIcon;
    case 'option':
      return qs.pressFeedbackOption;
    default:
      return qs.pressFeedbackButton;
  }
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

const IMAGE_PROXY_BASE = String(process.env.EXPO_PUBLIC_IMAGE_PROXIES || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || 'https://images.weserv.nl/?url=';

const buildPosterUri = (posterPath: string | null | undefined): string | null => {
  if (!posterPath) return null;
  const url = `${TMDB_IMAGE_BASE}${posterPath.startsWith('/') ? posterPath : `/${posterPath}`}`;
  if (Platform.OS !== 'web') return url;
  return `${IMAGE_PROXY_BASE}${encodeURIComponent(url)}`;
};

const hasMoviePoster = (movie: PoolMovie | null | undefined) => Boolean(movie?.poster_path);

const QUIZ_INTRO_FALLBACK: Record<QuizLanguage, {
  swipeBody: string;
  pickFilm: string;
  startQuiz: string;
  rushBody: Record<RushCopyMode, string>;
}> = {
  tr: {
    swipeBody: 'Bir film sec, sonra 5 soruluk turu tek ekranda coz ve jokerleri dogru anda kullan.',
    pickFilm: 'Film sec',
    startQuiz: 'Basla',
    rushBody: {
      rush_15: '15 soruyu 90 saniyede bitir. Hizli karar ver ve jokerleri kritik anlar icin sakla.',
      rush_30: '30 soruluk uzun kosuda zamani bol, seriyi koru ve hatasiz ak.',
    },
  },
  en: {
    swipeBody: 'Pick a film first, then play a 5-question round that keeps the poster, answers and jokers on one screen.',
    pickFilm: 'Pick film',
    startQuiz: 'Start',
    rushBody: {
      rush_15: 'Clear 15 questions in 90 seconds. Answer fast and save your jokers for the hardest moments.',
      rush_30: 'Stay sharp through 30 questions, manage the clock well and build a clean streak.',
    },
  },
  es: {
    swipeBody: 'Primero elige una pelicula y luego juega una ronda de 5 preguntas con todo visible en una sola pantalla.',
    pickFilm: 'Elegir pelicula',
    startQuiz: 'Empezar',
    rushBody: {
      rush_15: 'Resuelve 15 preguntas en 90 segundos. Responde rapido y guarda los comodines para los momentos duros.',
      rush_30: 'Mantente firme durante 30 preguntas, administra bien el tiempo y encadena aciertos.',
    },
  },
  fr: {
    swipeBody: 'Choisissez d abord un film puis jouez un tour de 5 questions avec tout visible sur un seul ecran.',
    pickFilm: 'Choisir un film',
    startQuiz: 'Commencer',
    rushBody: {
      rush_15: 'Repondez a 15 questions en 90 secondes. Allez vite et gardez vos jokers pour les moments tendus.',
      rush_30: 'Tenez le rythme sur 30 questions, gerez bien le temps et construisez une belle serie.',
    },
  },
};

const ModalAtmosphere = ({
  accent,
  secondary,
}: {
  accent: string;
  secondary: string;
}) => (
  <View pointerEvents="none" style={qs.modalAtmosphere}>
    <View style={[qs.modalAura, qs.modalAuraPrimary, { backgroundColor: `${accent}24` }]} />
    <View style={[qs.modalAura, qs.modalAuraSecondary, { backgroundColor: secondary }]} />
    <View style={qs.modalVeil} />
  </View>
);

const QuizIntroModal = ({
  intro,
  visible,
  copy,
  language,
  accent,
  secondary,
  busy = false,
  onClose,
  onStart,
}: {
  intro: QuizIntroState | null;
  visible: boolean;
  copy: ReturnType<typeof getCopy>;
  language: QuizLanguage;
  accent: string;
  secondary: string;
  busy?: boolean;
  onClose: () => void;
  onStart: () => void;
}) => {
  if (!visible || !intro) return null;

  const fallback = QUIZ_INTRO_FALLBACK[language] || QUIZ_INTRO_FALLBACK.en;
  const isSwipe = intro.kind === 'swipe';
  const title = isSwipe ? copy.swipeQuiz : copy.rushModes[intro.kind].label;
  const subtitle = isSwipe ? copy.heroSub : copy.rushModes[intro.kind].sub;
  const body = isSwipe
    ? copy.swipeIntroBody || fallback.swipeBody
    : copy.rushModes[intro.kind].intro || fallback.rushBody[intro.kind];
  const actionLabel = isSwipe ? copy.pickFilm || fallback.pickFilm : copy.startQuiz || fallback.startQuiz;
  const iconName: keyof typeof Ionicons.glyphMap = isSwipe ? 'film-outline' : intro.kind === 'rush_15' ? 'flash-outline' : 'rocket-outline';

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={qs.modalBg}>
        <ModalAtmosphere accent={accent} secondary={secondary} />
        <View style={qs.modalTopBar}>
          <Pressable
            style={({ pressed }) => getTactilePressStyle(pressed, 'icon')}
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={copy.back}
          >
            <Ionicons name="close" size={24} color="#8e8b84" />
          </Pressable>
          <Text style={qs.modalTopTitle} numberOfLines={1}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={qs.quizIntroShell}>
          <View style={qs.quizIntroCard}>
            <View style={[qs.quizIntroIconWrap, { backgroundColor: `${accent}18`, borderColor: `${accent}32` }]}>
              <Ionicons name={iconName} size={28} color={accent} />
            </View>
            <Text style={qs.quizIntroTitle}>{title}</Text>
            <Text style={qs.quizIntroSubtitle}>{subtitle}</Text>
            <Text style={qs.quizIntroBody}>{body}</Text>

            <View style={qs.quizIntroStats}>
              <View style={qs.quizIntroStat}>
                <Ionicons name={isSwipe ? 'layers-outline' : 'help-outline'} size={14} color={accent} />
                <Text style={qs.quizIntroStatText}>{isSwipe ? '5Q' : intro.kind === 'rush_15' ? '15Q' : '30Q'}</Text>
              </View>
              <View style={qs.quizIntroStat}>
                <Ionicons name="timer-outline" size={14} color={accent} />
                <Text style={qs.quizIntroStatText}>{isSwipe ? 'Tek ekran' : intro.kind === 'rush_15' ? '90s' : '150s'}</Text>
              </View>
              <View style={qs.quizIntroStat}>
                <Ionicons name="sparkles-outline" size={14} color={accent} />
                <Text style={qs.quizIntroStatText}>{isSwipe ? '2 joker' : 'Joker aktif'}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                qs.actionBtn,
                qs.quizIntroAction,
                { backgroundColor: accent },
                getTactilePressStyle(pressed, 'button'),
              ]}
              onPress={onStart}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={qs.actionBtnText}>{actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const SceneChip = ({
  icon,
  value,
  accent,
  tone = 'neutral',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  accent: string;
  tone?: 'neutral' | 'accent' | 'positive' | 'negative';
}) => {
  const palette = tone === 'accent'
    ? { borderColor: `${accent}44`, backgroundColor: `${accent}16`, color: accent }
    : tone === 'positive'
      ? { borderColor: 'rgba(74,222,128,0.28)', backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80' }
      : tone === 'negative'
        ? { borderColor: 'rgba(248,113,113,0.28)', backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171' }
        : { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#d6d1ca' };

  return (
    <View style={[qs.sceneChip, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}>
      <Ionicons name={icon} size={13} color={palette.color} />
      <Text style={[qs.sceneChipText, { color: palette.color }]}>{value}</Text>
    </View>
  );
};

const RewardSummaryRow = ({
  reward,
  accent,
  language,
  centered = false,
}: {
  reward: QuizRewardSummary;
  accent: string;
  language: QuizLanguage;
  centered?: boolean;
}) => {
  if (!hasQuizReward(reward)) return null;

  return (
    <View style={[qs.sceneChipRow, centered && { justifyContent: 'center' }]}>
      {reward.xp > 0 ? (
        <SceneChip icon="flash-outline" value={`+${reward.xp} XP`} accent={accent} tone="accent" />
      ) : null}
      {reward.tickets > 0 ? (
        <SceneChip
          icon="ticket-outline"
          value={`+${reward.tickets} ${getTicketUnitLabel(language)}`}
          accent={accent}
          tone="positive"
        />
      ) : null}
      {reward.arenaScore > 0 ? (
        <SceneChip
          icon="trophy-outline"
          value={`+${reward.arenaScore} Arena`}
          accent={accent}
          tone="neutral"
        />
      ) : null}
    </View>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PoolQuizModal â€” quiz for a selected film
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Per-question time limit (seconds)
const QUESTION_TIME_LIMIT = 15;

const PoolQuizModal = ({
  visible,
  movieId,
  moviePosterPath,
  language,
  isDawn,
  onClose,
  onXpGained,
  showAds = true,
  skipResultAd = false,
  pauseTimers = false,
  walletInventory,
  onRefreshWallet,
  onOpenWallet,
}: {
  visible: boolean;
  movieId: string | null;
  moviePosterPath?: string | null;
  language: QuizLanguage;
  isDawn: boolean;
  onClose: () => void;
  onXpGained?: (xp: number) => void;
  showAds?: boolean;
  skipResultAd?: boolean;
  pauseTimers?: boolean;
  walletInventory?: QuizWalletInventory;
  onRefreshWallet?: () => Promise<void> | void;
  onOpenWallet?: (itemKey?: WalletStoreItemKey | null) => void;
}) => {
  const [state, setState] = useState<PoolQuizState>({ phase: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PoolOptionKey | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [revealed, setRevealed] = useState<{ selected: PoolOptionKey; isCorrect: boolean; correctKey: PoolOptionKey } | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [usedJokers, setUsedJokers] = useState<Set<PoolQuizJokerKey>>(new Set());
  const [hiddenOptions, setHiddenOptions] = useState<Record<string, PoolOptionKey[]>>({});
  const [bonusJokerCredits, setBonusJokerCredits] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerPulseRef = useRef(new Animated.Value(1));
  const skipResultAdRef = useRef(skipResultAd);
  const copy = getCopy(language);
  const accent = isDawn ? '#A57164' : '#8A9A5B';
  const atmosphereTint = isDawn ? 'rgba(244,114,182,0.14)' : 'rgba(96,165,250,0.10)';
  const questionPosterUri = buildPosterUri(moviePosterPath);

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
  const startTimer = useCallback((initialSeconds = QUESTION_TIME_LIMIT) => {
    clearTimer();
    const safeInitialSeconds = Math.max(0, Math.ceil(initialSeconds));
    setTimeLeft(safeInitialSeconds);
    if (safeInitialSeconds <= 0) return;
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
    // Time's up â€” mark wrong
    playTimeUpSound();
    const newAnswers = new Map(s.answers);
    newAnswers.set(q.id, {
      selected: '_timeout' as PoolOptionKey, // no selection â€” time expired
      correct: false,
      explanation: '',
      correctOption: q.options[0]?.key ?? 'a',
    });
    setState({ ...s, answers: newAnswers });
  }, [timeLeft]);

  useEffect(() => {
    if (!visible || !movieId) {
      setState({ phase: 'idle' });
      setPendingSelection(null);
      setUsedJokers(new Set());
      setHiddenOptions({});
      setBonusJokerCredits(0);
      skipResultAdRef.current = false;
      clearTimer();
      return;
    }
    setState({ phase: 'loading' });
    setPendingSelection(null);
    setUsedJokers(new Set());
    setHiddenOptions({});
    setBonusJokerCredits(0);
    skipResultAdRef.current = skipResultAd;

    fetchPoolQuiz({ movie_id: movieId, language }).then((res) => {
      if (res.ok) {
        setState({
          phase: 'active',
          movieId: res.movie_id,
          title: res.title,
          questions: res.questions,
          current: 0,
          answers: new Map(),
          reward: EMPTY_QUIZ_REWARD,
        });
      } else {
        setState({ phase: 'idle' });
        Alert.alert('Quiz su an acilamadi', res.error || 'Gercek soru havuzuna baglanilamadi.');
        onClose();
      }
    }).catch(() => {
      setState({ phase: 'idle' });
      Alert.alert('Quiz su an acilamadi', 'Gercek soru havuzuna baglanilamadi.');
      onClose();
    });
  }, [visible, movieId, language, clearTimer, onClose, skipResultAd]);

  const activeQuestionTimerKey =
    state.phase === 'active' ? state.questions[state.current]?.id ?? null : null;

  // Start a fresh timer only when a new question becomes active.
  useEffect(() => {
    if (state.phase === 'active' && activeQuestionTimerKey && !pauseTimers && !state.answers.has(activeQuestionTimerKey)) {
      startTimer();
    }
    return () => clearTimer();
  }, [activeQuestionTimerKey, startTimer, clearTimer]);

  useEffect(() => {
    if (pauseTimers) {
      clearTimer();
      return;
    }
    const s = stateRef.current;
    if (s.phase !== 'active' || submittingRef.current || timeLeft <= 0 || timerRef.current) return;
    const q = s.questions[s.current];
    if (!q || s.answers.has(q.id)) return;
    startTimer(timeLeft);
  }, [pauseTimers, clearTimer, startTimer, timeLeft]);

  const handleAnswer = useCallback(async (questionId: string, selected: PoolOptionKey) => {
    if (state.phase !== 'active' || submitting || revealed) return;
    clearTimer();
    setSubmitting(true);
    setPendingSelection(selected);
    const selectionStartedAt = Date.now();

    const res = await submitPoolAnswer({ movie_id: state.movieId, question_id: questionId, selected_option: selected, language }).catch(() => null);

    let isCorrect = false;
    let correctKey: PoolOptionKey = 'a';
    let explanation = '';
    let rewardDelta: QuizRewardSummary = EMPTY_QUIZ_REWARD;

    if (res && res.ok) {
      isCorrect = res.is_correct;
      correctKey = res.correct_option;
      explanation = res.explanation;
      rewardDelta = {
        xp: res.xp_earned,
        tickets: res.tickets_earned,
        arenaScore: res.arena_score_earned,
      };
    } else {
      setPendingSelection(null);
      setSubmitting(false);
      Alert.alert('Cevap gonderilemedi', (res && !res.ok ? res.error : '') || 'Gercek quiz cevabi kaydedilemedi.');
      startTimer();
      return;
    }

    await ensurePendingSelectionDuration(selectionStartedAt);

    if (isCorrect) { playCorrectSound(); setConfettiKey((k) => k + 1); }
    else playWrongSound();

    // Show reveal state for 900ms then commit answer
    setPendingSelection(null);
    setRevealed({ selected, isCorrect, correctKey });
    await new Promise<void>((r) => setTimeout(r, 900));
    setRevealed(null);

    const newAnswers = new Map(stateRef.current.phase === 'active' ? stateRef.current.answers : new Map());
    newAnswers.set(questionId, { selected, correct: isCorrect, explanation, correctOption: correctKey });
    setState((prev) =>
      prev.phase === 'active'
        ? { ...prev, answers: newAnswers, reward: mergeQuizReward(prev.reward, rewardDelta) }
        : prev
    );
    setSubmitting(false);
  }, [state, submitting, revealed, language, clearTimer, startTimer]);

  const handleNext = useCallback(() => {
    if (state.phase !== 'active') return;
    setPendingSelection(null);
    setState({ ...state, current: Math.min(state.current + 1, state.questions.length - 1) });
  }, [state]);

  const handleFinish = useCallback(() => {
    if (state.phase !== 'active') return;
    clearTimer();
    const correctCount = Array.from(state.answers.values()).filter((a) => a.correct).length;
    const reward = state.reward;
    void runAfterQuizAd(showAds && !skipResultAdRef.current, () => {
      setState({ phase: 'result', title: state.title, total: state.questions.length, correct: correctCount, reward });
      if (reward.xp > 0) onXpGained?.(reward.xp);
    });
  }, [clearTimer, onXpGained, showAds, state]);

  const handleQuit = useCallback(() => {
    setShowQuitConfirm(true);
  }, []);

  const ensurePoolBonusJokerCredit = useCallback(async (): Promise<boolean> => {
    if (!showAds) return true;
    if (bonusJokerCredits > 0) return true;
    const rewarded = await requestRewardedUnlock('Bu tur icin 1 bonus joker hakki kazanmak uzere odullu reklam izle.');
    if (!rewarded) return false;
    skipResultAdRef.current = true;
    setBonusJokerCredits((prev) => prev + 1);
    return true;
  }, [bonusJokerCredits, showAds]);

  const handlePoolJoker = useCallback(async (key: PoolQuizJokerKey) => {
    if (state.phase !== 'active' || submitting || revealed) return;
    const q = state.questions[state.current];
    if (!q || state.answers.has(q.id)) return;
    if (usedJokers.has(key)) return;

    if (key === 'time_boost') {
      if (!(await ensurePoolBonusJokerCredit())) return;
      setTimeLeft((prev) => prev + 3);
      setUsedJokers((prev) => new Set([...prev, key]));
      if (showAds) {
        setBonusJokerCredits((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    const source: JokerSource =
      (walletInventory?.joker_fifty_fifty || 0) > 0 ? 'wallet' : 'bonus';

    if (source === 'bonus' && !(await ensurePoolBonusJokerCredit())) {
      clearTimer();
      onOpenWallet?.('joker_fifty_fifty');
      return;
    }

    const res = await requestPoolFiftyFifty({ question_id: q.id, source });
    if (!res.ok || res.removed_options.length === 0) {
      if (source === 'wallet') void onRefreshWallet?.();
      return;
    }
    setHiddenOptions((prev) => ({ ...prev, [q.id]: res.removed_options }));
    setUsedJokers((prev) => new Set([...prev, key]));
    if (source === 'wallet') {
      void onRefreshWallet?.();
      return;
    }
    if (showAds) {
      setBonusJokerCredits((prev) => Math.max(0, prev - 1));
    }
  }, [
    ensurePoolBonusJokerCredit,
    onOpenWallet,
    onRefreshWallet,
    revealed,
    showAds,
    state,
    submitting,
    usedJokers,
    walletInventory?.joker_fifty_fifty,
    clearTimer,
  ]);

  const confirmQuit = useCallback(() => {
    clearTimer();
    setShowQuitConfirm(false);
    setPendingSelection(null);
    setState({ phase: 'idle' });
    onClose();
  }, [clearTimer, onClose]);

  if (!visible) return null;

  // Timer bar color: green â†’ yellow â†’ red
  const timerPct = timeLeft / QUESTION_TIME_LIMIT;
  const timerColor = timerPct > 0.5 ? accent : timerPct > 0.25 ? '#EAB308' : '#EF4444';

  // Result phase â€” full screen, no top bar
  if (state.phase === 'result') {
    return (
      <Modal visible animationType="fade" transparent={false}>
        <RushResultScreen
          total={state.total}
          correct={state.correct}
          reward={state.reward}
          accent={accent}
          language={language}
          copy={copy}
          onRetry={onClose}
        />
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View style={qs.modalBg}>
        <ModalAtmosphere accent={accent} secondary={atmosphereTint} />
        {/* Top bar with quit button */}
        <View style={qs.modalTopBar}>
          <Pressable
            style={({ pressed }) => getTactilePressStyle(pressed, 'icon')}
            onPress={handleQuit}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={copy.back}
          >
            <Ionicons name="close" size={22} color="#8e8b84" />
          </Pressable>
          <View style={qs.modalTopTitleWrap}>
            {state.phase === 'active' && questionPosterUri ? (
              Platform.OS === 'web' ? (
                <View style={[qs.modalTopPosterThumb, { backgroundImage: `url(${questionPosterUri})`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } as object]} />
              ) : (
                <Image source={{ uri: questionPosterUri }} style={qs.modalTopPosterThumb} resizeMode="cover" />
              )
            ) : null}
            <Text style={qs.modalTopTitle} numberOfLines={1}>
              {state.phase === 'active' ? state.title : copy.loading}
            </Text>
          </View>
          <View style={{ width: 22 }} />
        </View>

        {/* Confetti blast on correct answer */}
        <ConfettiBlast trigger={confettiKey} />

        <View style={qs.poolQuizViewport}>
          {state.phase === 'loading' && (
            <View style={qs.poolQuizLoadingState}>
              <ActivityIndicator size="large" color={accent} />
            </View>
          )}

          {state.phase === 'active' && (() => {
            const q = state.questions[state.current];
            if (!q) return null;
            const answer = state.answers.get(q.id);
            const isAnswered = Boolean(answer);
            const isTimeUp = isAnswered && (answer?.selected as string) === '_timeout';
            const hiddenOptionKeys = !isAnswered && !revealed ? hiddenOptions[q.id] || [] : [];
            const visibleOptions = q.options.filter((opt) => !hiddenOptionKeys.includes(opt.key));
            return (
              <View style={qs.poolQuizScene}>
                <View style={qs.poolQuizHeaderBlock}>
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
                  <Animated.View style={[qs.quizTimerShell, qs.quizTimerShellCompact, { transform: [{ scale: timerPulseRef.current }] }]}>
                    <View style={qs.quizTimerHeader}>
                      <SceneChip icon="time-outline" value={`${timeLeft}s`} accent={accent} tone={timeLeft <= 5 ? 'negative' : timeLeft <= 8 ? 'accent' : 'neutral'} />
                    </View>
                    <View style={qs.timerBarBg}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <View style={[qs.timerBarFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerColor }]} />
                    </View>
                  </Animated.View>
                )}

                {/* Time's up banner */}
                {isTimeUp && (
                  <View style={qs.timeUpBanner}>
                    <Ionicons name="alarm-outline" size={18} color="#EF4444" />
                    <Text style={qs.timeUpText}>{copy.timeUp}</Text>
                  </View>
                )}

                <View style={qs.questionStage}>
                  <Text style={qs.questionText}>{q.question}</Text>
                </View>
                </View>

                {!isAnswered && !revealed && (
                  <View style={qs.jokerBarHidden}>
                    <JokerIconButton
                      icon="remove-circle-outline"
                      label="50/50 joker"
                      accent={accent}
                      disabled={usedJokers.has('fifty_fifty')}
                      onPress={() => void handlePoolJoker('fifty_fifty')}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        qs.jokerBtn,
                        usedJokers.has('time_boost') && qs.jokerBtnDisabled,
                        getTactilePressStyle(pressed, 'icon'),
                      ]}
                      onPress={() => void handlePoolJoker('time_boost')}
                      disabled={usedJokers.has('time_boost')}
                      accessibilityRole="button"
                      accessibilityLabel="Sure jokerini ac"
                    >
                      <View style={[qs.jokerBtnInner, { borderColor: `${accent}58`, backgroundColor: `${accent}18` }]}>
                        <Ionicons name="timer-outline" size={24} color="#f3efe8" />
                      </View>
                    </Pressable>
                  </View>
                )}

                {/* Options â€” RushOption with press + reveal animation */}
                <View style={qs.quizOptionsStack}>
                  {visibleOptions.map((opt) => {
                    // Reveal state (during 900ms window)
                    let revResult: 'pending' | 'correct' | 'wrong' | 'reveal' | null = null;
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
                    if (!revealed && !answer && pendingSelection === opt.key) {
                      revResult = 'pending';
                    }
                    return (
                      <RushOption
                        key={opt.key}
                        opt={opt}
                        onPress={() => { if (!isAnswered && !revealed) void handleAnswer(q.id, opt.key); }}
                        disabled={isAnswered || !!submitting || !!revealed}
                        result={revResult}
                        accent={accent}
                        compact
                      />
                    );
                  })}
                </View>

                {!isAnswered && !revealed && (
                  <>
                    {showAds && bonusJokerCredits > 0 ? (
                      <View style={[qs.sceneChipRow, { justifyContent: 'center', marginTop: 4 }]}>
                        <SceneChip
                          icon="sparkles-outline"
                          value={formatBonusJokerLabel(bonusJokerCredits)}
                          accent={accent}
                          tone="positive"
                        />
                      </View>
                    ) : null}
                  <View style={[qs.jokerBar, qs.poolQuizJokerBar]}>
                    <JokerIconButton
                      variant="fifty"
                      label="50/50 joker"
                      accent={accent}
                      disabled={usedJokers.has('fifty_fifty')}
                      onPress={() => void handlePoolJoker('fifty_fifty')}
                    />
                    <JokerIconButton
                      variant="time"
                      label="Ekstra sure jokeri"
                      accent={accent}
                      disabled={usedJokers.has('time_boost')}
                      onPress={() => void handlePoolJoker('time_boost')}
                    />
                  </View>
                  </>
                )}

                {/* Explanation after committed answer */}
                {answer && !revealed && (
                  <View style={[qs.explanationBox, qs.explanationBoxCompact]}>
                    <Text style={[qs.explanationHeader, { color: answer.correct ? '#4ade80' : '#f87171' }]}>
                      {isTimeUp ? copy.timeUp : answer.correct ? copy.correct : copy.wrong}
                    </Text>
                    <Text style={[qs.feedbackTag, { color: '#8e8b84' }]}>{state.title}</Text>
                    {answer.explanation ? <Text style={qs.explanationText} numberOfLines={3}>{answer.explanation}</Text> : null}
                  </View>
                )}

                {isAnswered && !revealed && state.current < state.questions.length - 1 && (
                  <Pressable
                    style={({ pressed }) => [
                      qs.actionBtn,
                      qs.poolQuizActionBtn,
                      { backgroundColor: accent },
                      getTactilePressStyle(pressed, 'button'),
                    ]}
                    onPress={handleNext}
                    accessibilityRole="button"
                  >
                    <Text style={qs.actionBtnText}>{copy.next}</Text>
                  </Pressable>
                )}
                {isAnswered && !revealed && state.current === state.questions.length - 1 && (
                  <Pressable
                    style={({ pressed }) => [
                      qs.actionBtn,
                      qs.poolQuizActionBtn,
                      { backgroundColor: accent },
                      getTactilePressStyle(pressed, 'button'),
                    ]}
                    onPress={handleFinish}
                    accessibilityRole="button"
                  >
                    <Text style={qs.actionBtnText}>{copy.finish}</Text>
                  </Pressable>
                )}
              </View>
            );
          })()}

        </View>

        {/* Quit confirmation overlay */}
        {showQuitConfirm && (
          <View style={qs.quitOverlay}>
            <View style={qs.quitBox}>
              <Ionicons name="warning-outline" size={32} color="#EF4444" />
              <Text style={qs.quitMsg}>{copy.quitConfirm}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <Pressable
                  style={({ pressed }) => [
                    qs.quitBtn,
                    { backgroundColor: 'rgba(255,255,255,0.06)' },
                    getTactilePressStyle(pressed, 'button'),
                  ]}
                  onPress={() => setShowQuitConfirm(false)}
                >
                  <Text style={[qs.quitBtnText, { color: '#E5E4E2' }]}>{copy.quitNo}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    qs.quitBtn,
                    { backgroundColor: '#EF4444' },
                    getTactilePressStyle(pressed, 'button'),
                  ]}
                  onPress={confirmQuit}
                >
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RushTimer â€” animated countdown with circular progress feel
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RushTimer = ({
  expiresAt,
  totalSeconds,
  paused = false,
  onExpired,
}: {
  expiresAt: string;
  totalSeconds: number;
  paused?: boolean;
  onExpired: () => void;
}) => {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setRemaining(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  }, [expiresAt]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) { clearInterval(interval); onExpired(); }
    }, 250);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired, paused]);

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
  const pct = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;
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

// Poster lookup for rush film thumbnails
const RUSH_POSTER_MAP: Record<string, string> = {
  'American Pie': '/5P68by2Thn8wHAziyWGEw2O7hco.jpg',
  'Dune': '/gDzOcq0pfeCeqMBwKIJlSmQpjkZ.jpg',
  'Donnie Darko': '/fhQoQfejY1hUcwyuLgpBrYs6uFt.jpg',
  'The Tomorrow War': '/34nDCQZwaEvsy4CFO5hkGRFDCVU.jpg',
  'Flipped': '/6zDYFigohwncqFL00MKbFV01dWb.jpg',
};


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ConfettiBlast â€” correct answer celebration
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RushResultScreen â€” animated end screen
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RushResultScreen = ({
  total,
  correct,
  reward,
  accent,
  language,
  onRetry,
  copy,
}: {
  total: number;
  correct: number;
  reward: QuizRewardSummary;
  accent: string;
  language: QuizLanguage;
  onRetry: () => void;
  copy: ReturnType<typeof getCopy>;
}) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const grade = pct >= 80 ? 'S' : pct >= 60 ? 'A' : pct >= 40 ? 'B' : 'C';
  const gradeColor = pct >= 80 ? '#facc15' : pct >= 60 ? '#4ade80' : pct >= 40 ? '#60a5fa' : '#f87171';
  const gradeLabel = pct >= 80 ? 'Mukemmel!' : pct >= 60 ? 'Harika!' : pct >= 40 ? 'Iyi Is!' : 'Devam Et!';

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
    // Sequence: circle pops â†’ grade fades â†’ stats slide up â†’ btn slides up
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
    const target = reward.xp;
    const steps  = 30;
    const interval = 800 / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setXpDisplay(Math.round((target / steps) * step));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [reward.xp]);

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
            <Text style={qs.rushResultStatLabel}>Dogru</Text>
          </View>
          <View style={qs.rushResultStatDivider} />
          <View style={qs.rushResultStatBox}>
            <Text style={[qs.rushResultStatNum, { color: '#f87171' }]}>{total - correct}</Text>
            <Text style={qs.rushResultStatLabel}>Yanlis</Text>
          </View>
          <View style={qs.rushResultStatDivider} />
          <View style={qs.rushResultStatBox}>
            <Text style={[qs.rushResultStatNum, { color: '#facc15' }]}>{pct}%</Text>
            <Text style={qs.rushResultStatLabel}>Basari</Text>
          </View>
        </Animated.View>

        {/* XP earned */}
        <Animated.View style={[qs.rushResultXpBox, { opacity: statsOpacity, transform: [{ translateY: statsSlide }] }]}>
          <Ionicons name="flash" size={22} color={accent} />
          <Text style={[qs.rushResultXpNum, { color: accent }]}>+{xpDisplay}</Text>
          <Text style={qs.rushResultXpLabel}>XP</Text>
        </Animated.View>

        <Animated.View style={{ opacity: statsOpacity, transform: [{ translateY: statsSlide }], marginTop: 14 }}>
          <RewardSummaryRow reward={reward} accent={accent} language={language} centered />
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={{ width: '100%', gap: 10, opacity: btnOpacity, transform: [{ translateY: btnSlide }], marginTop: 28 }}>
          <Pressable
            style={({ pressed }) => [
              qs.actionBtn,
              { backgroundColor: accent },
              getTactilePressStyle(pressed, 'button'),
            ]}
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={18} color="#0a0a0a" style={{ marginRight: 6 }} />
            <Text style={qs.actionBtnText}>{copy.tryAgain}</Text>
          </Pressable>
        </Animated.View>

      </View>
    </View>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RushOption â€” animated pressable option button
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RushOption = ({
  opt, onPress, disabled, result, accent = '#8A9A5B', compact = false,
}: {
  opt: { key: PoolOptionKey; label: string };
  onPress: () => void;
  disabled: boolean;
  result?: 'pending' | 'correct' | 'wrong' | 'reveal' | null; // pending=selected and waiting, correct=this was right & selected, wrong=selected but wrong, reveal=correct but not selected
  accent?: string;
  compact?: boolean;
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
    if (result === 'pending') {
      highlightOpacity.stopAnimation();
      highlightOpacity.setValue(1);
    } else if (result) {
      Animated.timing(highlightOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      highlightOpacity.setValue(0);
    }
  }, [result, highlightOpacity]);

  const highlightColor =
    result === 'pending' ? 'rgba(250,204,21,0.24)' :
    result === 'correct' ? 'rgba(74,222,128,0.25)' :
    result === 'reveal'  ? 'rgba(74,222,128,0.15)' :
    result === 'wrong'   ? 'rgba(248,113,113,0.30)' :
    'rgba(255,255,255,0.06)';

  const borderColor =
    result === 'pending' ? '#facc15' :
    result === 'correct' ? '#4ade80' :
    result === 'reveal'  ? '#4ade80' :
    result === 'wrong'   ? '#f87171' :
    'rgba(255,255,255,0.10)';

  const badgeBg =
    result === 'pending' ? '#facc15' :
    result === 'correct' ? '#4ade80' :
    result === 'reveal'  ? 'rgba(74,222,128,0.4)' :
    result === 'wrong'   ? '#f87171' :
    'rgba(255,255,255,0.10)';

  const badgeTextColor =
    result === 'correct' || result === 'wrong' || result === 'pending' ? '#0a0a0a' : '#ccc';

  const trailingIcon: keyof typeof Ionicons.glyphMap =
    result === 'pending' ? 'time-outline' :
    result === 'correct' ? 'sparkles' :
    result === 'wrong' ? 'close-circle' :
    result === 'reveal' ? 'checkmark-circle' :
    'chevron-forward';

  const trailingIconColor =
    result === 'pending' ? '#facc15' :
    result === 'correct' ? '#4ade80' :
    result === 'wrong' ? '#f87171' :
    result === 'reveal' ? '#4ade80' :
    accent;

  return (
    <Pressable
      style={({ pressed }) => getTactilePressStyle(pressed, 'option')}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Animated.View style={[
        qs.rushOptionBtn,
        compact && qs.rushOptionBtnCompact,
        { transform: [{ scale }], borderColor },
        !result && { backgroundColor: `${accent}0d` },
      ]}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: highlightColor, opacity: highlightOpacity }]} />
        <View style={[qs.rushOptionBadge, compact && qs.rushOptionBadgeCompact, { backgroundColor: badgeBg }]}>
          <Text style={[qs.rushOptionBadgeText, compact && qs.rushOptionBadgeTextCompact, { color: badgeTextColor }]}>
            {result === 'correct' || result === 'reveal' ? 'V' : result === 'wrong' ? 'X' : result === 'pending' ? '.' : opt.key.toUpperCase()}
          </Text>
        </View>
        <View style={qs.optionContent}>
          <Text style={[qs.rushOptionLabel, compact && qs.rushOptionLabelCompact]} numberOfLines={2}>{opt.label}</Text>
        </View>
        <View style={[qs.optionTrailing, compact && qs.optionTrailingCompact, result && qs.optionTrailingResolved]}>
          <Ionicons name={trailingIcon} size={compact ? 14 : 16} color={trailingIconColor} />
        </View>
      </Animated.View>
    </Pressable>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RushScoreBar â€” animated correct/wrong counter
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type JokerVariant = 'fifty' | 'time' | 'pass' | 'freeze';

const JokerGlyph = ({
  variant,
  accent,
  disabled,
}: {
  variant: JokerVariant;
  accent: string;
  disabled?: boolean;
}) => {
  const tint = disabled ? '#7d766d' : '#f3efe8';
  const accentFill = disabled ? 'rgba(125,118,109,0.22)' : `${accent}b8`;

  if (variant === 'fifty') {
    return (
      <View style={qs.jokerGlyphGrid}>
        <View style={[qs.jokerGlyphDot, { backgroundColor: accentFill }]} />
        <View style={[qs.jokerGlyphDot, qs.jokerGlyphDotMuted]} />
        <View style={[qs.jokerGlyphDot, { backgroundColor: accentFill }]} />
        <View style={[qs.jokerGlyphDot, qs.jokerGlyphDotMuted]} />
      </View>
    );
  }

  if (variant === 'time') {
    return (
      <View style={qs.jokerGlyphStack}>
        <Ionicons name="timer-outline" size={22} color={tint} />
        <View style={[qs.jokerGlyphBadge, { backgroundColor: accentFill }]}>
          <Ionicons name="add" size={10} color="#0a0a0a" />
        </View>
      </View>
    );
  }

  if (variant === 'freeze') {
    return (
      <View style={qs.jokerGlyphStack}>
        <Ionicons name="snow-outline" size={22} color={tint} />
        <View style={[qs.jokerGlyphBadge, { backgroundColor: accentFill }]}>
          <Ionicons name="time-outline" size={10} color="#0a0a0a" />
        </View>
      </View>
    );
  }

  return <Ionicons name="play-skip-forward-outline" size={22} color={tint} />;
};

const JokerIconButton = ({
  icon,
  variant,
  label,
  accent,
  disabled,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: JokerVariant;
  label: string;
  accent: string;
  disabled?: boolean;
  onPress: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(disabled ? 0 : 0.45)).current;

  useEffect(() => {
    glow.stopAnimation();
    if (disabled) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.85, duration: 900, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0.35, duration: 900, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [disabled, glow]);

  return (
    <Pressable
      style={({ pressed }) => [
        qs.jokerBtn,
        disabled && qs.jokerBtnDisabled,
        getTactilePressStyle(pressed, 'icon'),
      ]}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 25, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          qs.jokerBtnInner,
          { transform: [{ scale }] },
          !disabled && { borderColor: `${accent}66`, backgroundColor: `${accent}1c` },
        ]}
      >
        <Animated.View style={[qs.jokerBtnGlow, { opacity: glow, borderColor: `${accent}88` }]} />
        {icon ? (
          <Ionicons name={icon} size={24} color={disabled ? '#7d766d' : '#f3efe8'} />
        ) : (
          <JokerGlyph variant={variant || 'fifty'} accent={accent} disabled={disabled} />
        )}
      </Animated.View>
    </Pressable>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BlurQuizModal â€” blurred poster guessing game
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BlurPosterReveal = ({
  posterUri,
  blurStep,
  accent,
}: {
  posterUri: string;
  blurStep: number;
  accent: string;
}) => {
  const safeStep = Math.max(0, Math.min(BLUR_TOTAL_STEPS - 1, blurStep));
  const baseBlur = BLUR_PX[safeStep] ?? 0;
  const baseScale = BLUR_SCALE[safeStep] ?? 1;
  const revealBlur = Math.max(0, baseBlur - 12);
  const revealCount = Math.min(BLUR_REVEAL_WINDOWS.length, safeStep + 1);
  const curtainOpacity = Math.max(0.04, 0.22 - safeStep * 0.03);

  return (
    <View style={blurStyles.posterFrame}>
      {Platform.OS === 'web' ? (
        <View style={[{
          width: '100%',
          height: '100%',
          backgroundImage: `url(${posterUri})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: `blur(${baseBlur}px)`,
          transform: `scale(${baseScale})`,
          transition: 'filter 0.9s ease, transform 0.9s ease',
        } as object]} />
      ) : (
        <Image
          source={{ uri: posterUri }}
          style={[StyleSheet.absoluteFillObject, { transform: [{ scale: baseScale }] }]}
          resizeMode="cover"
          blurRadius={baseBlur}
        />
      )}

      <View pointerEvents="none" style={[blurStyles.posterCurtainTop, { opacity: curtainOpacity }]} />
      <View pointerEvents="none" style={[blurStyles.posterCurtainBottom, { opacity: curtainOpacity * 0.82 }]} />
      <View pointerEvents="none" style={blurStyles.posterVeil} />

      {BLUR_REVEAL_WINDOWS.slice(0, revealCount).map((window, index) => {
        const isNewest = index === revealCount - 1;
        return (
          <View
            key={`${window.left}-${window.top}-${window.width}-${window.height}`}
            pointerEvents="none"
            style={[
              blurStyles.revealWindow,
              {
                left: window.left,
                top: window.top,
                width: window.width,
                height: window.height,
                borderColor: isNewest ? `${accent}88` : 'rgba(255,255,255,0.14)',
              },
            ]}
          >
            {Platform.OS === 'web' ? (
              <View style={[{
                position: 'absolute',
                left: -window.left,
                top: -window.top,
                width: BLUR_POSTER_WIDTH,
                height: BLUR_POSTER_HEIGHT,
                backgroundImage: `url(${posterUri})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: `blur(${revealBlur}px)`,
                transition: 'filter 0.9s ease, opacity 0.7s ease',
              } as object]} />
            ) : (
              <Image
                source={{ uri: posterUri }}
                style={{
                  position: 'absolute',
                  left: -window.left,
                  top: -window.top,
                  width: BLUR_POSTER_WIDTH,
                  height: BLUR_POSTER_HEIGHT,
                }}
                resizeMode="cover"
                blurRadius={revealBlur}
              />
            )}
            <View style={[blurStyles.revealWindowTint, { backgroundColor: isNewest ? `${accent}12` : 'rgba(255,255,255,0.03)' }]} />
          </View>
        );
      })}

      <View style={{
        position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2,
      }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 }}>
          {safeStep + 1}/{BLUR_TOTAL_STEPS}
        </Text>
      </View>
    </View>
  );
};

const BlurQuizModal = ({
  visible,
  language,
  isDawn,
  isSignedIn,
  isPremium = false,
  showAds = true,
  onClose,
  onRequireAuth,
}: {
  visible: boolean;
  language: QuizLanguage;
  isDawn: boolean;
  isSignedIn: boolean;
  isPremium?: boolean;
  showAds?: boolean;
  onClose: () => void;
  onRequireAuth?: () => void;
}) => {
  const copy = getCopy(language);
  const accent = isDawn ? '#A57164' : '#8A9A5B';
  const atmosphereTint = isDawn ? 'rgba(251,191,36,0.12)' : 'rgba(56,189,248,0.10)';
  const [state, setState] = useState<BlurPhase>({ phase: 'idle' });
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [bonusJokerCredits, setBonusJokerCredits] = useState(0);
  const activeRef = useRef<Extract<BlurPhase, { phase: 'active' }> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const skipResultAdRef = useRef(false);

  useEffect(() => {
    activeRef.current = state.phase === 'active' ? state : null;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const submitGuessRef = useRef<((timeUp?: boolean) => Promise<void>) | null>(null);

  const startTimer = useCallback((initialElapsedMs = 0) => {
    clearTimer();
    const startTime = Date.now() - initialElapsedMs;
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.phase !== 'active') { clearTimer(); return prev; }
        const elapsed = Date.now() - startTime;
        if (elapsed >= BLUR_TOTAL_DURATION) {
          clearTimer();
          setTimeout(() => submitGuessRef.current?.(true), 0);
          return { ...prev, blurStep: BLUR_TOTAL_STEPS - 1, elapsedMs: BLUR_TOTAL_DURATION };
        }
        return { ...prev, blurStep: Math.min(BLUR_TOTAL_STEPS - 1, Math.floor(elapsed / BLUR_STEP_DURATION)), elapsedMs: elapsed };
      });
    }, 250);
  }, [clearTimer]);

  const doSubmit = useCallback(async (timeUp = false) => {
    if (submittingRef.current) return;
    const s = activeRef.current;
    if (!s) return;
    const resumeElapsedMs = s.elapsedMs;
    submittingRef.current = true;
    clearTimer();
    setState((prev) => prev.phase === 'active' ? { ...prev, submitting: true } : prev);
    const guess = timeUp ? '' : s.guess.trim();
    const res = await verifyBlurGuess({ session_id: s.sessionId, guess });

    if (res.ok && (res.needs_retry || res.needs_confirmation) && !timeUp) {
      await requestBlurRetryNotice(copy);
      submittingRef.current = false;
      setState((prev) => prev.phase === 'active' && prev.movieId === s.movieId ? { ...prev, submitting: false } : prev);
      startTimer(resumeElapsedMs);
      return;
    }

    await runAfterQuizAd(showAds && !skipResultAdRef.current, () => {
      const resolvedTitle =
        res.ok && res.correct
          ? String(res.matched_title || guess || s.guess.trim())
          : '';
      setState({
        phase: 'result',
        correct: res.ok ? res.correct : false,
        correctTitle: resolvedTitle,
        reward: res.ok
          ? {
              xp: res.xp_earned,
              tickets: res.tickets_earned,
              arenaScore: res.arena_score_earned,
            }
          : EMPTY_QUIZ_REWARD,
        guess: guess || s.guess.trim(),
      });
    });
    submittingRef.current = false;
  }, [clearTimer, copy, showAds, startTimer]);

  useEffect(() => { submitGuessRef.current = doSubmit; });

  const updateGuess = useCallback((value: string) => {
    setState((prev) => prev.phase === 'active' ? { ...prev, guess: value } : prev);
  }, []);

  const loadMovie = useCallback(async (ids: string[]) => {
    submittingRef.current = false;
    setState({ phase: 'loading' });
    const res = await fetchBlurMovie({ excludeIds: ids });
    if (!res.ok) { setState({ phase: 'idle' }); return; }
    setSeenIds((prev) => [...prev, res.movie_id]);
    setState({
      phase: 'active', movieId: res.movie_id, sessionId: res.session_id, posterPath: res.poster_path,
      hints: res.hints, blurStep: 0, guess: '', submitting: false,
      jokers: new Set(), elapsedMs: 0,
    });
    startTimer();
  }, [startTimer]);

  const startNextMovie = useCallback(async () => {
    setBonusJokerCredits(0);
    skipResultAdRef.current = false;
    const access = await consumeQuizEntry('blur', { isPremium });
    if (!access.ok) {
      const rewarded = await requestRewardedUnlock('Blur quiz icin bir ek hak kazanmak uzere odullu reklam izle.');
      if (!rewarded) return;
      await grantQuizRewardCredit('blur');
      const unlocked = await consumeQuizEntry('blur', { isPremium });
      if (!unlocked.ok) return;
      if (unlocked.usedRewardCredit) {
        skipResultAdRef.current = true;
      }
    } else if (access.usedRewardCredit) {
      skipResultAdRef.current = true;
    }
    await loadMovie(seenIds);
  }, [isPremium, loadMovie, seenIds]);

  const handleJoker = useCallback(async (key: BlurJokerKey) => {
    const activeState = activeRef.current;
    if (!activeState || activeState.jokers.has(key)) return;

    if (!isPremium && bonusJokerCredits <= 0) {
      const rewarded = await requestRewardedUnlock('Bu tur icin 1 bonus joker hakki kazanmak uzere odullu reklam izle.');
      if (!rewarded) return;
      skipResultAdRef.current = true;
      setBonusJokerCredits((prev) => prev + 1);
    }

    const result = await useBlurQuizJoker({
      session_id: activeState.sessionId,
      joker_key: key as BlurQuizJokerKey,
    });
    if (!result.ok) return;

    setState((prev) => {
      if (prev.phase !== 'active' || prev.sessionId !== activeState.sessionId || prev.jokers.has(key)) return prev;
      const next = new Set(prev.jokers);
      next.add(key);
      return { ...prev, jokers: next };
    });
    if (!isPremium) {
      setBonusJokerCredits((prev) => Math.max(0, prev - 1));
    }
  }, [bonusJokerCredits, isPremium]);

  const handleClose = () => {
    clearTimer();
    setState({ phase: 'idle' });
    setSeenIds([]);
    setBonusJokerCredits(0);
    skipResultAdRef.current = false;
    submittingRef.current = false;
    onClose();
  };

  if (!visible) return null;

  const isActive = state.phase === 'active';
  const blurStep = isActive ? state.blurStep : 0;
  const timeProgress = isActive ? Math.max(0, 1 - state.elapsedMs / BLUR_TOTAL_DURATION) : 0;
  const potentialXp = isActive ? Math.max(10, BLUR_XP_PER_STEP[state.blurStep] - state.jokers.size * 5) : 0;
  const posterUri = isActive ? buildPosterUri(state.posterPath) : null;

  return (
    <Modal visible animationType="fade" transparent={false}>
      <View style={qs.modalBg}>
        <ModalAtmosphere accent={accent} secondary={atmosphereTint} />
        {/* Top bar */}
        <View style={qs.modalTopBar}>
          <Pressable
            style={({ pressed }) => getTactilePressStyle(pressed, 'icon')}
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color="#8e8b84" />
          </Pressable>
          <Text style={qs.modalTopTitle}>{copy.blur}</Text>
          {isActive && (
            <Text style={{ color: accent, fontFamily: ff('700'), fontWeight: '700', fontSize: 14 }}>
              {potentialXp} <Text style={{ color: '#6b6760', fontSize: 10, fontWeight: '400' }}>{copy.blurPotentialXp}</Text>
            </Text>
          )}
          {!isActive && <View style={{ width: 22 }} />}
        </View>

        {/* Timer bar */}
        {isActive && (
          <View style={{ height: 3, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{
              height: '100%', borderRadius: 2,
              width: `${timeProgress * 100}%`,
              backgroundColor: timeProgress > 0.4 ? accent : timeProgress > 0.2 ? '#f97316' : '#ef4444',
            }} />
          </View>
        )}

        <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* IDLE */}
          {state.phase === 'idle' && (
            <View style={blurStyles.idleStage}>
              <View style={blurStyles.idlePoster}>
                <View style={[blurStyles.idlePosterGlow, { backgroundColor: `${accent}20` }]} />
                <Ionicons name="images-outline" size={42} color={accent} />
              </View>
              <View style={[qs.sceneChipRow, { justifyContent: 'center', marginBottom: 18 }]}>
                <SceneChip icon="eye-outline" value={`${BLUR_TOTAL_STEPS}`} accent={accent} tone="accent" />
                <SceneChip icon="sparkles-outline" value="4" accent={accent} tone="accent" />
              </View>
              <Text style={blurStyles.idleTitle}>{copy.blur}</Text>
              <Text style={blurStyles.idleBody}>{copy.blurDesc}</Text>
              <Pressable
                onPress={() => {
                  if (!isSignedIn) { onRequireAuth?.(); return; }
                  void startNextMovie();
                }}
                style={({ pressed }) => [
                  blurStyles.primaryButton,
                  { backgroundColor: accent },
                  getTactilePressStyle(pressed, 'button'),
                ]}
              >
                <Text style={{ color: '#fff', fontFamily: ff('700'), fontWeight: '700', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {copy.blurStart}
                </Text>
              </Pressable>
            </View>
          )}

          {/* LOADING */}
          {state.phase === 'loading' && (
            <ActivityIndicator size="large" color={accent} style={{ marginTop: 60 }} />
          )}

          {/* ACTIVE */}
          {state.phase === 'active' && posterUri && (
            <View style={blurStyles.playStage}>
              {/* Poster */}
              <BlurPosterReveal posterUri={posterUri} blurStep={blurStep} accent={accent} />
              <View style={[qs.sceneChipRow, { justifyContent: 'center', marginBottom: 14 }]}>
                <SceneChip icon="time-outline" value={`${Math.max(0, Math.ceil((BLUR_TOTAL_DURATION - state.elapsedMs) / 1000))}s`} accent={accent} tone={timeProgress <= 0.25 ? 'negative' : timeProgress <= 0.5 ? 'accent' : 'neutral'} />
                <SceneChip icon="aperture-outline" value={`${blurStep + 1}/${BLUR_TOTAL_STEPS}`} accent={accent} tone="accent" />
                <SceneChip icon="flash-outline" value={`${potentialXp}`} accent={accent} tone="accent" />
              </View>

              {/* Revealed joker hints */}
              {state.jokers.size > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                  {state.jokers.has('director') && state.hints.director ? (
                    <View style={blurStyles.hintChip}>
                      <Text style={blurStyles.hintLabel}>{copy.blurJokers.director}</Text>
                      <Text style={blurStyles.hintValue}>{state.hints.director}</Text>
                    </View>
                  ) : null}
                  {state.jokers.has('year') && state.hints.release_year != null ? (
                    <View style={blurStyles.hintChip}>
                      <Text style={blurStyles.hintLabel}>{copy.blurJokers.year}</Text>
                      <Text style={blurStyles.hintValue}>{String(state.hints.release_year)}</Text>
                    </View>
                  ) : null}
                  {state.jokers.has('cast') && state.hints.cast.length > 0 ? (
                    <View style={blurStyles.hintChip}>
                      <Text style={blurStyles.hintLabel}>{copy.blurJokers.cast}</Text>
                      <Text style={blurStyles.hintValue}>{state.hints.cast.join(', ')}</Text>
                    </View>
                  ) : null}
                  {state.jokers.has('genre') && state.hints.genre ? (
                    <View style={blurStyles.hintChip}>
                      <Text style={blurStyles.hintLabel}>{copy.blurJokers.genre}</Text>
                      <Text style={blurStyles.hintValue}>{state.hints.genre}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Text input + submit */}
              {Platform.OS === 'web' ? (
                <View style={{ flexDirection: 'row', gap: 8, width: '100%', marginBottom: 12 }}>
                  <input
                    type="text"
                    value={state.guess}
                    onChange={(e: { target: { value: string } }) => {
                      updateGuess(e.target.value);
                    }}
                    onKeyDown={(e: { key: string }) => {
                      if (e.key === 'Enter' && state.guess.trim()) void doSubmit();
                    }}
                    placeholder={copy.blurPlaceholder}
                    disabled={state.submitting}
                    autoComplete="off"
                    spellCheck={false}
                    style={{
                      flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12,
                      color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                    } as object}
                  />
                  <Pressable
                    onPress={() => void doSubmit()}
                    disabled={!state.guess.trim() || state.submitting}
                    style={({ pressed }) => [
                      {
                        backgroundColor: accent,
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        borderRadius: 12,
                        justifyContent: 'center',
                        opacity: (!state.guess.trim() || state.submitting) ? 0.3 : 1,
                      },
                      getTactilePressStyle(pressed, 'button'),
                    ]}
                  >
                    <Text style={{ color: '#fff', fontFamily: ff('700'), fontWeight: '700', fontSize: 13, textTransform: 'uppercase' }}>
                      {copy.blurGuess}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, width: '100%', marginBottom: 12 }}>
                  <TextInput
                    value={state.guess}
                    onChangeText={updateGuess}
                    onSubmitEditing={() => {
                      if (state.guess.trim()) void doSubmit();
                    }}
                    placeholder={copy.blurPlaceholder}
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    autoCorrect={false}
                    autoCapitalize="words"
                    returnKeyType="go"
                    editable={!state.submitting}
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      color: '#fff',
                      fontSize: 14,
                      fontFamily: ff('400'),
                    }}
                  />
                  <Pressable
                    onPress={() => void doSubmit()}
                    disabled={!state.guess.trim() || state.submitting}
                    style={({ pressed }) => [
                      {
                        backgroundColor: accent,
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        borderRadius: 12,
                        justifyContent: 'center',
                        opacity: (!state.guess.trim() || state.submitting) ? 0.3 : 1,
                      },
                      getTactilePressStyle(pressed, 'button'),
                    ]}
                  >
                    <Text style={{ color: '#fff', fontFamily: ff('700'), fontWeight: '700', fontSize: 13, textTransform: 'uppercase' }}>
                      {copy.blurGuess}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Joker buttons */}
              {bonusJokerCredits > 0 ? (
                <View style={[qs.sceneChipRow, { justifyContent: 'center', width: '100%', marginBottom: 10 }]}>
                  <SceneChip
                    icon="sparkles-outline"
                    value={formatBonusJokerLabel(bonusJokerCredits)}
                    accent={accent}
                    tone="positive"
                  />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, width: '100%', marginBottom: 6 }}>
                {(['director', 'year', 'cast', 'genre'] as BlurJokerKey[]).map((key) => {
                  const used = state.jokers.has(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => handleJoker(key)}
                      disabled={used || state.submitting}
                      style={({ pressed }) => [
                        {
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: used ? 'rgba(255,255,255,0.04)' : `${accent}44`,
                          backgroundColor: used ? 'rgba(255,255,255,0.02)' : `${accent}14`,
                          alignItems: 'center',
                        },
                        getTactilePressStyle(pressed, 'chip'),
                      ]}
                    >
                      <Text style={{
                        fontSize: 10, fontFamily: ff('600'), fontWeight: '600',
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        color: used ? 'rgba(255,255,255,0.2)' : accent,
                      }}>
                        {used ? 'OK' : copy.blurJokers[key]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: '#555', fontSize: 10, textAlign: 'center', fontFamily: ff('400') }}>
                {copy.blurJokerCost}
              </Text>
              <Text style={{ color: '#8e8b84', fontSize: 11, textAlign: 'center', marginTop: 8, fontFamily: ff('500'), lineHeight: 17 }}>
                {copy.blurAnswerHelp}
              </Text>
            </View>
          )}

          {/* RESULT */}
          {state.phase === 'result' && (
            <View style={blurStyles.resultStage}>
              <Text style={{
                fontSize: 24, fontFamily: ff('800'), fontWeight: '800',
                color: state.correct ? '#4ade80' : '#f87171',
                letterSpacing: 2, marginBottom: 8,
              }}>
                {state.correct ? copy.blurCorrect : copy.blurWrong}
              </Text>
              {state.correctTitle ? (
                <>
                  <Text style={{ color: '#666', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, fontFamily: ff('400') }}>
                    {copy.blurCorrectTitle}
                  </Text>
                  <Text style={{ color: '#E5E4E2', fontSize: 20, fontFamily: ff('700'), fontWeight: '700', marginBottom: 20, textAlign: 'center' }}>
                    {state.correctTitle}
                  </Text>
                </>
              ) : null}
              {state.correct && hasQuizReward(state.reward) ? (
                <View style={{ marginBottom: 20, alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: '#666', fontSize: 12, fontFamily: ff('400') }}>
                    {copy.xpEarned}
                  </Text>
                  <RewardSummaryRow reward={state.reward} accent={accent} language={language} centered />
                </View>
              ) : null}
              {!state.correct && state.guess ? (
                <Text style={{ color: '#555', fontSize: 13, marginBottom: 20, fontFamily: ff('400') }}>
                  {copy.blurGuessLabel}: <Text style={{ fontStyle: 'italic', color: '#777' }}>"{state.guess}"</Text>
                </Text>
              ) : null}
              <Pressable
                onPress={() => void startNextMovie()}
                style={({ pressed }) => [
                  { backgroundColor: accent, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 12 },
                  getTactilePressStyle(pressed, 'button'),
                ]}
              >
                <Text style={{ color: '#fff', fontFamily: ff('700'), fontWeight: '700', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {copy.blurPlayAgain}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const blurStyles = StyleSheet.create({
  idleStage: {
    alignItems: 'center',
    paddingTop: 40,
    width: '100%',
    backgroundColor: 'rgba(12,12,12,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  idlePoster: {
    width: 140,
    height: 200,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  idlePosterGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.9,
  },
  idleTitle: {
    color: '#E5E4E2',
    fontSize: 22,
    fontFamily: ff('800'),
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  idleBody: {
    color: '#9c988f',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
    lineHeight: 21,
    fontFamily: ff('400'),
  },
  primaryButton: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  playStage: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 16,
    backgroundColor: 'rgba(12,12,12,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  posterFrame: {
    width: BLUR_POSTER_WIDTH,
    height: BLUR_POSTER_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    backgroundColor: '#0f172a',
  },
  posterVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,8,0.12)',
  },
  posterCurtainTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  posterCurtainBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 54,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  revealWindow: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  revealWindowTint: {
    ...StyleSheet.absoluteFillObject,
  },
  hintChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(138,154,91,0.1)', borderWidth: 1, borderColor: 'rgba(138,154,91,0.2)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  hintLabel: {
    fontSize: 9, color: 'rgba(138,154,91,0.55)', textTransform: 'uppercase',
    letterSpacing: 1, fontFamily: ff('600'), fontWeight: '600',
  },
  hintValue: {
    fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: ff('500'), fontWeight: '500',
  },
  resultStage: {
    alignItems: 'center',
    paddingTop: 40,
    width: '100%',
    backgroundColor: 'rgba(12,12,12,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// QuizHomeScreen â€” main Quiz tab
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const QuizHomeScreen = ({
  language,
  isDawn,
  isSignedIn,
  isPremium = false,
  walletBalance = 0,
  walletInventory,
  walletReadyTaskRewardTickets = 0,
  walletOverlayVisible = false,
  onOpenWallet,
  onRefreshWallet,
  onRequireAuth,
  onRequirePaywall,
  onNewMarks: _onNewMarks,
}: {
  language: QuizLanguage;
  isDawn: boolean;
  isSignedIn: boolean;
  isPremium?: boolean;
  walletBalance?: number;
  walletInventory?: QuizWalletInventory;
  walletReadyTaskRewardTickets?: number;
  walletOverlayVisible?: boolean;
  onOpenWallet?: (itemKey?: WalletStoreItemKey | null) => void;
  onRefreshWallet?: () => Promise<void> | void;
  onRequireAuth?: () => void;
  onRequirePaywall?: () => void;
  onNewMarks?: (markIds: string[]) => void;
}) => {
  const copy = getCopy(language);
  const accent = isDawn ? '#A57164' : '#8A9A5B';
  const accentFaded = isDawn ? 'rgba(165,113,100,0.12)' : 'rgba(138,154,91,0.12)';
  const rushAtmosphereTint = isDawn ? 'rgba(244,114,182,0.14)' : 'rgba(96,165,250,0.10)';
  const showAds = !isPremium;
  const totalWalletJokers =
    (walletInventory?.joker_fifty_fifty || 0) +
    (walletInventory?.joker_freeze || 0) +
    (walletInventory?.joker_pass || 0);
  const pendingWalletTaskReward = Math.max(0, Number(walletReadyTaskRewardTickets) || 0);

  const [movies, setMovies] = useState<PoolMovie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [currentFilmIndex, setCurrentFilmIndex] = useState(0);
  const [swipeAccess, setSwipeAccess] = useState<QuizAccessSummary>(DEFAULT_ACCESS_SUMMARY);
  const [blurAccess, setBlurAccess] = useState<QuizAccessSummary>(DEFAULT_ACCESS_SUMMARY);
  const [rushAccess, setRushAccess] = useState<SubscriptionStatus>(DEFAULT_FREE_SUBSCRIPTION_STATUS);
  const [quizIntro, setQuizIntro] = useState<QuizIntroState | null>(null);
  const [quizIntroBusy, setQuizIntroBusy] = useState(false);
  const [swipeLobbyVisible, setSwipeLobbyVisible] = useState(false);
  const [quizMovieId, setQuizMovieId] = useState<string | null>(null);
  const [quizMoviePosterPath, setQuizMoviePosterPath] = useState<string | null>(null);
  const [quizVisible, setQuizVisible] = useState(false);
  const [rush, setRush] = useState<RushPhase>({ phase: 'lobby' });
  const [rushPendingSelection, setRushPendingSelection] = useState<PoolOptionKey | null>(null);
  const [blurVisible, setBlurVisible] = useState(false);
  const [skipNextSwipeResultAd, setSkipNextSwipeResultAd] = useState(false);
  const [rushBonusJokerCredits, setRushBonusJokerCredits] = useState(0);
  const skipRushResultAdRef = useRef(false);
  const dailyLimitReached = !isPremium && swipeAccess.remaining <= 0;
  const blurLimitReached = !isPremium && blurAccess.remaining <= 0;
  const premiumTeaserCopy =
    language === 'tr'
      ? {
          eyebrow: '180 PREMIUM',
          title: 'Quiz tarafini limitsiz ve reklamsiz ac.',
          body: 'Daha uzun oyun akisi, premium rozet ve daha sakin bir deneyim tek yerde toplaniyor.',
          cta: isSignedIn ? "Premium'a gec" : 'Giris yap ve premiumu ac',
          meta: 'Limitsiz quiz | reklamsiz akis | 2x streak koruma',
          stats: ['Limitsiz quiz', '0 reklam', 'Streak koruma'],
        }
      : language === 'es'
        ? {
            eyebrow: '180 PREMIUM',
            title: 'Abre el lado quiz sin limites ni anuncios.',
            body: 'Sesiones mas fluidas, insignia premium y una experiencia mas limpia en un solo lugar.',
            cta: isSignedIn ? 'Pasar a premium' : 'Inicia sesion y activa premium',
            meta: 'Quiz ilimitado | sin anuncios | 2x proteccion de racha',
            stats: ['Quiz ilimitado', '0 anuncios', 'Proteccion de racha'],
          }
        : language === 'fr'
          ? {
              eyebrow: '180 PREMIUM',
              title: 'Passe le mode quiz en illimite et sans pub.',
              body: 'Des sessions plus fluides, un badge premium et une experience plus propre au meme endroit.',
              cta: isSignedIn ? 'Passer en premium' : 'Connecte-toi pour activer premium',
              meta: 'Quiz illimite | sans pub | protection de serie x2',
              stats: ['Quiz illimite', '0 pub', 'Protection de serie'],
            }
          : {
              eyebrow: '180 PREMIUM',
              title: 'Open the quiz side with no limits and no ads.',
              body: 'Longer play sessions, a premium badge, and a calmer experience in one place.',
              cta: isSignedIn ? 'Go premium' : 'Sign in to unlock premium',
              meta: 'Unlimited quiz | no ads | 2x streak protection',
              stats: ['Unlimited quiz', '0 ads', 'Streak shield'],
            };

  const walletCopy =
    language === 'tr'
      ? {
          eyebrow: 'BILET',
          title: `${walletBalance} Bilet`,
          meta:
            totalWalletJokers > 0
              ? `${totalWalletJokers} joker hazir`
              : 'Joker ve koruma icin bilet cuzdani ac',
          action: 'Ac',
          reward: pendingWalletTaskReward > 0 ? `Odulun var | +${pendingWalletTaskReward} bilet` : null,
          accessibility: 'Bilet cüzdanını aç',
        }
      : language === 'es'
        ? {
            eyebrow: 'ENTRADAS',
            title: `${walletBalance} Entradas`,
            meta:
              totalWalletJokers > 0
                ? `${totalWalletJokers} comodines listos`
                : 'Abre la cartera para comodines y proteccion',
            action: 'Abrir',
            reward: pendingWalletTaskReward > 0 ? `Recompensa lista | +${pendingWalletTaskReward}` : null,
            accessibility: 'Abrir la cartera de entradas',
          }
        : language === 'fr'
          ? {
              eyebrow: 'BILLETS',
              title: `${walletBalance} Billets`,
              meta:
                totalWalletJokers > 0
                  ? `${totalWalletJokers} jokers disponibles`
                  : 'Ouvre le portefeuille pour les jokers et la protection',
              action: 'Ouvrir',
              reward: pendingWalletTaskReward > 0 ? `Recompense prete | +${pendingWalletTaskReward}` : null,
              accessibility: 'Ouvrir le portefeuille de billets',
            }
          : {
              eyebrow: 'TICKETS',
              title: `${walletBalance} Tickets`,
              meta:
                totalWalletJokers > 0
                  ? `${totalWalletJokers} jokers ready`
                  : 'Open the wallet for jokers and protection',
              action: 'Open',
              reward: pendingWalletTaskReward > 0 ? `Reward ready | +${pendingWalletTaskReward}` : null,
              accessibility: 'Open the ticket wallet',
            };

  const refreshQuizAccess = useCallback(async () => {
    const [swipeSummary, blurSummary] = await Promise.all([
      readQuizAccessSummary('swipe'),
      readQuizAccessSummary('blur'),
    ]);
    setSwipeAccess(swipeSummary);
    setBlurAccess(blurSummary);
  }, []);

  const refreshRushAccess = useCallback(async () => {
    if (isPremium) {
      setRushAccess(DEFAULT_PREMIUM_SUBSCRIPTION_STATUS);
      return;
    }
    if (!isSignedIn) {
      setRushAccess(DEFAULT_FREE_SUBSCRIPTION_STATUS);
      return;
    }
    const nextStatus = await fetchSubscriptionStatus();
    setRushAccess(nextStatus.tier === 'premium' ? DEFAULT_PREMIUM_SUBSCRIPTION_STATUS : nextStatus);
  }, [isPremium, isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      void onRefreshWallet?.();
    }
  }, [isSignedIn, onRefreshWallet]);

  useEffect(() => {
    setMoviesLoading(true);
    fetchPoolMovies({ language, limit: 50 }).then((res) => {
      const nextMovies = res.ok && res.movies.length > 0
        ? res.movies
        : [];
      const posterReadyMovies = nextMovies.filter(hasMoviePoster);
      setMovies(posterReadyMovies.length > 0 ? posterReadyMovies : nextMovies);
      setMoviesLoading(false);
    }).catch(() => {
      setMovies([]);
      setMoviesLoading(false);
    });
  }, [language]);

  useEffect(() => {
    if (isPremium) {
      setSwipeAccess(DEFAULT_ACCESS_SUMMARY);
      setBlurAccess(DEFAULT_ACCESS_SUMMARY);
      return;
    }
    void refreshQuizAccess();
  }, [isPremium, refreshQuizAccess]);

  useEffect(() => {
    void refreshRushAccess();
  }, [refreshRushAccess]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void suspendAudioCtx();
      }
    };
    const handlePageHide = () => {
      void closeAudioCtx();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      void closeAudioCtx();
    };
  }, []);

  const currentFilm = movies.length > 0 ? movies[currentFilmIndex % movies.length] : null;
  const posterUri = buildPosterUri(currentFilm?.poster_path);

  const grantSwipeRewardFromTile = useCallback(async (): Promise<boolean> => {
    const rewarded = await requestRewardedUnlock('Gunluk take quiz hakkin doldu. Bir reklam izleyerek +1 hak kazan.');
    if (!rewarded) return false;
    const summary = await grantQuizRewardCredit('swipe');
    setSwipeAccess(summary);
    return true;
  }, []);

  const grantBlurRewardFromTile = useCallback(async (): Promise<boolean> => {
    const rewarded = await requestRewardedUnlock('Gunluk blur quiz hakkin doldu. Bir reklam izleyerek +1 hak kazan.');
    if (!rewarded) return false;
    const summary = await grantQuizRewardCredit('blur');
    setBlurAccess(summary);
    return true;
  }, []);

  // â”€â”€ Swipe gesture (ref-based to avoid stale closures) â”€â”€
  const dragXRef = useRef(0);
  const swipingRef = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const flyingOut = useRef(false);
  const SWIPE_THRESHOLD = 80;
  const [dragDisplay, setDragDisplay] = useState(0);
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

  const handleSwipeRight = useCallback(async () => {
    if (!isSignedIn) { onRequireAuth?.(); return; }
    if (!currentFilm) return;

    let access = await consumeQuizEntry('swipe', { isPremium });
    if (!access.ok) {
      const rewarded = await requestRewardedUnlock('Gunluk tinder quiz hakkin doldu. Bir ek oyun hakki kazanmak icin reklam izle.');
      if (!rewarded) return;
      await grantQuizRewardCredit('swipe');
      access = await consumeQuizEntry('swipe', { isPremium });
      if (!access.ok) return;
    }

    setSkipNextSwipeResultAd(access.usedRewardCredit);
    setSwipeAccess(access);
    void submitPoolSwipe({ movie_id: currentFilm.id, direction: 'right' });
    setQuizMoviePosterPath(currentFilm.poster_path ?? null);
    flyingOut.current = true;
    applyCardTransform(500, 'transform 0.3s ease-out, opacity 0.3s ease-out');
    const cardEl = getCardEl();
    if (cardEl) cardEl.style.opacity = '0';
    setTimeout(() => {
      setSwipeLobbyVisible(false);
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
  }, [applyCardTransform, currentFilm, isPremium, isSignedIn, onRequireAuth, onRequirePaywall]);

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

  // Unified pointer handler â€” works for both touch and mouse on web
  type PointerEvent = { nativeEvent?: { touches?: Array<{ pageX: number; pageY: number }>; pageX?: number; pageY?: number }; pageX?: number; pageY?: number };
  const getPointerXY = (e: PointerEvent): { x: number; y: number } | null => {
    // Touch event
    if (e.nativeEvent?.touches?.[0]) {
      const t = e.nativeEvent.touches[0];
      return { x: t.pageX, y: t.pageY };
    }
    // Mouse/pointer event from web
    const nativeX = e.nativeEvent?.pageX;
    const nativeY = e.nativeEvent?.pageY;
    if (nativeX != null && nativeY != null) {
      return { x: nativeX, y: nativeY };
    }
    if (e.pageX != null && e.pageY != null) {
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

  const swipeSummaryValue = isPremium ? 'INF' : String(swipeAccess.remaining);
  const blurSummaryValue = isPremium ? 'INF' : String(blurAccess.remaining);
  const rushDailyLimit = rushAccess.daily_rush_limit ?? 3;
  const rushRemaining = isPremium ? rushDailyLimit : Math.max(0, rushDailyLimit - rushAccess.daily_rush_used);
  const rushLimitReached = !isPremium && rushRemaining <= 0;
  const rushSummaryValue = isPremium ? 'NO ADS' : `${rushRemaining}/${rushDailyLimit}`;
  const rushAccessCopy = isPremium
    ? 'Premium ile sinirsiz giris.'
    : rushLimitReached
      ? 'Gunluk hak bitti. Reklam izle ve +1 tur ac.'
      : `Bugun kalan hak: ${rushRemaining}/${rushDailyLimit}`;
  const showLeftIndicator = dragDisplay < -30;
  const showRightIndicator = dragDisplay > 30;

  const resetSwipeCardState = useCallback(() => {
    dragXRef.current = 0;
    swipingRef.current = false;
    flyingOut.current = false;
    setDragDisplay(0);
    applyCardTransform(0);
    const resetEl = getCardEl();
    if (resetEl) resetEl.style.opacity = '1';
  }, [applyCardTransform, getCardEl]);

  const handleQuizIntroClose = useCallback(() => {
    if (quizIntroBusy) return;
    setQuizIntro(null);
  }, [quizIntroBusy]);

  const handleQuizClose = useCallback(() => {
    setQuizVisible(false);
    setQuizMovieId(null);
    setQuizMoviePosterPath(null);
    setSkipNextSwipeResultAd(false);
    setCurrentFilmIndex((i) => i + 1);
    void onRefreshWallet?.();
    if (!isPremium) {
      void refreshQuizAccess();
    }
  }, [isPremium, onRefreshWallet, refreshQuizAccess]);

  const handleBlurClose = useCallback(() => {
    setBlurVisible(false);
    void onRefreshWallet?.();
    if (!isPremium) {
      void refreshQuizAccess();
    }
  }, [isPremium, onRefreshWallet, refreshQuizAccess]);

  const handleSwipeLobbyClose = useCallback(() => {
    setSwipeLobbyVisible(false);
    resetSwipeCardState();
  }, [resetSwipeCardState]);

  const finalizeRushResult = useCallback((nextState: Extract<RushPhase, { phase: 'result' }>) => {
    setRushPendingSelection(null);
    void onRefreshWallet?.();
    void runAfterQuizAd(showAds && !skipRushResultAdRef.current, () => setRush(nextState));
  }, [onRefreshWallet, showAds]);

  const handleRushStart = useCallback(async (mode: RushMode, rewardUnlock = false) => {
    if (!isSignedIn) { onRequireAuth?.(); return; }
    const premiumOnlyMode = mode === 'endless';
    let unlockedByRewardAd = false;
    if (!rewardUnlock) {
      skipRushResultAdRef.current = false;
      setRushBonusJokerCredits(0);
    }
    setRushPendingSelection(null);
    setRush({ phase: 'loading' });
    let res = await startRushSession({ mode, language, reward_unlock: rewardUnlock }).catch(() => null);
    if (res && !res.ok && res.limit_reached && !rewardUnlock && res.rewarded_ad_available && !isPremium) {
      setRush({ phase: 'lobby' });
      const rewarded = await requestRewardedUnlock('Rush veya maraton icin bir ek hak kazanmak uzere odullu reklam izle.');
      if (!rewarded) return;
      unlockedByRewardAd = true;
      skipRushResultAdRef.current = true;
      setRush({ phase: 'loading' });
      res = await startRushSession({ mode, language, reward_unlock: true }).catch(() => null);
    }
    if (res && res.ok) {
      setRushPendingSelection(null);
      if (unlockedByRewardAd && !isPremium) {
        setRushBonusJokerCredits(1);
      }
      void refreshRushAccess();
      setRush({
        phase: 'playing',
        session: res.session,
        current: 0,
        correct: 0,
        answered: 0,
        submitting: false,
        streak: 0,
        flash: null,
        flashKey: 0,
        revealed: null,
        confettiKey: 0,
        usedJokers: new Set(),
        hiddenOptions: {},
      });
    } else if (res?.limit_reached) {
      setRushPendingSelection(null);
      setRush({ phase: 'lobby' });
      void refreshRushAccess();
      if (!isPremium) {
        Alert.alert('Gunluk hak bitti', 'Bir odullu reklam izleyerek Rush veya Maraton icin +1 giris acabilirsin.');
        return;
      }
      Alert.alert('Rush su an acilamadi', res.error || 'Gunluk limit dolu.');
    } else if (res?.requires_subscription && premiumOnlyMode) {
      setRushPendingSelection(null);
      setRush({ phase: 'lobby' });
      onRequirePaywall?.();
    } else {
      setRushPendingSelection(null);
      setRush({ phase: 'lobby' });
      Alert.alert('Rush su an acilamadi', res?.error || 'Gercek soru havuzuna baglanilamadi.');
    }
  }, [isPremium, isSignedIn, language, onRequireAuth, onRequirePaywall, refreshRushAccess]);

  const handleQuizIntroStart = useCallback(async () => {
    if (!quizIntro || quizIntroBusy) return;
    if (quizIntro.kind === 'swipe') {
      setQuizIntro(null);
      resetSwipeCardState();
      setSwipeLobbyVisible(true);
      return;
    }
    setQuizIntroBusy(true);
    setQuizIntro(null);
    try {
      await handleRushStart(quizIntro.kind);
    } finally {
      setQuizIntroBusy(false);
    }
  }, [handleRushStart, quizIntro, quizIntroBusy, resetSwipeCardState]);

  const handleRushAnswer = useCallback(async (selected: PoolOptionKey) => {
    if (rush.phase !== 'playing' || rush.submitting || rush.revealed) return;
    const q = rush.session.questions[rush.current];
    if (!q) return;
    setRushPendingSelection(selected);
    const selectionStartedAt = Date.now();

    setRush((prev) => prev.phase === 'playing' ? { ...prev, submitting: true } : prev);
    const res = await submitRushAnswer({ session_id: rush.session.id, attempt_id: q.id, selected_option: selected });
    if (res.ok) {
      await ensurePendingSelectionDuration(selectionStartedAt);
      if (res.is_correct) playCorrectSound(); else playWrongSound();
      const correctKey = res.correct_option ?? selected;
      const fallbackAnswerPauseSeconds = 1 + (res.is_correct ? RUSH_CORRECT_TIME_BONUS_SECONDS : 0);
      const resolvedExpiresAt =
        res.expires_at || extendRushExpiresAt(rush.session.expires_at, fallbackAnswerPauseSeconds);
      const resolvedTotalTimeSeconds = res.total_time_seconds ?? rush.session.total_time_seconds;
      const applyRushTimeBonus = (session: RushSession): RushSession => {
        return {
          ...session,
          expires_at: resolvedExpiresAt,
          total_time_seconds: resolvedTotalTimeSeconds,
        };
      };
      setRushPendingSelection(null);
      setRush((prev) => prev.phase === 'playing'
        ? {
            ...prev,
            session: applyRushTimeBonus(prev.session),
            revealed: { selected, isCorrect: res.is_correct, correctKey },
          }
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
        finalizeRushResult({
          phase: 'result',
          mode: rush.session.mode,
          total: na,
          correct: nc,
          reward: toQuizReward(
            c.ok ? c.xp_earned : 0,
            c.ok ? c.tickets_earned : 0,
            c.ok ? c.arena_score_earned : 0,
          ),
        });
      } else {
        setRush((prev) => prev.phase === 'playing'
          ? {
              ...prev,
              session: applyRushTimeBonus(prev.session),
              current: prev.current + 1,
              correct: nc,
              answered: na,
              submitting: false,
              streak: newStreak,
              flash,
              flashKey: fk,
              revealed: null,
            }
          : prev,
        );
      }
    } else if (res.expired) {
      setRushPendingSelection(null);
      const c = await completeRushSession({ session_id: rush.session.id });
      finalizeRushResult({
        phase: 'result',
        mode: rush.session.mode,
        total: rush.answered,
        correct: rush.correct,
        reward: toQuizReward(
          c.ok ? c.xp_earned : 0,
          c.ok ? c.tickets_earned : 0,
          c.ok ? c.arena_score_earned : 0,
        ),
      });
    } else {
      setRushPendingSelection(null);
      setRush((prev) => prev.phase === 'playing' ? { ...prev, submitting: false } : prev);
    }
  }, [finalizeRushResult, rush]);

  const handleRushJoker = useCallback(async (key: RushJokerKey) => {
    if (rush.phase !== 'playing' || rush.submitting || rush.revealed) return;
    const q = rush.session.questions[rush.current];
    if (!q || rush.usedJokers.has(key)) return;

    const walletKey =
      key === 'fifty_fifty'
        ? 'joker_fifty_fifty'
        : key === 'freeze'
          ? 'joker_freeze'
          : 'joker_pass';
    const source: JokerSource = (walletInventory?.[walletKey] || 0) > 0 ? 'wallet' : 'bonus';

    if (source === 'bonus' && !isPremium && rushBonusJokerCredits <= 0) {
      const rewarded = await requestRewardedUnlock('Bu tur icin 1 bonus joker hakki kazanmak uzere odullu reklam izle.');
      if (!rewarded) {
        onOpenWallet?.(walletKey);
        return;
      }
      skipRushResultAdRef.current = true;
      setRushBonusJokerCredits((prev) => prev + 1);
    }

    if (key === 'pass') {
      const res = await requestRushJoker({
        session_id: rush.session.id,
        attempt_id: q.id,
        type: 'pass',
        source,
      });
      if (!res.ok || res.type !== 'pass') {
        if (source === 'wallet') void onRefreshWallet?.();
        return;
      }
      setRushPendingSelection(null);
      if (rush.current + 1 >= rush.session.questions.length) {
        const c = await completeRushSession({ session_id: rush.session.id });
        finalizeRushResult({
          phase: 'result',
          mode: rush.session.mode,
          total: rush.answered,
          correct: rush.correct,
          reward: toQuizReward(
            c.ok ? c.xp_earned : 0,
            c.ok ? c.tickets_earned : 0,
            c.ok ? c.arena_score_earned : 0,
          ),
        });
        return;
      }
      setRush((prev) => {
        if (prev.phase !== 'playing') return prev;
        const nextUsedJokers = new Set(prev.usedJokers);
        nextUsedJokers.add('pass');
        return { ...prev, current: prev.current + 1, usedJokers: nextUsedJokers };
      });
      if (source === 'wallet') {
        void onRefreshWallet?.();
      } else if (!isPremium) {
        setRushBonusJokerCredits((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    if (key === 'freeze') {
      const res = await requestRushJoker({
        session_id: rush.session.id,
        attempt_id: q.id,
        type: 'freeze',
        seconds: 7,
        source,
      });
      if (!res.ok || res.type !== 'freeze') {
        if (source === 'wallet') void onRefreshWallet?.();
        return;
      }
      setRush((prev) => {
        if (prev.phase !== 'playing') return prev;
        const nextUsedJokers = new Set(prev.usedJokers);
        nextUsedJokers.add('freeze');
        return {
          ...prev,
          usedJokers: nextUsedJokers,
          session: { ...prev.session, expires_at: res.expires_at },
        };
      });
      if (source === 'wallet') {
        void onRefreshWallet?.();
      } else if (!isPremium) {
        setRushBonusJokerCredits((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    const res = await requestRushJoker({
      session_id: rush.session.id,
      attempt_id: q.id,
      type: 'fifty_fifty',
      source,
    });
    if (!res.ok || res.type !== 'fifty_fifty' || res.removed_options.length === 0) {
      if (source === 'wallet') void onRefreshWallet?.();
      return;
    }
    setRush((prev) => {
      if (prev.phase !== 'playing') return prev;
      const nextUsedJokers = new Set(prev.usedJokers);
      nextUsedJokers.add('fifty_fifty');
      return {
        ...prev,
        usedJokers: nextUsedJokers,
        hiddenOptions: { ...prev.hiddenOptions, [q.id]: res.removed_options },
      };
    });
    if (source === 'wallet') {
      void onRefreshWallet?.();
    } else if (!isPremium) {
      setRushBonusJokerCredits((prev) => Math.max(0, prev - 1));
    }
  }, [
    finalizeRushResult,
    isPremium,
    onOpenWallet,
    onRefreshWallet,
    rush,
    rushBonusJokerCredits,
    walletInventory,
  ]);

  const handleRushExpired = useCallback(async () => {
    if (rush.phase !== 'playing') return;
    setRushPendingSelection(null);
    const c = await completeRushSession({ session_id: rush.session.id });
    finalizeRushResult({
      phase: 'result',
      mode: rush.session.mode,
      total: rush.answered,
      correct: rush.correct,
      reward: toQuizReward(
        c.ok ? c.xp_earned : 0,
        c.ok ? c.tickets_earned : 0,
        c.ok ? c.arena_score_earned : 0,
      ),
    });
  }, [finalizeRushResult, rush]);

  // â”€â”€ Rush modal â”€â”€
  const rushModal = useMemo(() => {
    if (rush.phase === 'lobby') return null;
    if (rush.phase === 'loading') return (
      <Modal visible animationType="fade" transparent={false}>
        <View style={qs.modalBg}>
          <ModalAtmosphere accent={accent} secondary={rushAtmosphereTint} />
          <ActivityIndicator size="large" color={accent} style={{ marginTop: 120 }} />
          <Text style={[qs.loadText, { textAlign: 'center', marginTop: 16 }]}>{copy.loading}</Text>
        </View>
      </Modal>
    );
    if (rush.phase === 'playing') {
      const q = rush.session.questions[rush.current];
      const totalQ = rush.session.questions.length;
      const progressPct = totalQ > 0 ? ((rush.current + 1) / totalQ) * 100 : 0;
      const totalSecs = rush.session.total_time_seconds || (rush.session.mode === 'rush_15' ? 90 : 150);
      const posterPath = q?.movie_poster_path || (q ? RUSH_POSTER_MAP[q.movie_title] : null);
      const thumbUri = posterPath ? buildPosterUri(posterPath) : null;
      const hiddenOptionKeys = q ? rush.hiddenOptions[q.id] || [] : [];
      const visibleOptions = q ? q.options.filter((opt) => !hiddenOptionKeys.includes(opt.key) || !!rush.revealed) : [];
      return (
        <Modal visible animationType="fade" transparent={false}>
          <View style={qs.modalBg}>
            <ModalAtmosphere accent={accent} secondary={rushAtmosphereTint} />
            {/* Top bar: quit + title + timer */}
            <View style={qs.modalTopBar}>
              <Pressable
                style={({ pressed }) => getTactilePressStyle(pressed, 'icon')}
                onPress={() => {
                  setRush({
                    phase: 'result',
                    mode: rush.session.mode,
                    total: rush.answered,
                    correct: rush.correct,
                    reward: EMPTY_QUIZ_REWARD,
                  });
                }}
                hitSlop={12}
                accessibilityRole="button"
              >
                <Ionicons name="close" size={22} color="#8e8b84" />
              </Pressable>
              <Text style={qs.modalTopTitle}>{copy.rush}</Text>
              {rush.session.expires_at ? (
                <RushTimer
                  expiresAt={rush.session.expires_at}
                  totalSeconds={totalSecs}
                  paused={rush.submitting || !!rush.revealed}
                  onExpired={handleRushExpired}
                />
              ) : null}
            </View>

            {/* Progress bar */}
            <View style={qs.rushProgressBarBg}>
              <View style={[qs.rushProgressBarFill, { width: `${progressPct}%`, backgroundColor: accent }]} />
            </View>

            {/* Question area â€” flex fill */}
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
              {/* Flash feedback overlay */}
              <RushFlash key={rush.flashKey} type={rush.flash} />
              {/* Confetti blast on correct answer */}
              <ConfettiBlast trigger={rush.confettiKey} />

              {q && (
                <View>
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

                  {/* Options â€” press + reveal animation */}
                  <View style={qs.quizOptionsStack}>
                    {visibleOptions.map((opt) => {
                      const rev = rush.revealed;
                      let result: 'pending' | 'correct' | 'wrong' | 'reveal' | null = null;
                      if (rev) {
                        if (opt.key === rev.selected && rev.isCorrect) result = 'correct';
                        else if (opt.key === rev.selected && !rev.isCorrect) result = 'wrong';
                        else if (opt.key === rev.correctKey && !rev.isCorrect) result = 'reveal';
                      }
                      if (!rev && rushPendingSelection === opt.key) {
                        result = 'pending';
                      }
                      return (
                        <RushOption key={opt.key} opt={opt} onPress={() => void handleRushAnswer(opt.key)} disabled={!!rush.submitting || !!rush.revealed} result={result} accent={accent} />
                      );
                    })}
                  </View>

                  {!rush.revealed && (
                    <>
                      {!isPremium && rushBonusJokerCredits > 0 ? (
                        <View style={[qs.sceneChipRow, { justifyContent: 'center', marginTop: 10, marginBottom: 10 }]}>
                          <SceneChip
                            icon="sparkles-outline"
                            value={formatBonusJokerLabel(rushBonusJokerCredits)}
                            accent={accent}
                            tone="positive"
                          />
                        </View>
                      ) : null}
                      <View style={qs.jokerBarBottom}>
                        <JokerIconButton
                          variant="fifty"
                          label="50/50 joker"
                          accent={accent}
                          disabled={rush.usedJokers.has('fifty_fifty')}
                          onPress={() => void handleRushJoker('fifty_fifty')}
                        />
                        <JokerIconButton
                          variant="pass"
                          label="Pas jokeri"
                          accent={accent}
                          disabled={rush.usedJokers.has('pass')}
                          onPress={() => void handleRushJoker('pass')}
                        />
                        <JokerIconButton
                          variant="freeze"
                          label="Freeze jokeri"
                          accent={accent}
                          disabled={rush.usedJokers.has('freeze')}
                          onPress={() => void handleRushJoker('freeze')}
                        />
                      </View>
                    </>
                  )}

                </View>
              )}
            </View>

            {/* Bottom bar â€” only progress */}
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
            reward={rush.reward}
            accent={accent}
            language={language}
            copy={copy}
            onRetry={() => setRush({ phase: 'lobby' })}
          />
        </Modal>
      );
    }
    return null;
  }, [rush, accent, copy, handleRushAnswer, handleRushExpired, handleRushJoker, rushAtmosphereTint, rushPendingSelection, rushBonusJokerCredits, isPremium, language]);

  return (
    <ScrollView style={qs.quizPage} contentContainerStyle={qs.quizPageContent}>
      <View style={qs.quizGrid}>
        <Pressable
          style={({ pressed }) => [
            qs.walletStrip,
            getTactilePressStyle(pressed, 'tile'),
          ]}
          onPress={() => {
            if (!isSignedIn) {
              onRequireAuth?.();
              return;
            }
            onOpenWallet?.(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={walletCopy.accessibility}
        >
          <View style={qs.walletStripCopy}>
            <Text style={qs.walletStripEyebrow}>{walletCopy.eyebrow}</Text>
            <Text style={qs.walletStripTitle}>{walletCopy.title}</Text>
            <Text style={qs.walletStripMeta}>{walletCopy.meta}</Text>
            {walletCopy.reward ? (
              <View style={qs.walletStripNotice}>
                <View style={qs.walletStripNoticeDot} />
                <Text style={qs.walletStripNoticeText}>{walletCopy.reward}</Text>
              </View>
            ) : null}
          </View>
          <View style={qs.walletStripBadge}>
            <Ionicons name="ticket-outline" size={16} color="#130d09" />
            <Text style={qs.walletStripBadgeText}>{walletCopy.action}</Text>
          </View>
        </Pressable>

        {!isPremium ? (
          <Pressable
            style={({ pressed }) => [
              qs.premiumTeaser,
              getTactilePressStyle(pressed, 'tile'),
            ]}
            onPress={() => {
              if (!isSignedIn) {
                onRequireAuth?.();
                return;
              }
              onRequirePaywall?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={premiumTeaserCopy.cta}
          >
            <View style={qs.premiumTeaserAuraPrimary} />
            <View style={qs.premiumTeaserAuraSecondary} />

            <View style={qs.premiumTeaserHeader}>
              <Text style={qs.premiumTeaserEyebrow}>{premiumTeaserCopy.eyebrow}</Text>
              <View style={qs.premiumTeaserBadge}>
                <Ionicons name="diamond-outline" size={12} color="#f6d793" />
                <Text style={qs.premiumTeaserBadgeText}>VIP</Text>
              </View>
            </View>

            <Text style={qs.premiumTeaserTitle}>{premiumTeaserCopy.title}</Text>
            <Text style={qs.premiumTeaserBody}>{premiumTeaserCopy.body}</Text>

            <View style={qs.premiumTeaserStatsRow}>
              <View style={qs.premiumTeaserStat}>
                <Ionicons name="infinite-outline" size={14} color="#f6d793" />
                <Text style={qs.premiumTeaserStatText}>{premiumTeaserCopy.stats[0]}</Text>
              </View>
              <View style={qs.premiumTeaserStat}>
                <Ionicons name="sparkles-outline" size={14} color="#f6d793" />
                <Text style={qs.premiumTeaserStatText}>{premiumTeaserCopy.stats[1]}</Text>
              </View>
              <View style={qs.premiumTeaserStat}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#f6d793" />
                <Text style={qs.premiumTeaserStatText}>{premiumTeaserCopy.stats[2]}</Text>
              </View>
            </View>

            <View style={qs.premiumTeaserFooter}>
              <Text style={qs.premiumTeaserMeta}>{premiumTeaserCopy.meta}</Text>
              <View style={qs.premiumTeaserAction}>
                <Text style={qs.premiumTeaserActionText}>{premiumTeaserCopy.cta}</Text>
                <Ionicons name="arrow-forward" size={14} color="#130d09" />
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={qs.quizGridRow}>
          <Pressable
            style={({ pressed }) => [
              qs.quizTile,
              qs.quizTileSwipe,
              (!currentFilm || moviesLoading) && qs.quizTileDisabled,
              getTactilePressStyle(pressed, 'tile'),
            ]}
            onPress={() => {
              if (!isSignedIn) { onRequireAuth?.(); return; }
              if (!currentFilm || moviesLoading) return;
              if (dailyLimitReached) {
                void grantSwipeRewardFromTile().then((unlocked) => {
                  if (!unlocked) return;
                  setQuizIntro({ kind: 'swipe' });
                });
                return;
              }
              setQuizIntro({ kind: 'swipe' });
            }}
            accessibilityRole="button"
            accessibilityLabel={copy.swipeQuiz}
          >
            <View style={[qs.quizTileAura, { backgroundColor: `${accent}18` }]} />
            <View style={qs.quizTileHeader}>
              <View style={[qs.quizTileIconWrap, { backgroundColor: accentFaded }]}>
                <Ionicons name="swap-horizontal-outline" size={22} color={accent} />
              </View>
              <View style={[qs.quizTileStatus, dailyLimitReached && !isPremium ? qs.quizTileStatusDanger : null]}>
                <Text style={[qs.quizTileStatusText, dailyLimitReached && !isPremium ? qs.quizTileStatusTextDanger : null]}>
                  {isPremium ? 'PREMIUM' : `${swipeSummaryValue}/${swipeAccess.freeLimit}`}
                </Text>
              </View>
            </View>
            <Text style={qs.quizTileEyebrow}>SWIPE</Text>
            <Text style={qs.quizTileTitle}>{copy.swipeQuiz}</Text>
            <Text style={qs.quizTileCopy}>
              5 soruluk film turu. Once kisa bilgiyi gor, sonra filmi sec ve tek ekranda oyna.
            </Text>
            {!isPremium ? (
              <Text style={qs.quizTileRewardText}>Reklam: +1 giris hakki ve tur icinde 1 bonus joker.</Text>
            ) : null}
            <View style={qs.quizTileStatRow}>
              <View style={qs.quizMiniStat}>
                <Ionicons name="help-outline" size={12} color="#d4cec7" />
                <Text style={qs.quizMiniStatText}>5 soru</Text>
              </View>
              <View style={qs.quizMiniStat}>
                <Ionicons name="sparkles-outline" size={12} color="#d4cec7" />
                <Text style={qs.quizMiniStatText}>2 joker</Text>
              </View>
              <View style={qs.quizMiniStat}>
                <Ionicons name="shuffle-outline" size={12} color="#d4cec7" />
                <Text style={qs.quizMiniStatText}>Film secimli</Text>
              </View>
            </View>
            <View
              style={[
                qs.quizTileAction,
                { backgroundColor: dailyLimitReached ? `${accent}20` : accentFaded },
              ]}
            >
              <Ionicons
                name={dailyLimitReached ? 'play-circle-outline' : 'play'}
                size={14}
                color={accent}
              />
              <Text style={[qs.quizTileActionText, { color: accent }]}>
                {dailyLimitReached ? 'REKLAM +1' : 'AC'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              qs.quizTile,
              qs.quizTileRush,
              getTactilePressStyle(pressed, 'tile'),
            ]}
            onPress={() => setQuizIntro({ kind: 'rush_15' })}
            accessibilityRole="button"
            accessibilityLabel={copy.rushModes.rush_15.label}
          >
            <View style={[qs.quizTileAura, { backgroundColor: `${accent}12` }]} />
            <View style={qs.quizTileHeader}>
              <View style={[qs.quizTileIconWrap, { backgroundColor: accentFaded }]}>
                <Ionicons name="flash-outline" size={22} color={accent} />
              </View>
              <View style={[qs.quizTileStatus, rushLimitReached && !isPremium ? qs.quizTileStatusDanger : null]}>
                <Text style={[qs.quizTileStatusText, rushLimitReached && !isPremium ? qs.quizTileStatusTextDanger : null]}>
                  {rushSummaryValue}
                </Text>
              </View>
            </View>
            <Text style={qs.quizTileEyebrow}>RUSH</Text>
            <Text style={qs.quizTileTitle}>{copy.rushModes.rush_15.label}</Text>
            <Text style={qs.quizTileCopy}>{copy.rushModes.rush_15.sub}</Text>
            {!isPremium ? (
              <Text style={[qs.quizTileAccessText, rushLimitReached ? qs.quizTileAccessTextDanger : null]}>{rushAccessCopy}</Text>
            ) : null}
            {!isPremium ? (
              <Text style={qs.quizTileRewardText}>Reklam: limitte +1 tur acilir, tur icinde 1 bonus joker alinir.</Text>
            ) : null}
            <View style={qs.quizTileStatRow}>
              <View style={qs.quizMiniStat}>
                <Ionicons name="timer-outline" size={12} color="#d4cec7" />
                <Text style={qs.quizMiniStatText}>90s</Text>
              </View>
              <View style={qs.quizMiniStat}>
                <Ionicons name="help-outline" size={12} color="#d4cec7" />
                <Text style={qs.quizMiniStatText}>15 soru</Text>
              </View>
            </View>
            <View style={[qs.quizTileAction, { backgroundColor: rushLimitReached ? `${accent}20` : accentFaded }]}>
              <Ionicons name={rushLimitReached ? 'play-circle-outline' : 'play'} size={14} color={accent} />
              <Text style={[qs.quizTileActionText, { color: accent }]}>BASLAT</Text>
            </View>
          </Pressable>
        </View>

        <View style={qs.quizGridRow}>
          <Pressable
            style={({ pressed }) => [
              qs.quizTile,
              qs.quizTileMarathon,
              getTactilePressStyle(pressed, 'tile'),
            ]}
            onPress={() => setQuizIntro({ kind: 'rush_30' })}
            accessibilityRole="button"
            accessibilityLabel={copy.rushModes.rush_30.label}
          >
            <View style={[qs.quizTileAura, { backgroundColor: 'rgba(165,113,100,0.12)' }]} />
            <View style={qs.quizTileHeader}>
              <View style={[qs.quizTileIconWrap, { backgroundColor: 'rgba(165,113,100,0.12)' }]}>
                <Ionicons name="rocket-outline" size={22} color="#A57164" />
              </View>
              <View
                style={[
                  qs.quizTileStatus,
                  !rushLimitReached ? { backgroundColor: 'rgba(165,113,100,0.10)', borderColor: 'rgba(165,113,100,0.22)' } : null,
                  rushLimitReached && !isPremium ? qs.quizTileStatusDanger : null,
                ]}
              >
                <Text
                  style={[
                    qs.quizTileStatusText,
                    !rushLimitReached ? { color: '#F1DDD6' } : null,
                    rushLimitReached && !isPremium ? qs.quizTileStatusTextDanger : null,
                  ]}
                >
                  {rushSummaryValue}
                </Text>
              </View>
            </View>
            <Text style={qs.quizTileEyebrow}>MARATHON</Text>
            <Text style={[qs.quizTileTitle, { color: '#F1DDD6' }]}>{copy.rushModes.rush_30.label}</Text>
            <Text style={qs.quizTileCopy}>{copy.rushModes.rush_30.sub}</Text>
            {!isPremium ? (
              <Text style={[qs.quizTileAccessText, rushLimitReached ? qs.quizTileAccessTextDanger : null]}>{rushAccessCopy}</Text>
            ) : null}
            {!isPremium ? (
              <Text style={qs.quizTileRewardText}>Reklam: limitte +1 maraton acilir, tur icinde 1 bonus joker alinir.</Text>
            ) : null}
            <View style={qs.quizTileStatRow}>
              <View style={qs.quizMiniStat}>
                <Ionicons name="timer-outline" size={12} color="#d8c5be" />
                <Text style={[qs.quizMiniStatText, { color: '#d8c5be' }]}>150s</Text>
              </View>
              <View style={qs.quizMiniStat}>
                <Ionicons name="trophy-outline" size={12} color="#d8c5be" />
                <Text style={[qs.quizMiniStatText, { color: '#d8c5be' }]}>30 soru</Text>
              </View>
            </View>
            <View style={[qs.quizTileAction, { backgroundColor: rushLimitReached ? 'rgba(165,113,100,0.22)' : 'rgba(165,113,100,0.14)' }]}>
              <Ionicons name={rushLimitReached ? 'play-circle-outline' : 'play'} size={14} color="#A57164" />
              <Text style={[qs.quizTileActionText, { color: '#F1DDD6' }]}>BASLAT</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              qs.quizTile,
              qs.quizTileBlur,
              getTactilePressStyle(pressed, 'tile'),
            ]}
            onPress={() => {
              if (!isSignedIn) { onRequireAuth?.(); return; }
              if (blurLimitReached) {
                void grantBlurRewardFromTile().then((unlocked) => {
                  if (!unlocked) return;
                  setBlurVisible(true);
                });
                return;
              }
              setBlurVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={copy.blur}
          >
            <View style={[qs.quizTileAura, { backgroundColor: `${accent}14` }]} />
            <View style={qs.quizTileHeader}>
              <View style={[qs.quizTileIconWrap, { backgroundColor: accentFaded }]}>
                <Ionicons name="eye-outline" size={22} color={accent} />
              </View>
              <View style={[qs.quizTileStatus, blurLimitReached && !isPremium ? qs.quizTileStatusDanger : null]}>
                <Text style={[qs.quizTileStatusText, blurLimitReached && !isPremium ? qs.quizTileStatusTextDanger : null]}>
                  {isPremium ? 'PREMIUM' : `${blurSummaryValue}/${blurAccess.freeLimit}`}
                </Text>
              </View>
            </View>
            <Text style={qs.quizTileEyebrow}>BLUR</Text>
            <Text style={qs.quizTileTitle}>{copy.blur}</Text>
            <Text style={qs.quizTileCopy}>{copy.blurDesc}</Text>
            {!isPremium ? (
              <Text style={qs.quizTileRewardText}>Reklam: +1 giris hakki ve bu tur icin 1 bonus joker.</Text>
            ) : null}
            <View style={qs.quizTileStatRow}>
              <View style={qs.quizMiniStat}>
                <Ionicons name="aperture-outline" size={12} color="#d4cec7" />
                <Text style={qs.quizMiniStatText}>6 step</Text>
              </View>
              <View style={qs.quizMiniStat}>
                <Ionicons name="sparkles-outline" size={12} color="#d4cec7" />
                <Text style={qs.quizMiniStatText}>4 joker</Text>
              </View>
            </View>
            <View
              style={[
                qs.quizTileAction,
                { backgroundColor: blurLimitReached ? `${accent}20` : accentFaded },
              ]}
            >
              <Ionicons
                name={blurLimitReached ? 'play-circle-outline' : 'play'}
                size={14}
                color={accent}
              />
              <Text style={[qs.quizTileActionText, { color: accent }]}>
                {blurLimitReached ? 'REKLAM +1' : 'AC'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Modals */}
      <QuizIntroModal
        intro={quizIntro}
        visible={!!quizIntro}
        copy={copy}
        language={language}
        accent={accent}
        secondary={rushAtmosphereTint}
        busy={quizIntroBusy}
        onClose={handleQuizIntroClose}
        onStart={() => void handleQuizIntroStart()}
      />
      <Modal visible={swipeLobbyVisible} animationType="slide" transparent={false} onRequestClose={handleSwipeLobbyClose}>
        <View style={qs.modalBg}>
          <View style={qs.modalAtmosphere}>
            <View style={[qs.modalAura, qs.modalAuraPrimary, { backgroundColor: `${accent}16` }]} />
            <View style={[qs.modalAura, qs.modalAuraSecondary, { backgroundColor: rushAtmosphereTint }]} />
            <View style={qs.modalVeil} />
          </View>
          <View style={qs.modalTopBar}>
            <Pressable
              style={({ pressed }) => getTactilePressStyle(pressed, 'icon')}
              onPress={handleSwipeLobbyClose}
              accessibilityRole="button"
              accessibilityLabel={copy.back}
            >
              <Ionicons name="close" size={26} color="#E5E4E2" />
            </Pressable>
            <Text style={qs.modalTopTitle}>{copy.swipeQuiz}</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={qs.swipeLobbyBody}>
            <Text style={qs.swipeLobbyEyebrow}>TINDER MODE</Text>
            <Text style={qs.swipeLobbyLead}>Sola gec, saga quiz ac.</Text>

            {moviesLoading && <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />}
            {!moviesLoading && !currentFilm && (
              <View style={qs.emptyBox}>
                <Ionicons name="film-outline" size={36} color="#333" />
                <Text style={qs.emptyText}>{copy.noMovies}</Text>
              </View>
            )}

            {!moviesLoading && currentFilm && (
              <>
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
                      {currentFilm.release_year || ''}{currentFilm.vote_average != null ? ` | ${currentFilm.vote_average.toFixed(1)}` : ''}
                    </Text>
                  </View>
                  {currentFilm.question_count > 0 && (
                    <View style={[qs.filmBadge, { backgroundColor: accent }]}>
                      <Ionicons name="flash" size={11} color="#fff" />
                      <Text style={qs.filmBadgeText}>{currentFilm.question_count}</Text>
                    </View>
                  )}
                </View>

                <Text style={[qs.dailyCounter, dailyLimitReached && { color: '#f87171' }]}>
                  {isPremium ? 'PREMIUM - UNLIMITED' : dailyLimitReached ? copy.dailyLimit : `${swipeAccess.used} ${copy.freeLimit}`}
                </Text>

                <View style={qs.swipeBtnRow}>
                  <Pressable
                    style={({ pressed }) => [
                      qs.swipeBtnPill,
                      qs.swipeBtnSkip,
                      getTactilePressStyle(pressed, 'pill'),
                    ]}
                    onPress={handleSwipeLeft}
                    accessibilityRole="button"
                    accessibilityLabel={copy.swipeSkip}
                  >
                    <Ionicons name="close" size={20} color="#f87171" />
                    <Text style={[qs.swipeBtnPillText, { color: '#f87171' }]}>{copy.swipeSkip}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      qs.swipeBtnPill,
                      qs.swipeBtnQuiz,
                      dailyLimitReached && { opacity: 0.8 },
                      getTactilePressStyle(pressed, 'pill'),
                    ]}
                    onPress={handleSwipeRight}
                    accessibilityRole="button"
                    accessibilityLabel={copy.swipeQuiz}
                  >
                    <Ionicons name="checkmark" size={20} color={accent} />
                    <Text style={[qs.swipeBtnPillText, { color: accent }]}>{copy.swipeQuiz}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
      <PoolQuizModal
        visible={quizVisible}
        movieId={quizMovieId}
        moviePosterPath={quizMoviePosterPath}
        language={language}
        isDawn={isDawn}
        onClose={handleQuizClose}
        showAds={showAds}
        skipResultAd={skipNextSwipeResultAd}
        pauseTimers={walletOverlayVisible}
        walletInventory={walletInventory}
        onRefreshWallet={onRefreshWallet}
        onOpenWallet={onOpenWallet}
      />
      {rushModal}
      <BlurQuizModal
        visible={blurVisible}
        language={language}
        isDawn={isDawn}
        isSignedIn={isSignedIn}
        isPremium={isPremium}
        showAds={showAds}
        onClose={handleBlurClose}
        onRequireAuth={onRequireAuth}
      />
    </ScrollView>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Styles
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const qs = StyleSheet.create({
  quizPage: {
    flex: 1,
    backgroundColor: '#090909',
  },
  quizPageContent: {
    paddingTop: 18,
    paddingBottom: 44,
  },
  quizGrid: {
    gap: 14,
    paddingHorizontal: 16,
  },
  walletStrip: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 17,
    backgroundColor: 'rgba(23,23,23,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  walletStripCopy: {
    flex: 1,
    minWidth: 0,
  },
  walletStripEyebrow: {
    color: '#A57164',
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  walletStripTitle: {
    color: '#E5E4E2',
    fontSize: 22,
    fontFamily: ff('700'),
    fontWeight: '700',
    marginBottom: 4,
  },
  walletStripMeta: {
    color: '#c9c6bf',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 220,
  },
  walletStripNotice: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(138,154,91,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(246,215,147,0.14)',
  },
  walletStripNoticeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d7c39d',
  },
  walletStripNoticeText: {
    color: '#d7c39d',
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  walletStripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#8A9A5B',
  },
  walletStripBadgeText: {
    color: '#130d09',
    fontSize: 12,
    fontFamily: ff('700'),
    fontWeight: '700',
  },
  premiumTeaser: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(23,23,23,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 6,
  },
  premiumTeaserAuraPrimary: {
    position: 'absolute',
    top: -46,
    right: -18,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(165,113,100,0.12)',
  },
  premiumTeaserAuraSecondary: {
    position: 'absolute',
    bottom: -68,
    left: -34,
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: 'rgba(138,154,91,0.10)',
  },
  premiumTeaserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  premiumTeaserEyebrow: {
    color: '#A57164',
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  premiumTeaserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(246,215,147,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(246,215,147,0.18)',
  },
  premiumTeaserBadgeText: {
    color: '#f6d793',
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  premiumTeaserTitle: {
    color: '#E5E4E2',
    fontSize: 22,
    lineHeight: 27,
    fontFamily: ff('700'),
    fontWeight: '700',
    marginBottom: 10,
    maxWidth: 280,
  },
  premiumTeaserBody: {
    color: '#c9c6bf',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    maxWidth: 304,
  },
  premiumTeaserStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  premiumTeaserStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  premiumTeaserStatText: {
    color: '#eadfd2',
    fontSize: 11,
    fontFamily: ff('600'),
    fontWeight: '600',
  },
  premiumTeaserFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },
  premiumTeaserMeta: {
    flex: 1,
    color: '#9e8d7d',
    fontSize: 11,
    lineHeight: 16,
  },
  premiumTeaserAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: '#8A9A5B',
  },
  premiumTeaserActionText: {
    color: '#130d09',
    fontSize: 12,
    fontFamily: ff('700'),
    fontWeight: '700',
  },
  quizGridRow: {
    flexDirection: 'row',
    gap: 14,
  },
  quizTile: {
    position: 'relative',
    flex: 1,
    minHeight: 244,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(23,23,23,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
  quizTileSwipe: {
    backgroundColor: 'rgba(23,23,23,0.88)',
  },
  quizTileRush: {
    backgroundColor: 'rgba(23,23,23,0.88)',
  },
  quizTileMarathon: {
    backgroundColor: 'rgba(23,23,23,0.88)',
  },
  quizTileBlur: {
    backgroundColor: 'rgba(23,23,23,0.88)',
  },
  quizTileDisabled: {
    opacity: 0.72,
  },
  quizTileAura: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    top: -48,
    right: -36,
    opacity: 0.42,
  },
  quizTileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  quizTileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  quizTileStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quizTileStatusDanger: {
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderColor: 'rgba(248,113,113,0.20)',
  },
  quizTileStatusText: {
    color: '#e3ddd5',
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
  quizTileStatusTextDanger: {
    color: '#fca5a5',
  },
  quizTileEyebrow: {
    color: '#958f87',
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  quizTileTitle: {
    color: '#E5E4E2',
    fontSize: 18,
    fontFamily: ff('700'),
    fontWeight: '700',
    lineHeight: 22,
  },
  quizTileCopy: {
    color: '#c9c6bf',
    fontSize: 12,
    fontFamily: ff('500'),
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 8,
  },
  quizTileRewardText: {
    color: '#9ea879',
    fontSize: 10,
    fontFamily: ff('600'),
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 8,
  },
  quizTileAccessText: {
    color: '#d4cec7',
    fontSize: 10,
    fontFamily: ff('600'),
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 8,
  },
  quizTileAccessTextDanger: {
    color: '#f5b4b4',
  },
  quizTileFeature: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 14,
    padding: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quizTilePosterThumb: {
    width: 54,
    minHeight: 78,
    borderRadius: 12,
    backgroundColor: '#171717',
  },
  quizTilePosterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTileFeatureCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  quizTileFeatureLabel: {
    color: '#8e877f',
    fontSize: 9,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  quizTileFeatureTitle: {
    color: '#f3efe8',
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
    lineHeight: 18,
  },
  quizTileFeatureMeta: {
    color: '#9f988f',
    fontSize: 11,
    fontFamily: ff('500'),
    fontWeight: '500',
    marginTop: 4,
  },
  quizTileStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  quizMiniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quizMiniStatText: {
    color: '#d4cec7',
    fontSize: 10,
    fontFamily: ff('600'),
    fontWeight: '600',
  },
  quizTileAction: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quizTileActionText: {
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pressFeedbackTile: {
    transform: [{ scale: 0.986 }],
    opacity: 0.98,
  },
  pressFeedbackButton: {
    transform: [{ scale: 0.982 }],
    opacity: 0.94,
  },
  pressFeedbackPill: {
    transform: [{ scale: 0.968 }],
    opacity: 0.92,
  },
  pressFeedbackChip: {
    transform: [{ scale: 0.958 }],
    opacity: 0.88,
  },
  pressFeedbackIcon: {
    transform: [{ scale: 0.9 }],
    opacity: 0.7,
  },
  pressFeedbackOption: {
    opacity: 0.94,
  },
  swipeLobbyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  swipeLobbyEyebrow: {
    color: '#8f887f',
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  swipeLobbyLead: {
    color: '#d4cec7',
    fontSize: 14,
    fontFamily: ff('600'),
    fontWeight: '600',
    marginBottom: 20,
  },

  // Hero
  heroBox: {
    paddingTop: 4,
    paddingBottom: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroShell: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 22,
    backgroundColor: 'rgba(14,14,14,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  heroAura: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    opacity: 0.82,
  },
  heroAuraPrimary: {
    top: -76,
    right: -42,
  },
  heroAuraSecondary: {
    bottom: -92,
    left: -56,
  },
  heroVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,8,0.26)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroPillText: {
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroStatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroStatePremium: {
    backgroundColor: 'rgba(250,204,21,0.10)',
    borderColor: 'rgba(250,204,21,0.28)',
  },
  heroStateFree: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroStateText: {
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#E5E4E2',
    fontSize: 21,
    fontFamily: ff('800'),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 28,
  },
  heroSub: {
    color: '#b4afa8',
    fontSize: 13,
    fontFamily: ff('500'),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
    alignSelf: 'center',
  },
  heroMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
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
  sectionShell: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(14,14,14,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 10,
  },
  sectionGlow: {
    position: 'absolute',
    top: -60,
    left: -44,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.72,
  },
  sectionGlowRight: {
    left: undefined,
    right: -44,
    top: -48,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 18,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  sectionEyebrow: {
    color: '#e7e3dc',
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLead: {
    color: '#a7a198',
    fontSize: 13,
    fontFamily: ff('500'),
    fontWeight: '500',
    lineHeight: 20,
  },
  sectionStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionStatusText: {
    color: '#dbd5cd',
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.7,
    fontVariant: ['tabular-nums'],
  },
  sectionStatusDanger: {
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderColor: 'rgba(248,113,113,0.24)',
  },
  sectionStatusDangerText: {
    color: '#fca5a5',
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
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: 'rgba(14,14,14,0.94)',
  },
  swipeTitle: {
    color: '#E5E4E2',
    fontSize: 19,
    fontFamily: ff('800'),
    fontWeight: '800',
    lineHeight: 24,
  },
  swipeMeta: {
    color: '#8f887f',
    fontSize: 12,
    fontFamily: ff('500'),
    fontWeight: '500',
    marginTop: 6,
  },
  swipeDeckShell: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  swipeDeckGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.26,
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
  panelCaptionRow: {
    alignItems: 'center',
    marginTop: 8,
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
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 10,
  },
  modeCardHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
    textAlign: 'center',
  },
  rushCardDetail: {
    color: '#938d85',
    fontSize: 11,
    fontFamily: ff('500'),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    minHeight: 34,
  },
  modeMetaBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  modeMetaText: {
    fontSize: 10,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  modeStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  modeStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeStatText: {
    color: '#d4cec7',
    fontSize: 10,
    fontFamily: ff('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
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
  featureWideCard: {
    width: '100%',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    overflow: 'hidden',
  },
  featureWideGlow: {
    position: 'absolute',
    top: -56,
    right: -42,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.64,
  },
  featureWideTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  featureWideTitle: {
    color: '#f2eee7',
    fontSize: 18,
    fontFamily: ff('800'),
    fontWeight: '800',
    marginBottom: 8,
  },
  featureWideDetail: {
    color: '#aaa399',
    fontSize: 13,
    fontFamily: ff('500'),
    fontWeight: '500',
    lineHeight: 20,
  },
  featureWideFooter: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  featureWideStatus: {
    flex: 1,
    color: '#c7c0b7',
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.5,
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
    textAlign: 'left',
  },
  modalTopTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  modalTopPosterThumb: {
    width: 34,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  quizIntroShell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  quizIntroCard: {
    backgroundColor: 'rgba(10,10,10,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
  },
  quizIntroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 18,
  },
  quizIntroTitle: {
    color: '#E5E4E2',
    fontSize: 24,
    fontFamily: ff('800'),
    fontWeight: '800',
    textAlign: 'center',
  },
  quizIntroSubtitle: {
    color: '#9c988f',
    fontSize: 13,
    fontFamily: ff('500'),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  quizIntroBody: {
    color: '#c9c4bc',
    fontSize: 14,
    fontFamily: ff('400'),
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 16,
  },
  quizIntroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  quizIntroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  quizIntroStatText: {
    color: '#E5E4E2',
    fontSize: 12,
    fontFamily: ff('600'),
    fontWeight: '600',
  },
  quizIntroAction: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  modalAtmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  modalAura: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.9,
  },
  modalAuraPrimary: {
    top: -70,
    right: -40,
  },
  modalAuraSecondary: {
    bottom: 80,
    left: -90,
  },
  modalVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,6,6,0.40)',
  },
  sceneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sceneChipText: {
    fontSize: 11,
    fontFamily: ff('700'),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sceneChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Quiz
  quizSceneShell: {
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  quizSceneHeader: {
    gap: 12,
    marginBottom: 14,
  },
  quizProgressWrap: {
    paddingBottom: 4,
  },
  quizProgress: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 16,
  },
  quizDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  poolQuizViewport: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  poolQuizLoadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolQuizScene: {
    flex: 1,
  },
  poolQuizHeaderBlock: {
    gap: 8,
  },
  poolQuizContent: {
    flex: 1,
    justifyContent: 'center',
  },
  questionText: {
    color: '#E5E4E2',
    fontSize: 15,
    fontFamily: ff('600'),
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 0,
  },
  questionStage: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    minHeight: 0,
  },
  poolQuestionPosterWrap: {
    width: 70,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  poolQuestionPoster: {
    width: '100%',
    height: '100%',
  },
  quizOptionsStack: {
    gap: 8,
    marginTop: 2,
    flexShrink: 1,
  },
  jokerBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 'auto',
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(4,6,8,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  poolQuizJokerBar: {
    marginTop: 10,
  },
  poolQuizActionBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
  },
  jokerBarHidden: {
    display: 'none',
  },
  jokerBarBottom: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(4,6,8,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  jokerBtn: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jokerBtnInner: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  jokerBtnGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
  },
  jokerGlyphGrid: {
    width: 24,
    height: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jokerGlyphDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  jokerGlyphDotMuted: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  jokerGlyphStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  jokerGlyphBadge: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.24)',
  },
  jokerBtnDisabled: {
    opacity: 0.38,
  },
  jokerBtnLabel: {
    color: '#f3efe8',
    fontSize: 12,
    fontFamily: ff('700'),
    fontWeight: '700',
  },
  jokerBtnMeta: {
    color: '#8f887f',
    fontSize: 10,
    fontFamily: ff('500'),
    fontWeight: '500',
    marginTop: 3,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
    marginBottom: 12,
  },
  explanationBoxCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  explanationHeader: {
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
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
    fontFamily: ff('400'),
    lineHeight: 20,
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
  quizTimerShell: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  quizTimerShellCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  quizTimerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
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
  // Rush playing â€” film header
  rushFilmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    fontSize: 18,
    fontFamily: ff('600'),
    fontWeight: '600',
    lineHeight: 28,
    marginBottom: 14,
  },
  // Rush options â€” bigger
  rushSceneShell: {
    gap: 12,
  },
  rushOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
    overflow: 'hidden',
  },
  rushOptionBtnCompact: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
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
  rushOptionBadgeCompact: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  rushOptionBadgeText: {
    fontSize: 13,
    fontFamily: ff('700'),
    fontWeight: '700',
    color: '#8e8b84',
  },
  rushOptionBadgeTextCompact: {
    fontSize: 11,
  },
  optionContent: {
    flex: 1,
  },
  optionTrailing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTrailingCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  optionTrailingResolved: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rushScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 16,
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
  rushOptionLabelCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Rush bottom stats bar
  rushBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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

