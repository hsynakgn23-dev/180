import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { PosterImage } from '../../components/PosterImage';
import {
    fetchBlurMovie,
    requestBlurQuizJoker,
    verifyBlurGuess,
    type BlurQuizHints,
    type BlurQuizJokerKey
} from '../../lib/blurQuizApi';
import {
    completeRushSession,
    fetchPoolMovies,
    fetchPoolQuiz,
    requestPoolFiftyFifty,
    requestRushJoker,
    startRushSession,
    submitPoolAnswer,
    submitPoolSwipe,
    submitRushAnswer,
    type RushJokerKey,
    type PoolLanguageCode,
    type PoolMovie,
    type PoolOptionKey,
    type PoolQuestion,
    type RushMode,
    type RushSession,
    type RushSessionQuestion
} from '../../lib/poolQuizApi';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const RUSH_CORRECT_TIME_BONUS_SECONDS = 3;
const RUSH_FREEZE_SECONDS = 7;
const BLUR_PX = [24, 16, 10, 6, 2, 0];
const BLUR_SCALE = [1.05, 1.035, 1.02, 1.01, 1.005, 1];
const BLUR_STEP_DURATION = 5000;
const BLUR_TOTAL_STEPS = BLUR_PX.length;
const BLUR_TOTAL_DURATION = BLUR_TOTAL_STEPS * BLUR_STEP_DURATION;
const BLUR_XP_PER_STEP = [50, 42, 34, 26, 18, 10];
const BLUR_REVEAL_WINDOWS = [
    { left: 18, top: 20, width: 70, height: 86 },
    { left: 110, top: 24, width: 58, height: 72 },
    { left: 58, top: 92, width: 76, height: 64 },
    { left: 26, top: 164, width: 66, height: 60 },
    { left: 102, top: 170, width: 72, height: 74 },
    { left: 72, top: 220, width: 56, height: 36 }
];

type QuizMode = 'discover' | 'rush' | 'blur';
type OptionResult = 'correct' | 'wrong' | 'reveal' | null;

type QuizCopy = {
    sectionTitle: string;
    sectionSubtitle: string;
    discoverTab: string;
    rushTab: string;
    blurTab: string;
    discoverTitle: string;
    discoverMeta: string;
    rushTitle: string;
    rushMeta: string;
    blurTitle: string;
    blurMeta: string;
    blurDesc: string;
    blurStart: string;
    blurSubmit: string;
    blurGuessPlaceholder: string;
    blurHints: string;
    blurPotentialXp: string;
    blurTimeLeft: string;
    blurStep: string;
    blurCorrectTitle: string;
    blurWrongTitle: string;
    blurRetryNotice: string;
    blurTimeUp: string;
    jokerLabel: string;
    jokerFifty: string;
    jokerPass: string;
    jokerFreeze: string;
    jokerDirector: string;
    jokerYear: string;
    jokerCast: string;
    jokerGenre: string;
    jokerFailed: string;
    eliminated: string;
    loading: string;
    retry: string;
    noMovies: string;
    movieLoadFailed: string;
    questionLoadFailed: string;
    answerFailed: string;
    startQuiz: string;
    skipMovie: string;
    nextQuestion: string;
    finishQuiz: string;
    nextMovie: string;
    playAgain: string;
    close: string;
    question: string;
    score: string;
    correct: string;
    wrong: string;
    result: string;
    xp: string;
    quickMode: string;
    quickMeta: string;
    marathonMode: string;
    marathonMeta: string;
    startRush: string;
    rushStartFailed: string;
    rushAnswerFailed: string;
    rushTimeUp: string;
    subscribersOnly: string;
    dailyLimit: string;
    authRequired: string;
    emptyQuestions: string;
    movieFallback: string;
    yearUnknown: string;
};

const COPY: Record<PoolLanguageCode, QuizCopy> = {
    tr: {
        sectionTitle: 'Quiz',
        sectionSubtitle: 'Daha sakin, okunur ve web arayuzune ait bir film bilgi alani.',
        discoverTab: 'Film Quiz',
        rushTab: 'Rush',
        blurTab: 'Blur',
        discoverTitle: 'Film Quiz',
        discoverMeta: 'Secili filmden kisa soru turu',
        rushTitle: 'Quiz Rush',
        rushMeta: 'Zamana karsi temiz bir tur',
        blurTitle: 'Bulanik Film',
        blurMeta: 'Bulanik posterden filmi tahmin et',
        blurDesc: 'Poster bulanik baslar, zamanla netlesir. 4 ipucu jokerin var; her joker olasi XPyi azaltir.',
        blurStart: 'Blur baslat',
        blurSubmit: 'Tahmini gonder',
        blurGuessPlaceholder: 'Film adini yaz',
        blurHints: 'Ipuclari',
        blurPotentialXp: 'olasi XP',
        blurTimeLeft: 'Kalan sure',
        blurStep: 'Netlik',
        blurCorrectTitle: 'Dogru tahmin',
        blurWrongTitle: 'Bu tur olmadi',
        blurRetryNotice: 'Yaklastin. Yazimi kontrol edip tekrar dene.',
        blurTimeUp: 'Sure bitti',
        jokerLabel: 'Jokerler',
        jokerFifty: '50/50',
        jokerPass: 'Pas',
        jokerFreeze: '+7 sn',
        jokerDirector: 'Yonetmen',
        jokerYear: 'Yil',
        jokerCast: 'Oyuncu',
        jokerGenre: 'Tur',
        jokerFailed: 'Joker kullanilamadi.',
        eliminated: 'Elendi',
        loading: 'Yukleniyor',
        retry: 'Tekrar dene',
        noMovies: 'Quiz icin film bulunamadi.',
        movieLoadFailed: 'Filmler yuklenemedi.',
        questionLoadFailed: 'Bu film icin sorular acilamadi.',
        answerFailed: 'Cevap kaydedilemedi. Lutfen tekrar dene.',
        startQuiz: 'Quiz baslat',
        skipMovie: 'Filmi gec',
        nextQuestion: 'Sonraki soru',
        finishQuiz: 'Sonucu gor',
        nextMovie: 'Yeni filme gec',
        playAgain: 'Yeniden oyna',
        close: 'Kapat',
        question: 'Soru',
        score: 'Skor',
        correct: 'Dogru',
        wrong: 'Yanlis',
        result: 'Sonuc',
        xp: 'XP',
        quickMode: 'Quick 15',
        quickMeta: '15 soru / 90 sn',
        marathonMode: 'Marathon 30',
        marathonMeta: '30 soru / 150 sn',
        startRush: 'Turu baslat',
        rushStartFailed: 'Rush turu baslatilamadi.',
        rushAnswerFailed: 'Cevap gonderilemedi.',
        rushTimeUp: 'Sure doldu',
        subscribersOnly: 'Bu mod abonelere acik.',
        dailyLimit: 'Gunluk limit doldu.',
        authRequired: 'Rush turu icin giris yapman gerekiyor.',
        emptyQuestions: 'Bu tur icin soru bulunamadi.',
        movieFallback: 'Poster hazirlaniyor',
        yearUnknown: 'Yil yok'
    },
    en: {
        sectionTitle: 'Quiz',
        sectionSubtitle: 'A calmer, sharper film quiz area that belongs to the web experience.',
        discoverTab: 'Film Quiz',
        rushTab: 'Rush',
        blurTab: 'Blur',
        discoverTitle: 'Film Quiz',
        discoverMeta: 'A short question set from the selected film',
        rushTitle: 'Quiz Rush',
        rushMeta: 'A clean timed run',
        blurTitle: 'Blur Quiz',
        blurMeta: 'Guess the film from a blurred poster',
        blurDesc: 'The poster starts blurred and clears over time. You have 4 hint jokers; each one lowers possible XP.',
        blurStart: 'Start blur',
        blurSubmit: 'Submit guess',
        blurGuessPlaceholder: 'Type the film title',
        blurHints: 'Hints',
        blurPotentialXp: 'possible XP',
        blurTimeLeft: 'Time left',
        blurStep: 'Clarity',
        blurCorrectTitle: 'Correct guess',
        blurWrongTitle: 'Not this round',
        blurRetryNotice: 'You are close. Check the spelling and try again.',
        blurTimeUp: 'Time up',
        jokerLabel: 'Jokers',
        jokerFifty: '50/50',
        jokerPass: 'Pass',
        jokerFreeze: '+7s',
        jokerDirector: 'Director',
        jokerYear: 'Year',
        jokerCast: 'Cast',
        jokerGenre: 'Genre',
        jokerFailed: 'Could not use joker.',
        eliminated: 'Eliminated',
        loading: 'Loading',
        retry: 'Retry',
        noMovies: 'No movies found for quiz.',
        movieLoadFailed: 'Could not load movies.',
        questionLoadFailed: 'Could not open questions for this film.',
        answerFailed: 'Could not save the answer. Please try again.',
        startQuiz: 'Start quiz',
        skipMovie: 'Skip film',
        nextQuestion: 'Next question',
        finishQuiz: 'See result',
        nextMovie: 'Next film',
        playAgain: 'Play again',
        close: 'Close',
        question: 'Question',
        score: 'Score',
        correct: 'Correct',
        wrong: 'Wrong',
        result: 'Result',
        xp: 'XP',
        quickMode: 'Quick 15',
        quickMeta: '15 questions / 90s',
        marathonMode: 'Marathon 30',
        marathonMeta: '30 questions / 150s',
        startRush: 'Start run',
        rushStartFailed: 'Could not start the rush run.',
        rushAnswerFailed: 'Could not submit the answer.',
        rushTimeUp: 'Time is up',
        subscribersOnly: 'This mode is for subscribers.',
        dailyLimit: 'Daily limit reached.',
        authRequired: 'You need to sign in to start a rush run.',
        emptyQuestions: 'No questions found for this run.',
        movieFallback: 'Poster loading',
        yearUnknown: 'Year unknown'
    },
    es: {
        sectionTitle: 'Quiz',
        sectionSubtitle: 'Un area de quiz mas clara y propia de la experiencia web.',
        discoverTab: 'Film Quiz',
        rushTab: 'Rush',
        blurTab: 'Blur',
        discoverTitle: 'Film Quiz',
        discoverMeta: 'Una ronda breve sobre la pelicula elegida',
        rushTitle: 'Quiz Rush',
        rushMeta: 'Una ronda limpia contra reloj',
        blurTitle: 'Blur Quiz',
        blurMeta: 'Adivina la pelicula desde un poster borroso',
        blurDesc: 'El poster empieza borroso y se aclara con el tiempo. Tienes 4 comodines de pista; cada uno baja el XP posible.',
        blurStart: 'Empezar blur',
        blurSubmit: 'Enviar respuesta',
        blurGuessPlaceholder: 'Escribe el titulo',
        blurHints: 'Pistas',
        blurPotentialXp: 'XP posible',
        blurTimeLeft: 'Tiempo',
        blurStep: 'Claridad',
        blurCorrectTitle: 'Respuesta correcta',
        blurWrongTitle: 'No fue esta ronda',
        blurRetryNotice: 'Estas cerca. Revisa la escritura e intenta otra vez.',
        blurTimeUp: 'Tiempo agotado',
        jokerLabel: 'Comodines',
        jokerFifty: '50/50',
        jokerPass: 'Pasar',
        jokerFreeze: '+7s',
        jokerDirector: 'Director',
        jokerYear: 'Ano',
        jokerCast: 'Reparto',
        jokerGenre: 'Genero',
        jokerFailed: 'No se pudo usar el comodin.',
        eliminated: 'Eliminada',
        loading: 'Cargando',
        retry: 'Reintentar',
        noMovies: 'No se encontraron peliculas para el quiz.',
        movieLoadFailed: 'No se pudieron cargar las peliculas.',
        questionLoadFailed: 'No se pudieron abrir las preguntas.',
        answerFailed: 'No se pudo guardar la respuesta. Intentalo de nuevo.',
        startQuiz: 'Empezar quiz',
        skipMovie: 'Saltar pelicula',
        nextQuestion: 'Siguiente pregunta',
        finishQuiz: 'Ver resultado',
        nextMovie: 'Otra pelicula',
        playAgain: 'Jugar de nuevo',
        close: 'Cerrar',
        question: 'Pregunta',
        score: 'Puntuacion',
        correct: 'Correcto',
        wrong: 'Incorrecto',
        result: 'Resultado',
        xp: 'XP',
        quickMode: 'Quick 15',
        quickMeta: '15 preguntas / 90s',
        marathonMode: 'Marathon 30',
        marathonMeta: '30 preguntas / 150s',
        startRush: 'Empezar ronda',
        rushStartFailed: 'No se pudo empezar la ronda.',
        rushAnswerFailed: 'No se pudo enviar la respuesta.',
        rushTimeUp: 'Tiempo agotado',
        subscribersOnly: 'Este modo es para suscriptores.',
        dailyLimit: 'Limite diario alcanzado.',
        authRequired: 'Debes iniciar sesion para empezar una ronda rush.',
        emptyQuestions: 'No hay preguntas para esta ronda.',
        movieFallback: 'Poster cargando',
        yearUnknown: 'Ano desconocido'
    },
    fr: {
        sectionTitle: 'Quiz',
        sectionSubtitle: 'Un espace quiz plus net et coherent avec le web.',
        discoverTab: 'Film Quiz',
        rushTab: 'Rush',
        blurTab: 'Blur',
        discoverTitle: 'Film Quiz',
        discoverMeta: 'Une courte serie sur le film selectionne',
        rushTitle: 'Quiz Rush',
        rushMeta: 'Une manche propre contre la montre',
        blurTitle: 'Blur Quiz',
        blurMeta: 'Devinez le film depuis une affiche floue',
        blurDesc: 'L affiche commence floue puis devient nette. Vous avez 4 jokers indice; chacun baisse le XP possible.',
        blurStart: 'Lancer blur',
        blurSubmit: 'Valider',
        blurGuessPlaceholder: 'Saisir le titre',
        blurHints: 'Indices',
        blurPotentialXp: 'XP possible',
        blurTimeLeft: 'Temps',
        blurStep: 'Nettete',
        blurCorrectTitle: 'Bonne reponse',
        blurWrongTitle: 'Pas cette manche',
        blurRetryNotice: 'Vous etes proche. Verifiez le titre et reessayez.',
        blurTimeUp: 'Temps ecoule',
        jokerLabel: 'Jokers',
        jokerFifty: '50/50',
        jokerPass: 'Passer',
        jokerFreeze: '+7s',
        jokerDirector: 'Realisateur',
        jokerYear: 'Annee',
        jokerCast: 'Casting',
        jokerGenre: 'Genre',
        jokerFailed: 'Impossible utiliser le joker.',
        eliminated: 'Elimine',
        loading: 'Chargement',
        retry: 'Reessayer',
        noMovies: 'Aucun film trouve pour le quiz.',
        movieLoadFailed: 'Impossible de charger les films.',
        questionLoadFailed: 'Impossible ouvrir les questions.',
        answerFailed: 'Impossible enregistrer la reponse. Reessayez.',
        startQuiz: 'Lancer le quiz',
        skipMovie: 'Passer le film',
        nextQuestion: 'Question suivante',
        finishQuiz: 'Voir le resultat',
        nextMovie: 'Film suivant',
        playAgain: 'Rejouer',
        close: 'Fermer',
        question: 'Question',
        score: 'Score',
        correct: 'Correct',
        wrong: 'Incorrect',
        result: 'Resultat',
        xp: 'XP',
        quickMode: 'Quick 15',
        quickMeta: '15 questions / 90s',
        marathonMode: 'Marathon 30',
        marathonMeta: '30 questions / 150s',
        startRush: 'Lancer la manche',
        rushStartFailed: 'Impossible de lancer la manche.',
        rushAnswerFailed: 'Impossible envoyer la reponse.',
        rushTimeUp: 'Temps ecoule',
        subscribersOnly: 'Ce mode est reserve aux abonnes.',
        dailyLimit: 'Limite quotidienne atteinte.',
        authRequired: 'Vous devez vous connecter pour lancer une manche rush.',
        emptyQuestions: 'Aucune question pour cette manche.',
        movieFallback: 'Affiche en chargement',
        yearUnknown: 'Annee inconnue'
    }
};

const isPoolLanguageCode = (value: string): value is PoolLanguageCode =>
    value === 'tr' || value === 'en' || value === 'es' || value === 'fr';

const isPoolOptionKey = (value: unknown): value is PoolOptionKey =>
    value === 'a' || value === 'b' || value === 'c' || value === 'd';

const asPoolLanguage = (value: unknown): PoolLanguageCode =>
    typeof value === 'string' && isPoolLanguageCode(value) ? value : 'en';

const toFiniteNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeOptions = (options: unknown): Array<{ key: PoolOptionKey; label: string }> => {
    if (!Array.isArray(options)) return [];
    return options
        .map((option) => {
            const item = option as { key?: unknown; label?: unknown };
            if (!isPoolOptionKey(item.key)) return null;
            const label = String(item.label ?? '').trim();
            if (!label) return null;
            return { key: item.key, label };
        })
        .filter((option): option is { key: PoolOptionKey; label: string } => Boolean(option));
};

const normalizePoolMovie = (movie: PoolMovie): PoolMovie => {
    const releaseYear = toFiniteNumber(movie.release_year);
    const voteAverage = toFiniteNumber(movie.vote_average);
    const questionCount = toFiniteNumber(movie.question_count);
    const rawGenres = movie.genres as unknown;
    const genres = Array.isArray(rawGenres)
        ? rawGenres.map((genre) => String(genre).trim()).filter(Boolean)
        : typeof rawGenres === 'string'
          ? [rawGenres.trim()].filter(Boolean)
          : [];

    return {
        id: String(movie.id ?? ''),
        tmdb_id: toFiniteNumber(movie.tmdb_id) ?? 0,
        title: String(movie.title ?? '').trim(),
        poster_path: typeof movie.poster_path === 'string' && movie.poster_path.trim() ? movie.poster_path : null,
        genres,
        release_year: releaseYear,
        vote_average: voteAverage,
        question_count: questionCount ?? 0
    };
};

const normalizePoolQuestion = (question: PoolQuestion): PoolQuestion => ({
    id: String(question.id ?? ''),
    question: String(question.question ?? '').trim(),
    options: normalizeOptions(question.options)
});

const normalizeRushQuestion = (question: RushSessionQuestion): RushSessionQuestion => ({
    id: String(question.id ?? ''),
    question_id: String(question.question_id ?? question.id ?? ''),
    movie_title: String(question.movie_title ?? '').trim(),
    movie_poster_path:
        typeof question.movie_poster_path === 'string' && question.movie_poster_path.trim()
            ? question.movie_poster_path
            : null,
    question: String(question.question ?? '').trim(),
    options: normalizeOptions(question.options)
});

const normalizeRushSession = (session: RushSession): RushSession => ({
    id: String(session.id ?? ''),
    mode: session.mode,
    expires_at: typeof session.expires_at === 'string' ? session.expires_at : null,
    questions: Array.isArray(session.questions)
        ? session.questions
              .map(normalizeRushQuestion)
              .filter((question) => Boolean(question.id && question.question && question.options.length))
        : []
});

const formatMovieYear = (movie: PoolMovie, copy: QuizCopy): string =>
    movie.release_year ? String(movie.release_year) : copy.yearUnknown;

type TmdbImageSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500';

const getPosterUrl = (posterPath: string | null, size: TmdbImageSize = 'w342'): string | null =>
    posterPath ? `${TMDB_IMAGE_BASE}/${size}${posterPath}` : null;

const prefetchPoster = (posterPath: string | null, size: TmdbImageSize = 'w185') => {
    if (!posterPath || typeof window === 'undefined') return;
    const url = getPosterUrl(posterPath, size);
    if (!url) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
};

const toPercent = (value: number, total: number): number =>
    total > 0 ? Math.round((value / total) * 100) : 0;

const formatSeconds = (seconds: number): string => {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const extendRushExpiresAt = (expiresAt: string | null, bonusSeconds: number): string | null => {
    if (!expiresAt || bonusSeconds <= 0) return expiresAt;
    const expiresMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresMs)) return expiresAt;
    return new Date(expiresMs + bonusSeconds * 1000).toISOString();
};

const normalizeBlurHints = (hints: BlurQuizHints | undefined): BlurQuizHints => {
    const releaseYear = toFiniteNumber(hints?.release_year);
    const cast = Array.isArray(hints?.cast) ? hints.cast : [];
    return {
        director: String(hints?.director ?? '').trim(),
        release_year: releaseYear,
        cast: cast.map((member) => String(member).trim()).filter(Boolean),
        genre: String(hints?.genre ?? '').trim()
    };
};

const PlayIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </svg>
);

const SkipIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M5 7l5 5-5 5M13 7l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CloseIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const CheckIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const XIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const ClockIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7.5v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SparkIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 3l1.6 5.1L19 10l-5.4 1.9L12 17l-1.6-5.1L5 10l5.4-1.9L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
);

const FreezeIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 3v18M5.6 6.2l12.8 11.6M18.4 6.2L5.6 17.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8.5 4.8L12 8.2l3.5-3.4M8.5 19.2l3.5-3.4 3.5 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const EyeIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M3.5 12s3-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S3.5 12 3.5 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
);

const QuizMark = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-sage" aria-hidden="true">
        <path d="M5 5.5h14v13H5v-13Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 9h8M8 12h5M8 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16.5 15.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

function StatusNote({ tone = 'neutral', children }: { tone?: 'neutral' | 'error' | 'success'; children: string }) {
    const toneClass =
        tone === 'error'
            ? 'border-red-400/25 bg-red-500/10 text-red-200/80'
            : tone === 'success'
              ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100/80'
              : 'border-white/[0.08] bg-white/[0.04] text-[#E5E4E2]/45';

    return (
        <div className={`rounded-xl border px-4 py-3 text-[11px] leading-relaxed ${toneClass}`}>
            {children}
        </div>
    );
}

function ActionButton({
    children,
    icon,
    tone = 'primary',
    disabled = false,
    onClick
}: {
    children: string;
    icon?: ReactNode;
    tone?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    onClick: () => void;
}) {
    const toneClass =
        tone === 'primary'
            ? 'border-sage/35 bg-sage/90 text-white hover:bg-sage'
            : tone === 'danger'
              ? 'border-red-300/25 bg-red-500/10 text-red-200 hover:bg-red-500/15'
              : 'border-white/[0.08] bg-white/[0.04] text-[#E5E4E2]/70 hover:bg-white/[0.08] hover:text-[#E5E4E2]';

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${toneClass}`}
        >
            {icon}
            <span>{children}</span>
        </button>
    );
}

function JokerButton({
    label,
    icon,
    disabled,
    onClick
}: {
    label: string;
    icon: ReactNode;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sage/20 bg-sage/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-sage transition-all hover:border-sage/40 hover:bg-sage/15 disabled:pointer-events-none disabled:border-white/[0.06] disabled:bg-white/[0.025] disabled:text-[#E5E4E2]/22"
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function JokerStrip({
    copy,
    children
}: {
    copy: QuizCopy;
    children: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#E5E4E2]/35">{copy.jokerLabel}</p>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}

function PosterFrame({
    title,
    posterPath,
    copy,
    priority = false
}: {
    title: string;
    posterPath: string | null;
    copy: QuizCopy;
    priority?: boolean;
}) {
    return (
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.08] bg-[#151515] shadow-[0_18px_36px_rgba(0,0,0,0.32)]">
            <PosterImage
                posterPath={posterPath}
                size="small"
                alt={title}
                priority={priority}
                className="h-full w-full object-cover opacity-[var(--poster-opacity)]"
                fallback={
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-5 text-center">
                        <div className="h-px w-10 bg-sage/45" />
                        <p className="font-serif text-xl leading-tight text-[#E5E4E2]/80">{title || copy.movieFallback}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-sage/60">{copy.movieFallback}</p>
                    </div>
                }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>
    );
}

function OptionButton({
    optionKey,
    label,
    result,
    disabled,
    onClick
}: {
    optionKey: PoolOptionKey;
    label: string;
    result: OptionResult;
    disabled: boolean;
    onClick: () => void;
}) {
    const stateClass =
        result === 'correct'
            ? 'border-emerald-300/55 bg-emerald-400/10 text-emerald-50'
            : result === 'wrong'
              ? 'border-red-300/55 bg-red-500/10 text-red-50'
              : result === 'reveal'
                ? 'border-sage/55 bg-sage/10 text-[#E5E4E2]'
                : 'border-white/[0.08] bg-white/[0.035] text-[#E5E4E2]/82 hover:border-sage/35 hover:bg-white/[0.06]';

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex min-h-[54px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200 active:scale-[0.99] disabled:cursor-default ${stateClass}`}
        >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/25 bg-black/10 text-xs font-black uppercase">
                {result === 'correct' || result === 'reveal' ? (
                    <CheckIcon className="h-4 w-4" />
                ) : result === 'wrong' ? (
                    <XIcon className="h-4 w-4" />
                ) : (
                    optionKey
                )}
            </span>
            <span className="min-w-0 leading-relaxed">{label}</span>
        </button>
    );
}

function ProgressRail({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                        index < current
                            ? 'bg-sage/75'
                            : index === current
                              ? 'bg-[#E5E4E2]/75'
                              : 'bg-white/[0.08]'
                    }`}
                />
            ))}
        </div>
    );
}

function ScorePair({ correct, wrong, copy }: { correct: number; wrong: number; copy: QuizCopy }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/5 px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.18em] text-emerald-100/45">{copy.correct}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-emerald-200">{correct}</p>
            </div>
            <div className="rounded-xl border border-red-300/15 bg-red-500/5 px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.18em] text-red-100/45">{copy.wrong}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-red-200">{wrong}</p>
            </div>
        </div>
    );
}

function ResultPanel({
    copy,
    title,
    total,
    correct,
    xp,
    onPrimary,
    primaryLabel,
    onSecondary,
    secondaryLabel
}: {
    copy: QuizCopy;
    title: string;
    total: number;
    correct: number;
    xp: number;
    onPrimary: () => void;
    primaryLabel: string;
    onSecondary?: () => void;
    secondaryLabel?: string;
}) {
    const pct = toPercent(correct, total);
    const wrong = Math.max(0, total - correct);

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sage">{copy.result}</p>
                    <h3 className="mt-2 font-serif text-3xl leading-tight text-[#E5E4E2]">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#E5E4E2]/45">
                        {copy.score}: {correct}/{total} - {pct}%
                    </p>
                </div>
                <div className="grid min-w-[260px] grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-center">
                        <p className="text-2xl font-black tabular-nums text-emerald-200">{correct}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#E5E4E2]/35">{copy.correct}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-center">
                        <p className="text-2xl font-black tabular-nums text-red-200">{wrong}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#E5E4E2]/35">{copy.wrong}</p>
                    </div>
                    <div className="rounded-xl border border-sage/20 bg-sage/10 px-3 py-3 text-center">
                        <p className="text-2xl font-black tabular-nums text-sage">+{xp}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#E5E4E2]/35">{copy.xp}</p>
                    </div>
                </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <ActionButton onClick={onPrimary} icon={<PlayIcon />} tone="primary">
                    {primaryLabel}
                </ActionButton>
                {onSecondary && secondaryLabel ? (
                    <ActionButton onClick={onSecondary} icon={<SkipIcon />} tone="secondary">
                        {secondaryLabel}
                    </ActionButton>
                ) : null}
            </div>
        </div>
    );
}

type AnswerRecord = {
    selected: PoolOptionKey;
    isCorrect: boolean;
    correctKey: PoolOptionKey;
    explanation: string;
    xp: number;
};

type PoolJokerKey = 'fifty_fifty';

type DiscoverQuiz =
    | { phase: 'deck' }
    | { phase: 'loading' }
    | {
          phase: 'active';
          movie: PoolMovie;
          title: string;
          movieId: string;
          questions: PoolQuestion[];
          current: number;
          answers: Record<string, AnswerRecord>;
          usedJokers: Set<PoolJokerKey>;
          hiddenOptions: Record<string, PoolOptionKey[]>;
          submitting: boolean;
          error: string | null;
      }
    | { phase: 'result'; movie: PoolMovie; title: string; total: number; correct: number; xp: number }
    | { phase: 'error'; message: string };

function DiscoverQuizPanel({ copy, language }: { copy: QuizCopy; language: PoolLanguageCode }) {
    const [movies, setMovies] = useState<PoolMovie[]>([]);
    const [movieIndex, setMovieIndex] = useState(0);
    const [loadingMovies, setLoadingMovies] = useState(true);
    const [movieError, setMovieError] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<DiscoverQuiz>({ phase: 'deck' });

    const currentMovie = movies[movieIndex] ?? null;

    const loadMovies = useCallback(async () => {
        setLoadingMovies(true);
        setMovieError(null);
        const result = await fetchPoolMovies({ language, limit: 18 });
        if (result.ok) {
            setMovies(
                result.movies
                    .map(normalizePoolMovie)
                    .filter((movie) => Boolean(movie.id && movie.title))
            );
            setMovieIndex(0);
            setQuiz({ phase: 'deck' });
        } else {
            setMovies([]);
            setMovieError(copy.movieLoadFailed);
        }
        setLoadingMovies(false);
    }, [copy.movieLoadFailed, language]);

    useEffect(() => {
        void loadMovies();
    }, [loadMovies]);

    useEffect(() => {
        movies.slice(movieIndex, movieIndex + 4).forEach((movie, index) => {
            prefetchPoster(movie.poster_path, index === 0 ? 'w342' : 'w185');
        });
    }, [movieIndex, movies]);

    const moveToNextMovie = useCallback(() => {
        setQuiz({ phase: 'deck' });
        setMovieIndex((value) => {
            if (value + 1 < movies.length) return value + 1;
            void loadMovies();
            return value;
        });
    }, [loadMovies, movies.length]);

    const handleSkip = useCallback(() => {
        if (!currentMovie) return;
        void submitPoolSwipe(currentMovie.id, 'left');
        moveToNextMovie();
    }, [currentMovie, moveToNextMovie]);

    const handleStart = useCallback(async () => {
        if (!currentMovie) return;
        void submitPoolSwipe(currentMovie.id, 'right');
        setQuiz({ phase: 'loading' });
        const result = await fetchPoolQuiz(currentMovie.id, language);
        if (!result.ok) {
            setQuiz({ phase: 'error', message: copy.questionLoadFailed });
            return;
        }
        const questions = result.questions
            .map(normalizePoolQuestion)
            .filter((question) => Boolean(question.id && question.question && question.options.length));
        if (questions.length === 0) {
            setQuiz({ phase: 'error', message: copy.emptyQuestions });
            return;
        }
        setQuiz({
            phase: 'active',
            movie: currentMovie,
            title: result.title || currentMovie.title,
            movieId: result.movie_id || currentMovie.id,
            questions,
            current: 0,
            answers: {},
            usedJokers: new Set(),
            hiddenOptions: {},
            submitting: false,
            error: null
        });
    }, [copy.emptyQuestions, copy.questionLoadFailed, currentMovie, language]);

    const handleAnswer = useCallback(async (question: PoolQuestion, selected: PoolOptionKey) => {
        if (quiz.phase !== 'active' || quiz.submitting || quiz.answers[question.id]) return;
        setQuiz((prev) => (prev.phase === 'active' ? { ...prev, submitting: true, error: null } : prev));

        const result = await submitPoolAnswer({
            movie_id: quiz.movieId,
            question_id: question.id,
            selected_option: selected,
            language
        });

        if (!result.ok) {
            setQuiz((prev) => (prev.phase === 'active' ? { ...prev, submitting: false, error: copy.answerFailed } : prev));
            return;
        }

        setQuiz((prev) => {
            if (prev.phase !== 'active') return prev;
            return {
                ...prev,
                submitting: false,
                error: null,
                answers: {
                    ...prev.answers,
                    [question.id]: {
                        selected,
                        isCorrect: result.is_correct,
                        correctKey: result.correct_option,
                        explanation: result.explanation,
                        xp: result.xp_earned + result.bonus_xp
                    }
                }
            };
        });
    }, [copy.answerFailed, language, quiz]);

    const handlePoolJoker = useCallback(async (question: PoolQuestion) => {
        if (quiz.phase !== 'active' || quiz.submitting || quiz.answers[question.id] || quiz.usedJokers.has('fifty_fifty')) return;
        setQuiz((prev) => (prev.phase === 'active' ? { ...prev, submitting: true, error: null } : prev));

        const result = await requestPoolFiftyFifty({ question_id: question.id, source: 'wallet' });
        if (!result.ok || result.removed_options.length === 0) {
            setQuiz((prev) => (prev.phase === 'active' ? { ...prev, submitting: false, error: copy.jokerFailed } : prev));
            return;
        }

        setQuiz((prev) => {
            if (prev.phase !== 'active') return prev;
            const usedJokers = new Set(prev.usedJokers);
            usedJokers.add('fifty_fifty');
            return {
                ...prev,
                submitting: false,
                error: null,
                usedJokers,
                hiddenOptions: {
                    ...prev.hiddenOptions,
                    [question.id]: result.removed_options
                }
            };
        });
    }, [copy.jokerFailed, quiz]);

    const finishDiscoverQuiz = useCallback(() => {
        if (quiz.phase !== 'active') return;
        const records = Object.values(quiz.answers);
        const correct = records.filter((answer) => answer.isCorrect).length;
        const xp = records.reduce((total, answer) => total + answer.xp, 0);
        setQuiz({
            phase: 'result',
            movie: quiz.movie,
            title: quiz.title,
            total: quiz.questions.length,
            correct,
            xp
        });
    }, [quiz]);

    if (quiz.phase === 'result') {
        return (
            <ResultPanel
                copy={copy}
                title={quiz.title}
                total={quiz.total}
                correct={quiz.correct}
                xp={quiz.xp}
                primaryLabel={copy.nextMovie}
                onPrimary={moveToNextMovie}
                secondaryLabel={copy.playAgain}
                onSecondary={() => {
                    setMovieIndex((value) => value);
                    setQuiz({ phase: 'deck' });
                }}
            />
        );
    }

    if (quiz.phase === 'loading') {
        return (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 p-12 text-center">
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#E5E4E2]/35">{copy.loading}</span>
            </div>
        );
    }

    if (quiz.phase === 'error') {
        return (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 p-6">
                <StatusNote tone="error">{quiz.message}</StatusNote>
                <div className="mt-4 flex gap-2">
                    <ActionButton onClick={() => setQuiz({ phase: 'deck' })} tone="secondary" icon={<CloseIcon />}>
                        {copy.close}
                    </ActionButton>
                    <ActionButton onClick={() => void handleStart()} tone="primary" icon={<PlayIcon />}>
                        {copy.retry}
                    </ActionButton>
                </div>
            </div>
        );
    }

    if (quiz.phase === 'active') {
        const question = quiz.questions[quiz.current];
        const answer = question ? quiz.answers[question.id] : undefined;
        const hiddenOptionKeys = question && !answer ? quiz.hiddenOptions[question.id] || [] : [];
        const visibleOptions = question
            ? question.options.filter((option) => !hiddenOptionKeys.includes(option.key) || Boolean(answer))
            : [];
        const correctSoFar = Object.values(quiz.answers).filter((record) => record.isCorrect).length;
        const wrongSoFar = Object.values(quiz.answers).filter((record) => !record.isCorrect).length;

        if (!question) {
            return (
                <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 p-6">
                    <StatusNote tone="error">{copy.emptyQuestions}</StatusNote>
                    <div className="mt-4">
                        <ActionButton onClick={() => setQuiz({ phase: 'deck' })} tone="secondary" icon={<CloseIcon />}>
                            {copy.close}
                        </ActionButton>
                    </div>
                </div>
            );
        }

        return (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sage">
                                {copy.question} {quiz.current + 1}/{quiz.questions.length}
                            </p>
                            <h3 className="mt-1 truncate font-serif text-xl text-[#E5E4E2]">{quiz.title}</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setQuiz({ phase: 'deck' })}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#E5E4E2]/45 transition-colors hover:text-[#E5E4E2]"
                            aria-label={copy.close}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                    <div className="mt-4">
                        <ProgressRail current={quiz.current} total={quiz.questions.length} />
                    </div>
                </div>

                <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="hidden lg:block">
                        <PosterFrame title={quiz.title} posterPath={quiz.movie.poster_path} copy={copy} priority />
                    </div>
                    <div className="min-w-0">
                        {quiz.error ? <StatusNote tone="error">{quiz.error}</StatusNote> : null}
                        <p className="mt-0 text-lg font-semibold leading-relaxed text-[#E5E4E2]">{question.question}</p>
                        <div className="mt-4">
                            <JokerStrip copy={copy}>
                                <JokerButton
                                    label={copy.jokerFifty}
                                    icon={<SparkIcon className="h-3.5 w-3.5" />}
                                    disabled={quiz.submitting || Boolean(answer) || quiz.usedJokers.has('fifty_fifty')}
                                    onClick={() => void handlePoolJoker(question)}
                                />
                            </JokerStrip>
                        </div>
                        {hiddenOptionKeys.length ? (
                            <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-sage/65">
                                {hiddenOptionKeys.length} {copy.eliminated}
                            </p>
                        ) : null}
                        <div className="mt-5 grid gap-2">
                            {visibleOptions.map((option) => {
                                let result: OptionResult = null;
                                if (answer) {
                                    if (option.key === answer.selected && answer.isCorrect) result = 'correct';
                                    else if (option.key === answer.selected && !answer.isCorrect) result = 'wrong';
                                    else if (option.key === answer.correctKey && !answer.isCorrect) result = 'reveal';
                                }

                                return (
                                    <OptionButton
                                        key={option.key}
                                        optionKey={option.key}
                                        label={option.label}
                                        result={result}
                                        disabled={quiz.submitting || Boolean(answer)}
                                        onClick={() => void handleAnswer(question, option.key)}
                                    />
                                );
                            })}
                        </div>

                        {answer?.explanation ? (
                            <div className="mt-4">
                                <StatusNote tone={answer.isCorrect ? 'success' : 'error'}>{answer.explanation}</StatusNote>
                            </div>
                        ) : null}

                        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <ScorePair correct={correctSoFar} wrong={wrongSoFar} copy={copy} />
                            {answer ? (
                                quiz.current < quiz.questions.length - 1 ? (
                                    <ActionButton
                                        onClick={() => setQuiz((prev) => (
                                            prev.phase === 'active' ? { ...prev, current: prev.current + 1, error: null } : prev
                                        ))}
                                        tone="primary"
                                        icon={<PlayIcon />}
                                    >
                                        {copy.nextQuestion}
                                    </ActionButton>
                                ) : (
                                    <ActionButton onClick={finishDiscoverQuiz} tone="primary" icon={<CheckIcon />}>
                                        {copy.finishQuiz}
                                    </ActionButton>
                                )
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="border-b border-white/[0.06] px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sage">{copy.discoverTitle}</p>
                <p className="mt-1 text-xs text-[#E5E4E2]/35">{copy.discoverMeta}</p>
            </div>

            {loadingMovies ? (
                <div className="p-10 text-center">
                    <span className="text-[11px] uppercase tracking-[0.22em] text-[#E5E4E2]/35">{copy.loading}</span>
                </div>
            ) : movieError ? (
                <div className="p-5">
                    <StatusNote tone="error">{movieError}</StatusNote>
                    <div className="mt-4">
                        <ActionButton onClick={() => void loadMovies()} tone="primary" icon={<PlayIcon />}>
                            {copy.retry}
                        </ActionButton>
                    </div>
                </div>
            ) : !currentMovie ? (
                <div className="p-5">
                    <StatusNote>{copy.noMovies}</StatusNote>
                    <div className="mt-4">
                        <ActionButton onClick={() => void loadMovies()} tone="primary" icon={<PlayIcon />}>
                            {copy.retry}
                        </ActionButton>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <PosterFrame title={currentMovie.title} posterPath={currentMovie.poster_path} copy={copy} priority />
                    <div className="flex min-w-0 flex-col justify-between gap-6">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#E5E4E2]/35">
                                <span>{formatMovieYear(currentMovie, copy)}</span>
                                {currentMovie.vote_average != null ? <span>{currentMovie.vote_average.toFixed(1)} / 10</span> : null}
                                <span>{currentMovie.question_count} {copy.question.toLowerCase()}</span>
                            </div>
                            <h3 className="mt-3 font-serif text-4xl leading-tight text-[#E5E4E2]">{currentMovie.title}</h3>
                            {currentMovie.genres.length ? (
                                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#E5E4E2]/45">
                                    {currentMovie.genres.slice(0, 3).join(' / ')}
                                </p>
                            ) : null}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <ActionButton onClick={() => void handleStart()} tone="primary" icon={<PlayIcon />}>
                                {copy.startQuiz}
                            </ActionButton>
                            <ActionButton onClick={handleSkip} tone="secondary" icon={<SkipIcon />}>
                                {copy.skipMovie}
                            </ActionButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

type RushPhase =
    | { phase: 'lobby'; error: string | null }
    | { phase: 'loading' }
    | {
          phase: 'playing';
          session: RushSession;
          current: number;
          correct: number;
          answered: number;
          submitting: boolean;
          usedJokers: Set<RushJokerKey>;
          hiddenOptions: Record<string, PoolOptionKey[]>;
          revealed: {
              selected: PoolOptionKey;
              isCorrect: boolean;
              correctKey: PoolOptionKey;
          } | null;
          error: string | null;
      }
    | { phase: 'result'; mode: RushMode; total: number; correct: number; xp: number };

function RushTimer({ expiresAt, onExpired }: { expiresAt: string | null; onExpired: () => void }) {
    const [remaining, setRemaining] = useState(() => {
        if (!expiresAt) return 0;
        return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
    });
    const expiredRef = useRef(false);

    useEffect(() => {
        if (!expiresAt) return;
        expiredRef.current = false;
        const id = window.setInterval(() => {
            const next = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
            setRemaining(next);
            if (next <= 0 && !expiredRef.current) {
                expiredRef.current = true;
                window.clearInterval(id);
                onExpired();
            }
        }, 250);

        return () => window.clearInterval(id);
    }, [expiresAt, onExpired]);

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const urgent = remaining <= 15;

    return (
        <div className={`inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 ${urgent ? 'text-red-200' : 'text-sage'}`}>
            <ClockIcon className="h-3.5 w-3.5" />
            <span className="font-mono text-xs font-black tabular-nums">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
        </div>
    );
}

function RushMovieThumb({ title, posterPath }: { title: string; posterPath: string | null }) {
    return (
        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <PosterImage
                posterPath={posterPath}
                size="small"
                alt={title}
                priority
                className="h-full w-full object-cover"
                fallback={
                    <div className="flex h-full w-full items-center justify-center text-sage/55">
                        <QuizMark />
                    </div>
                }
            />
        </div>
    );
}

function RushQuestionView({
    question,
    revealed,
    hiddenOptions,
    disabled,
    onAnswer
}: {
    question: RushSessionQuestion;
    revealed: { selected: PoolOptionKey; isCorrect: boolean; correctKey: PoolOptionKey } | null;
    hiddenOptions: PoolOptionKey[];
    disabled: boolean;
    onAnswer: (option: PoolOptionKey) => void;
}) {
    const visibleOptions = question.options.filter((option) => !hiddenOptions.includes(option.key) || Boolean(revealed));

    return (
        <div>
            <div className="flex items-center gap-3">
                <RushMovieThumb title={question.movie_title} posterPath={question.movie_poster_path} />
                <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-sage/80">{question.movie_title}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#E5E4E2]/32">Rush</p>
                </div>
            </div>
            <p className="mt-3 text-lg font-semibold leading-relaxed text-[#E5E4E2]">{question.question}</p>
            <div className="mt-5 grid gap-2">
                {visibleOptions.map((option) => {
                    let result: OptionResult = null;
                    if (revealed) {
                        if (option.key === revealed.selected && revealed.isCorrect) result = 'correct';
                        else if (option.key === revealed.selected && !revealed.isCorrect) result = 'wrong';
                        else if (option.key === revealed.correctKey && !revealed.isCorrect) result = 'reveal';
                    }

                    return (
                        <OptionButton
                            key={option.key}
                            optionKey={option.key}
                            label={option.label}
                            result={result}
                            disabled={disabled}
                            onClick={() => onAnswer(option.key)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function RushQuizPanel({ copy, language }: { copy: QuizCopy; language: PoolLanguageCode }) {
    const [rush, setRush] = useState<RushPhase>({ phase: 'lobby', error: null });
    const revealTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
        };
    }, []);

    const completeSession = useCallback(async (session: RushSession, fallbackAnswered: number, fallbackCorrect: number) => {
        const completed = await completeRushSession(session.id);
        setRush({
            phase: 'result',
            mode: session.mode,
            total: completed.ok ? completed.total_answered || fallbackAnswered : fallbackAnswered,
            correct: completed.ok ? completed.total_correct || fallbackCorrect : fallbackCorrect,
            xp: completed.ok ? completed.xp_earned : 0
        });
    }, []);

    const handleStart = useCallback(async (mode: RushMode) => {
        setRush({ phase: 'loading' });
        const result = await startRushSession(mode, language);
        if (!result.ok) {
            const message = result.auth_required
                ? copy.authRequired
                : result.requires_subscription
                  ? copy.subscribersOnly
                  : result.limit_reached
                    ? copy.dailyLimit
                    : result.error || copy.rushStartFailed;
            setRush({ phase: 'lobby', error: message });
            return;
        }
        const session = normalizeRushSession(result.session);
        if (session.questions.length === 0) {
            setRush({ phase: 'lobby', error: copy.emptyQuestions });
            return;
        }
        setRush({
            phase: 'playing',
            session,
            current: 0,
            correct: 0,
            answered: 0,
            submitting: false,
            usedJokers: new Set(),
            hiddenOptions: {},
            revealed: null,
            error: null
        });
    }, [copy.authRequired, copy.dailyLimit, copy.emptyQuestions, copy.rushStartFailed, copy.subscribersOnly, language]);

    useEffect(() => {
        if (rush.phase !== 'playing') return;
        rush.session.questions.slice(rush.current, rush.current + 6).forEach((question, index) => {
            prefetchPoster(question.movie_poster_path, index === 0 ? 'w154' : 'w92');
        });
    }, [rush]);

    const handleExpired = useCallback(() => {
        if (rush.phase !== 'playing') return;
        void completeSession(rush.session, rush.answered, rush.correct);
    }, [completeSession, rush]);

    const handleAnswer = useCallback(async (selected: PoolOptionKey) => {
        if (rush.phase !== 'playing' || rush.submitting || rush.revealed) return;
        const question = rush.session.questions[rush.current];
        if (!question) return;

        setRush((prev) => (prev.phase === 'playing' ? { ...prev, submitting: true, error: null } : prev));

        const result = await submitRushAnswer({
            session_id: rush.session.id,
            attempt_id: question.id,
            selected_option: selected
        });

        if (!result.ok) {
            if (result.expired) {
                void completeSession(rush.session, rush.answered, rush.correct);
                return;
            }
            setRush((prev) => (prev.phase === 'playing' ? { ...prev, submitting: false, error: copy.rushAnswerFailed } : prev));
            return;
        }

        const isCorrect = result.is_correct;
        const nextCorrect = rush.correct + (isCorrect ? 1 : 0);
        const nextAnswered = rush.answered + 1;
        const fallbackAnswerPauseSeconds = 1 + (isCorrect ? RUSH_CORRECT_TIME_BONUS_SECONDS : 0);
        const sessionWithBonus: RushSession = {
            ...rush.session,
            expires_at: result.expires_at || extendRushExpiresAt(rush.session.expires_at, fallbackAnswerPauseSeconds)
        };

        setRush((prev) => (prev.phase === 'playing'
            ? {
                  ...prev,
                  session: { ...prev.session, expires_at: sessionWithBonus.expires_at },
                  submitting: false,
                  revealed: { selected, isCorrect, correctKey: result.correct_option }
              }
            : prev
        ));

        if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = window.setTimeout(() => {
            const nextIndex = rush.current + 1;
            if (nextIndex >= rush.session.questions.length) {
                void completeSession(sessionWithBonus, nextAnswered, nextCorrect);
                return;
            }
            setRush((prev) => (prev.phase === 'playing'
                ? {
                      ...prev,
                      session: { ...prev.session, expires_at: sessionWithBonus.expires_at },
                      current: nextIndex,
                      correct: nextCorrect,
                      answered: nextAnswered,
                      submitting: false,
                      revealed: null,
                      error: null
                  }
                : prev
            ));
        }, 650);
    }, [completeSession, copy.rushAnswerFailed, rush]);

    const handleRushJoker = useCallback(async (key: RushJokerKey) => {
        if (rush.phase !== 'playing' || rush.submitting || rush.revealed) return;
        const question = rush.session.questions[rush.current];
        if (!question || rush.usedJokers.has(key)) return;

        setRush((prev) => (prev.phase === 'playing' ? { ...prev, submitting: true, error: null } : prev));
        const result = await requestRushJoker({
            session_id: rush.session.id,
            attempt_id: question.id,
            type: key,
            seconds: key === 'freeze' ? RUSH_FREEZE_SECONDS : undefined,
            source: 'wallet'
        });

        if (!result.ok) {
            setRush((prev) => (prev.phase === 'playing' ? { ...prev, submitting: false, error: copy.jokerFailed } : prev));
            return;
        }

        if (result.type === 'pass') {
            const nextIndex = rush.current + 1;
            if (nextIndex >= rush.session.questions.length) {
                void completeSession(rush.session, rush.answered, rush.correct);
                return;
            }
            setRush((prev) => {
                if (prev.phase !== 'playing') return prev;
                const usedJokers = new Set(prev.usedJokers);
                usedJokers.add('pass');
                return {
                    ...prev,
                    current: nextIndex,
                    submitting: false,
                    error: null,
                    usedJokers
                };
            });
            return;
        }

        if (result.type === 'freeze') {
            setRush((prev) => {
                if (prev.phase !== 'playing') return prev;
                const usedJokers = new Set(prev.usedJokers);
                usedJokers.add('freeze');
                return {
                    ...prev,
                    submitting: false,
                    error: null,
                    usedJokers,
                    session: {
                        ...prev.session,
                        expires_at: result.expires_at
                    }
                };
            });
            return;
        }

        if (result.removed_options.length === 0) {
            setRush((prev) => (prev.phase === 'playing' ? { ...prev, submitting: false, error: copy.jokerFailed } : prev));
            return;
        }

        setRush((prev) => {
            if (prev.phase !== 'playing') return prev;
            const usedJokers = new Set(prev.usedJokers);
            usedJokers.add('fifty_fifty');
            return {
                ...prev,
                submitting: false,
                error: null,
                usedJokers,
                hiddenOptions: {
                    ...prev.hiddenOptions,
                    [question.id]: result.removed_options
                }
            };
        });
    }, [completeSession, copy.jokerFailed, rush]);

    if (rush.phase === 'result') {
        return (
            <ResultPanel
                copy={copy}
                title={rush.mode === 'rush_30' ? copy.marathonMode : copy.quickMode}
                total={rush.total}
                correct={rush.correct}
                xp={rush.xp}
                primaryLabel={copy.playAgain}
                onPrimary={() => setRush({ phase: 'lobby', error: null })}
            />
        );
    }

    if (rush.phase === 'loading') {
        return (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 p-12 text-center">
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#E5E4E2]/35">{copy.loading}</span>
            </div>
        );
    }

    if (rush.phase === 'playing') {
        const question = rush.session.questions[rush.current];
        const hiddenOptionKeys = question && !rush.revealed ? rush.hiddenOptions[question.id] || [] : [];

        return (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sage">
                                {rush.session.mode === 'rush_30' ? copy.marathonMode : copy.quickMode}
                            </p>
                            <p className="mt-1 text-xs text-[#E5E4E2]/35">
                                {copy.question} {rush.current + 1}/{rush.session.questions.length}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <RushTimer expiresAt={rush.session.expires_at} onExpired={handleExpired} />
                            <button
                                type="button"
                                onClick={() => setRush({ phase: 'lobby', error: null })}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#E5E4E2]/45 transition-colors hover:text-[#E5E4E2]"
                                aria-label={copy.close}
                            >
                                <CloseIcon />
                            </button>
                        </div>
                    </div>
                    <div className="mt-4">
                        <ProgressRail current={rush.current} total={rush.session.questions.length} />
                    </div>
                </div>

                <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="min-w-0">
                        {rush.error ? <StatusNote tone="error">{rush.error}</StatusNote> : null}
                        {question ? (
                            <>
                                <RushQuestionView
                                    question={question}
                                    revealed={rush.revealed}
                                    hiddenOptions={hiddenOptionKeys}
                                    disabled={rush.submitting || Boolean(rush.revealed)}
                                    onAnswer={(option) => void handleAnswer(option)}
                                />
                                <div className="mt-4">
                                    <JokerStrip copy={copy}>
                                        <JokerButton
                                            label={copy.jokerFifty}
                                            icon={<SparkIcon className="h-3.5 w-3.5" />}
                                            disabled={rush.submitting || Boolean(rush.revealed) || rush.usedJokers.has('fifty_fifty')}
                                            onClick={() => void handleRushJoker('fifty_fifty')}
                                        />
                                        <JokerButton
                                            label={copy.jokerPass}
                                            icon={<SkipIcon className="h-3.5 w-3.5" />}
                                            disabled={rush.submitting || Boolean(rush.revealed) || rush.usedJokers.has('pass')}
                                            onClick={() => void handleRushJoker('pass')}
                                        />
                                        <JokerButton
                                            label={copy.jokerFreeze}
                                            icon={<FreezeIcon className="h-3.5 w-3.5" />}
                                            disabled={rush.submitting || Boolean(rush.revealed) || rush.usedJokers.has('freeze')}
                                            onClick={() => void handleRushJoker('freeze')}
                                        />
                                    </JokerStrip>
                                    {hiddenOptionKeys.length ? (
                                        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-sage/65">
                                            {hiddenOptionKeys.length} {copy.eliminated}
                                        </p>
                                    ) : null}
                                </div>
                            </>
                        ) : (
                            <StatusNote tone="error">{copy.emptyQuestions}</StatusNote>
                        )}
                    </div>
                    <div className="space-y-4">
                        <ScorePair correct={rush.correct} wrong={rush.answered - rush.correct} copy={copy} />
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-[#E5E4E2]/35">{copy.score}</p>
                            <p className="mt-1 text-3xl font-black tabular-nums text-[#E5E4E2]">
                                {rush.correct}/{Math.max(1, rush.answered)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="border-b border-white/[0.06] px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sage">{copy.rushTitle}</p>
                <p className="mt-1 text-xs text-[#E5E4E2]/35">{copy.rushMeta}</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {rush.error ? (
                    <div className="sm:col-span-2">
                        <StatusNote tone="error">{rush.error}</StatusNote>
                    </div>
                ) : null}
                <button
                    type="button"
                    onClick={() => void handleStart('rush_15')}
                    className="group rounded-xl border border-sage/25 bg-sage/10 p-5 text-left transition-all hover:border-sage/45 hover:bg-sage/15 active:scale-[0.99]"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-sage/30 bg-sage/10 text-sage">
                        <PlayIcon />
                    </span>
                    <span className="mt-4 block font-serif text-2xl text-[#E5E4E2]">{copy.quickMode}</span>
                    <span className="mt-1 block text-xs text-[#E5E4E2]/40">{copy.quickMeta}</span>
                    <span className="mt-5 inline-flex text-[10px] font-bold uppercase tracking-[0.18em] text-sage">
                        {copy.startRush}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => void handleStart('rush_30')}
                    className="group rounded-xl border border-clay/30 bg-clay/10 p-5 text-left transition-all hover:border-clay/50 hover:bg-clay/15 active:scale-[0.99]"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-clay/35 bg-clay/10 text-clay">
                        <ClockIcon />
                    </span>
                    <span className="mt-4 block font-serif text-2xl text-[#E5E4E2]">{copy.marathonMode}</span>
                    <span className="mt-1 block text-xs text-[#E5E4E2]/40">{copy.marathonMeta}</span>
                    <span className="mt-5 inline-flex text-[10px] font-bold uppercase tracking-[0.18em] text-clay">
                        {copy.startRush}
                    </span>
                </button>
            </div>
        </div>
    );
}

type BlurQuizPhase =
    | { phase: 'idle'; error: string | null }
    | { phase: 'loading' }
    | {
          phase: 'active';
          movieId: string;
          sessionId: string;
          posterPath: string | null;
          hints: BlurQuizHints;
          blurStep: number;
          elapsedMs: number;
          startedAt: number;
          guess: string;
          jokers: Set<BlurQuizJokerKey>;
          submitting: boolean;
          error: string | null;
          notice: string | null;
      }
    | { phase: 'result'; correct: boolean; title: string; guess: string; xp: number };

function BlurMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'accent' | 'danger' }) {
    const toneClass =
        tone === 'danger'
            ? 'border-red-300/20 bg-red-500/10 text-red-100'
            : tone === 'accent'
              ? 'border-sage/25 bg-sage/10 text-sage'
              : 'border-white/[0.08] bg-white/[0.04] text-[#E5E4E2]/70';

    return (
        <div className={`rounded-xl border px-3 py-2 text-center ${toneClass}`}>
            <p className="text-[9px] uppercase tracking-[0.18em] opacity-55">{label}</p>
            <p className="mt-1 font-mono text-sm font-black tabular-nums">{value}</p>
        </div>
    );
}

function BlurPosterReveal({ posterPath, blurStep, copy }: { posterPath: string | null; blurStep: number; copy: QuizCopy }) {
    const safeStep = Math.max(0, Math.min(BLUR_TOTAL_STEPS - 1, blurStep));
    const baseBlur = BLUR_PX[safeStep] ?? 0;
    const baseScale = BLUR_SCALE[safeStep] ?? 1;
    const revealCount = Math.min(BLUR_REVEAL_WINDOWS.length, safeStep + 1);

    return (
        <div className="relative mx-auto aspect-[2/3] w-full max-w-[260px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#151515] shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
            <PosterImage
                posterPath={posterPath}
                size="small"
                alt={copy.blurTitle}
                className="h-full w-full object-cover transition-[filter,transform] duration-700"
                style={{ filter: `blur(${baseBlur}px)`, transform: `scale(${baseScale})` }}
                fallback={
                    <div className="flex h-full w-full items-center justify-center px-5 text-center font-serif text-xl text-[#E5E4E2]/70">
                        {copy.movieFallback}
                    </div>
                }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />
            {posterPath
                ? BLUR_REVEAL_WINDOWS.slice(0, revealCount).map((windowRect, index) => (
                      <div
                          key={`${windowRect.left}-${windowRect.top}-${windowRect.width}-${windowRect.height}`}
                          className={`absolute rounded-lg border transition-opacity duration-700 ${
                              index === revealCount - 1 ? 'border-sage/40 bg-sage/10' : 'border-white/10 bg-white/[0.03]'
                          }`}
                          style={{
                              left: `${(windowRect.left / 200) * 100}%`,
                              top: `${(windowRect.top / 280) * 100}%`,
                              width: `${(windowRect.width / 200) * 100}%`,
                              height: `${(windowRect.height / 280) * 100}%`
                          }}
                      />
                  ))
                : null}
            <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/55 px-2 py-1 font-mono text-[10px] font-black text-[#E5E4E2]/70">
                {safeStep + 1}/{BLUR_TOTAL_STEPS}
            </div>
        </div>
    );
}

function BlurHintRow({ label, value }: { label: string; value: string }) {
    if (!value.trim()) return null;
    return (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#E5E4E2]/35">{label}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#E5E4E2]/78">{value}</p>
        </div>
    );
}

function BlurQuizPanel({ copy }: { copy: QuizCopy }) {
    const [blur, setBlur] = useState<BlurQuizPhase>({ phase: 'idle', error: null });
    const [seenIds, setSeenIds] = useState<string[]>([]);
    const activeRef = useRef<Extract<BlurQuizPhase, { phase: 'active' }> | null>(null);
    const submittingRef = useRef(false);

    useEffect(() => {
        activeRef.current = blur.phase === 'active' ? blur : null;
    }, [blur]);

    const startNextMovie = useCallback(async () => {
        submittingRef.current = false;
        setBlur({ phase: 'loading' });
        const result = await fetchBlurMovie({ excludeIds: seenIds });
        if (!result.ok) {
            setBlur({ phase: 'idle', error: copy.questionLoadFailed });
            return;
        }
        setSeenIds((prev) => [...prev, result.movie_id].slice(-20));
        setBlur({
            phase: 'active',
            movieId: result.movie_id,
            sessionId: result.session_id,
            posterPath: result.poster_path || null,
            hints: normalizeBlurHints(result.hints),
            blurStep: 0,
            elapsedMs: 0,
            startedAt: Date.now(),
            guess: '',
            jokers: new Set<BlurQuizJokerKey>(),
            submitting: false,
            error: null,
            notice: null
        });
    }, [copy.questionLoadFailed, seenIds]);

    const submitBlurGuess = useCallback(async (timeUp = false) => {
        if (submittingRef.current) return;
        const active = activeRef.current;
        if (!active) return;

        const resumeElapsedMs = active.elapsedMs;
        const guess = timeUp ? '' : active.guess.trim();
        submittingRef.current = true;
        setBlur((prev) => (prev.phase === 'active' ? { ...prev, submitting: true, error: null, notice: null } : prev));

        const result = await verifyBlurGuess({ session_id: active.sessionId, guess });
        submittingRef.current = false;

        if (!result.ok) {
            setBlur((prev) => (
                prev.phase === 'active'
                    ? {
                          ...prev,
                          submitting: false,
                          error: timeUp ? copy.blurTimeUp : copy.answerFailed,
                          startedAt: Date.now() - resumeElapsedMs
                      }
                    : prev
            ));
            return;
        }

        if ((result.needs_retry || result.needs_confirmation) && !timeUp) {
            setBlur((prev) => (
                prev.phase === 'active'
                    ? {
                          ...prev,
                          submitting: false,
                          notice: result.retry_reason || copy.blurRetryNotice,
                          startedAt: Date.now() - resumeElapsedMs
                      }
                    : prev
            ));
            return;
        }

        setBlur({
            phase: 'result',
            correct: result.correct,
            title: result.matched_title || result.suggested_title || guess,
            guess: guess || active.guess.trim(),
            xp: result.xp_earned
        });
    }, [copy.answerFailed, copy.blurRetryNotice, copy.blurTimeUp]);

    const isBlurActive = blur.phase === 'active';
    const isBlurSubmitting = isBlurActive ? blur.submitting : false;

    useEffect(() => {
        if (!isBlurActive || isBlurSubmitting) return;
        const id = window.setInterval(() => {
            setBlur((prev) => {
                if (prev.phase !== 'active' || prev.submitting) return prev;
                const elapsedMs = Math.min(BLUR_TOTAL_DURATION, Date.now() - prev.startedAt);
                const blurStep = Math.min(BLUR_TOTAL_STEPS - 1, Math.floor(elapsedMs / BLUR_STEP_DURATION));
                if (elapsedMs >= BLUR_TOTAL_DURATION && !submittingRef.current) {
                    window.setTimeout(() => void submitBlurGuess(true), 0);
                }
                return { ...prev, elapsedMs, blurStep };
            });
        }, 250);

        return () => window.clearInterval(id);
    }, [isBlurActive, isBlurSubmitting, submitBlurGuess]);

    const updateGuess = useCallback((value: string) => {
        setBlur((prev) => (prev.phase === 'active' ? { ...prev, guess: value, error: null, notice: null } : prev));
    }, []);

    const handleBlurJoker = useCallback(async (key: BlurQuizJokerKey) => {
        const active = activeRef.current;
        if (!active || active.submitting || active.jokers.has(key)) return;

        setBlur((prev) => (prev.phase === 'active' ? { ...prev, submitting: true, error: null, notice: null } : prev));
        const result = await requestBlurQuizJoker({ session_id: active.sessionId, joker_key: key });
        if (!result.ok) {
            setBlur((prev) => (prev.phase === 'active' ? { ...prev, submitting: false, error: copy.jokerFailed } : prev));
            return;
        }

        setBlur((prev) => {
            if (prev.phase !== 'active') return prev;
            const next = new Set<BlurQuizJokerKey>(result.used_jokers.length ? result.used_jokers : [...prev.jokers, key]);
            return {
                ...prev,
                submitting: false,
                jokers: next,
                error: null,
                notice: null,
                startedAt: Date.now() - prev.elapsedMs
            };
        });
    }, [copy.jokerFailed]);

    if (blur.phase === 'loading') {
        return (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 p-12 text-center">
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#E5E4E2]/35">{copy.loading}</span>
            </div>
        );
    }

    if (blur.phase === 'result') {
        return (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:p-6">
                <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${blur.correct ? 'text-emerald-200' : 'text-red-200'}`}>
                    {blur.correct ? copy.blurCorrectTitle : copy.blurWrongTitle}
                </p>
                <h3 className="mt-2 font-serif text-3xl leading-tight text-[#E5E4E2]">
                    {blur.correct && blur.title ? blur.title : copy.blurTimeUp}
                </h3>
                {blur.guess ? (
                    <p className="mt-3 text-sm leading-relaxed text-[#E5E4E2]/45">{blur.guess}</p>
                ) : null}
                <div className="mt-5 max-w-xs">
                    <BlurMetric label={copy.xp} value={`+${blur.xp}`} tone={blur.correct ? 'accent' : 'neutral'} />
                </div>
                <div className="mt-5">
                    <ActionButton onClick={() => void startNextMovie()} icon={<PlayIcon />} tone="primary">
                        {copy.playAgain}
                    </ActionButton>
                </div>
            </div>
        );
    }

    if (blur.phase === 'active') {
        const remainingSeconds = Math.max(0, (BLUR_TOTAL_DURATION - blur.elapsedMs) / 1000);
        const timeProgress = Math.max(0, 1 - blur.elapsedMs / BLUR_TOTAL_DURATION);
        const potentialXp = Math.max(10, (BLUR_XP_PER_STEP[blur.blurStep] ?? 10) - blur.jokers.size * 5);
        const hintValues = {
            director: blur.hints.director,
            year: blur.hints.release_year ? String(blur.hints.release_year) : '',
            cast: blur.hints.cast.slice(0, 3).join(' / '),
            genre: blur.hints.genre
        };

        return (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sage">{copy.blurTitle}</p>
                            <p className="mt-1 text-xs text-[#E5E4E2]/35">{copy.blurMeta}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setBlur({ phase: 'idle', error: null })}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#E5E4E2]/45 transition-colors hover:text-[#E5E4E2]"
                            aria-label={copy.close}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className={`h-full rounded-full ${timeProgress <= 0.2 ? 'bg-red-300' : timeProgress <= 0.45 ? 'bg-clay' : 'bg-sage'}`}
                            style={{ width: `${timeProgress * 100}%` }}
                        />
                    </div>
                </div>

                <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <BlurPosterReveal posterPath={blur.posterPath} blurStep={blur.blurStep} copy={copy} />
                    <div className="min-w-0 space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            <BlurMetric label={copy.blurTimeLeft} value={formatSeconds(remainingSeconds)} tone={timeProgress <= 0.2 ? 'danger' : 'neutral'} />
                            <BlurMetric label={copy.blurStep} value={`${blur.blurStep + 1}/${BLUR_TOTAL_STEPS}`} tone="accent" />
                            <BlurMetric label={copy.blurPotentialXp} value={String(potentialXp)} tone="accent" />
                        </div>

                        <JokerStrip copy={copy}>
                            <JokerButton
                                label={copy.jokerDirector}
                                icon={<EyeIcon className="h-3.5 w-3.5" />}
                                disabled={blur.submitting || blur.jokers.has('director')}
                                onClick={() => void handleBlurJoker('director')}
                            />
                            <JokerButton
                                label={copy.jokerYear}
                                icon={<ClockIcon className="h-3.5 w-3.5" />}
                                disabled={blur.submitting || blur.jokers.has('year')}
                                onClick={() => void handleBlurJoker('year')}
                            />
                            <JokerButton
                                label={copy.jokerCast}
                                icon={<SparkIcon className="h-3.5 w-3.5" />}
                                disabled={blur.submitting || blur.jokers.has('cast')}
                                onClick={() => void handleBlurJoker('cast')}
                            />
                            <JokerButton
                                label={copy.jokerGenre}
                                icon={<QuizMark />}
                                disabled={blur.submitting || blur.jokers.has('genre')}
                                onClick={() => void handleBlurJoker('genre')}
                            />
                        </JokerStrip>

                        {blur.jokers.size ? (
                            <div>
                                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#E5E4E2]/35">{copy.blurHints}</p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {blur.jokers.has('director') ? <BlurHintRow label={copy.jokerDirector} value={hintValues.director} /> : null}
                                    {blur.jokers.has('year') ? <BlurHintRow label={copy.jokerYear} value={hintValues.year} /> : null}
                                    {blur.jokers.has('cast') ? <BlurHintRow label={copy.jokerCast} value={hintValues.cast} /> : null}
                                    {blur.jokers.has('genre') ? <BlurHintRow label={copy.jokerGenre} value={hintValues.genre} /> : null}
                                </div>
                            </div>
                        ) : null}

                        {blur.error ? <StatusNote tone="error">{blur.error}</StatusNote> : null}
                        {blur.notice ? <StatusNote>{blur.notice}</StatusNote> : null}

                        <form
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void submitBlurGuess(false);
                            }}
                        >
                            <input
                                value={blur.guess}
                                onChange={(event) => updateGuess(event.target.value)}
                                placeholder={copy.blurGuessPlaceholder}
                                disabled={blur.submitting}
                                className="min-h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#E5E4E2] outline-none transition-colors placeholder:text-[#E5E4E2]/25 focus:border-sage/40"
                            />
                            <ActionButton onClick={() => void submitBlurGuess(false)} icon={<CheckIcon />} tone="primary" disabled={blur.submitting}>
                                {copy.blurSubmit}
                            </ActionButton>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f]/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="border-b border-white/[0.06] px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sage">{copy.blurTitle}</p>
                <p className="mt-1 text-xs text-[#E5E4E2]/35">{copy.blurMeta}</p>
            </div>
            <div className="grid gap-6 p-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035]">
                    <div className="absolute inset-7 rounded-xl border border-sage/20 bg-sage/10" />
                    <div className="absolute inset-0 flex items-center justify-center text-sage">
                        <EyeIcon className="h-12 w-12" />
                    </div>
                </div>
                <div>
                    {blur.error ? <StatusNote tone="error">{blur.error}</StatusNote> : null}
                    <h3 className="mt-3 font-serif text-3xl leading-tight text-[#E5E4E2]">{copy.blurTitle}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#E5E4E2]/45">{copy.blurDesc}</p>
                    <div className="mt-5 grid max-w-md grid-cols-3 gap-2">
                        <BlurMetric label={copy.blurStep} value={`${BLUR_TOTAL_STEPS}`} tone="accent" />
                        <BlurMetric label={copy.jokerLabel} value="4" tone="accent" />
                        <BlurMetric label={copy.xp} value="50" tone="accent" />
                    </div>
                    <div className="mt-5">
                        <ActionButton onClick={() => void startNextMovie()} icon={<PlayIcon />} tone="primary">
                            {copy.blurStart}
                        </ActionButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function QuizSection() {
    const { language: rawLanguage } = useLanguage();
    const language = asPoolLanguage(rawLanguage);
    const copy = COPY[language] || COPY.en;
    const [mode, setMode] = useState<QuizMode>('discover');

    const tabs = useMemo<Array<{ key: QuizMode; label: string }>>(
        () => [
            { key: 'discover', label: copy.discoverTab },
            { key: 'rush', label: copy.rushTab },
            { key: 'blur', label: copy.blurTab }
        ],
        [copy.blurTab, copy.discoverTab, copy.rushTab]
    );

    return (
        <section className="mx-auto mb-16 max-w-5xl px-4 sm:px-6">
            <div className="relative mb-8 flex flex-col items-center pt-2 text-center">
                <div className="mb-5 h-10 w-px bg-gradient-to-b from-transparent to-sage/30" />
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-sage/20 bg-sage/10 shadow-[0_0_24px_rgba(138,154,91,0.15)]">
                    <QuizMark />
                </div>
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.4em] text-sage">{copy.sectionTitle}</h2>
                <p className="max-w-xl text-[11px] uppercase tracking-[0.16em] text-[#E5E4E2]/30">{copy.sectionSubtitle}</p>
            </div>

            <div className="mb-4 flex justify-center">
                <div className="grid w-full max-w-xl grid-cols-3 gap-1 rounded-2xl border border-white/[0.07] bg-[#0d0d0d]/85 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
                    {tabs.map((tab) => {
                        const active = mode === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setMode(tab.key)}
                                className={`min-h-10 rounded-xl px-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
                                    active
                                        ? 'bg-sage/20 text-sage shadow-[0_0_18px_rgba(138,154,91,0.14)]'
                                        : 'text-[#E5E4E2]/35 hover:bg-white/[0.04] hover:text-[#E5E4E2]/65'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {mode === 'discover' ? (
                <DiscoverQuizPanel copy={copy} language={language} />
            ) : mode === 'rush' ? (
                <RushQuizPanel copy={copy} language={language} />
            ) : (
                <BlurQuizPanel copy={copy} />
            )}
        </section>
    );
}
