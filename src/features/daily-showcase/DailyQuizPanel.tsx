import React, { useEffect, useMemo, useState } from 'react';
import type { Movie } from '../../data/mockMovies';
import { useLanguage } from '../../context/LanguageContext';
import { useXP } from '../../context/XPContext';
import {
    readDailyQuizBundle,
    submitDailyQuizAnswer,
    type DailyQuizBundle,
    type DailyQuizLanguageCode,
    type DailyQuizOptionKey
} from '../../lib/dailyQuizApi';

type DailyQuizPanelProps = {
    movie: Movie;
    onStartComment: () => void;
};

type QuizCopy = {
    title: string;
    subtitle: string;
    loading: string;
    pending: string;
    error: string;
    noQuestions: string;
    progress: string;
    xp: string;
    correct: string;
    wrong: string;
    saving: string;
    unlockedHint: string;
    commentCta: string;
};

const QUIZ_COPY: Record<DailyQuizLanguageCode, QuizCopy> = {
    tr: {
        title: 'FILM QUIZ',
        subtitle: 'Yorumu acmak icin once sorulari coz',
        loading: 'Sorular yukleniyor...',
        pending: 'Bu film icin quiz henuz hazir degil.',
        error: 'Quiz verisi su an yuklenemiyor.',
        noQuestions: 'Bu film icin soru bulunamadi.',
        progress: 'Ilerleme',
        xp: 'XP',
        correct: 'Dogru',
        wrong: 'Yanlis',
        saving: 'Kaydediliyor...',
        unlockedHint: 'Yorum yazma alani acildi. Istersen kalan sorulari da cozmeye devam edebilirsin.',
        commentCta: 'Yorum Yaz'
    },
    en: {
        title: 'FILM QUIZ',
        subtitle: 'Answer the questions before opening comments',
        loading: 'Loading questions...',
        pending: 'The quiz for this film is not ready yet.',
        error: 'Quiz data is unavailable right now.',
        noQuestions: 'No questions are available for this film.',
        progress: 'Progress',
        xp: 'XP',
        correct: 'Correct',
        wrong: 'Wrong',
        saving: 'Saving...',
        unlockedHint: 'Comments are unlocked. You can still finish the remaining questions.',
        commentCta: 'Write Comment'
    },
    es: {
        title: 'QUIZ DE LA PELICULA',
        subtitle: 'Responde antes de abrir comentarios',
        loading: 'Cargando preguntas...',
        pending: 'El quiz de esta pelicula todavia no esta listo.',
        error: 'Los datos del quiz no estan disponibles ahora.',
        noQuestions: 'No hay preguntas para esta pelicula.',
        progress: 'Progreso',
        xp: 'XP',
        correct: 'Correcta',
        wrong: 'Incorrecta',
        saving: 'Guardando...',
        unlockedHint: 'Los comentarios ya estan desbloqueados. Puedes seguir con las preguntas restantes.',
        commentCta: 'Escribir comentario'
    },
    fr: {
        title: 'QUIZ DU FILM',
        subtitle: 'Reponds aux questions avant d ecrire un commentaire',
        loading: 'Chargement des questions...',
        pending: 'Le quiz de ce film n est pas encore pret.',
        error: 'Les donnees du quiz sont indisponibles pour le moment.',
        noQuestions: 'Aucune question disponible pour ce film.',
        progress: 'Progression',
        xp: 'XP',
        correct: 'Bonne reponse',
        wrong: 'Mauvaise reponse',
        saving: 'Enregistrement...',
        unlockedHint: 'Les commentaires sont debloques. Tu peux encore terminer les questions restantes.',
        commentCta: 'Ecrire un commentaire'
    }
};

const normalizeLanguage = (value: string): DailyQuizLanguageCode =>
    value === 'tr' || value === 'en' || value === 'es' || value === 'fr' ? value : 'en';

const getUnlockHint = (language: DailyQuizLanguageCode, requiredCorrectCount: number): string => {
    switch (language) {
        case 'tr':
            return `Yorumu acmak icin en az ${requiredCorrectCount} dogru cevap gerekli.`;
        case 'es':
            return `Necesitas al menos ${requiredCorrectCount} respuestas correctas para abrir comentarios.`;
        case 'fr':
            return `Il faut au moins ${requiredCorrectCount} bonnes reponses pour ouvrir les commentaires.`;
        case 'en':
        default:
            return `You need at least ${requiredCorrectCount} correct answers to unlock comments.`;
    }
};

const updateBundleAfterAnswer = (
    bundle: DailyQuizBundle,
    input: {
        questionId: string;
        selectedOption: DailyQuizOptionKey;
        isCorrect: boolean;
        explanation: string;
        progress: NonNullable<DailyQuizBundle['progress']>;
    }
): DailyQuizBundle => ({
    ...bundle,
    progress: input.progress,
    questionsByMovie: bundle.questionsByMovie.map((movieBlock) => ({
        ...movieBlock,
        questions: movieBlock.questions.map((question) =>
            question.id === input.questionId
                ? {
                      ...question,
                      attempt: {
                          selectedOption: input.selectedOption,
                          isCorrect: input.isCorrect,
                          answeredAt: new Date().toISOString(),
                          explanation: input.explanation
                      }
                  }
                : question
        )
    }))
});

export const DailyQuizPanel: React.FC<DailyQuizPanelProps> = ({ movie, onStartComment }) => {
    const { language } = useLanguage();
    const { applyQuizProgress } = useXP();
    const resolvedLanguage = normalizeLanguage(language);
    const copy = QUIZ_COPY[resolvedLanguage];
    const [bundle, setBundle] = useState<DailyQuizBundle | null>(null);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submittingQuestionId, setSubmittingQuestionId] = useState<string | null>(null);
    const [lastXpDelta, setLastXpDelta] = useState(0);

    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            setPending(false);
            setError(null);

            const result = await readDailyQuizBundle({
                language: resolvedLanguage
            });

            if (!active) return;

            if (!result.ok) {
                setBundle(null);
                if (result.status === 404) {
                    setPending(true);
                } else {
                    setError(result.error || copy.error);
                }
                setLoading(false);
                return;
            }

            setBundle(result);
            setLoading(false);
        };

        void load();

        return () => {
            active = false;
        };
    }, [copy.error, resolvedLanguage]);

    const movieBlock = useMemo(
        () => bundle?.questionsByMovie.find((entry) => entry.movieId === movie.id) || null,
        [bundle?.questionsByMovie, movie.id]
    );

    const answeredCount = movieBlock?.questions.filter((question) => question.attempt).length || 0;
    const correctCount = movieBlock?.questions.filter((question) => question.attempt?.isCorrect).length || 0;
    const requiredCorrectCount = movieBlock?.requiredCorrectCount || 0;
    const isUnlocked = requiredCorrectCount > 0 && correctCount >= requiredCorrectCount;
    const unlockHint = getUnlockHint(resolvedLanguage, requiredCorrectCount);

    const handleAnswer = async (questionId: string, selectedOption: DailyQuizOptionKey) => {
        if (!bundle || submittingQuestionId) return;
        setSubmittingQuestionId(questionId);
        setError(null);

        const result = await submitDailyQuizAnswer({
            dateKey: bundle.date,
            questionId,
            selectedOption,
            language: bundle.language
        });

        if (!result.ok) {
            setError(result.error || copy.error);
            setSubmittingQuestionId(null);
            return;
        }

        setLastXpDelta(result.xp.delta);
        applyQuizProgress({
            totalXP: result.xp.total,
            streak: result.xp.streak,
            dateKey: bundle.date,
            streakProtectedNow: result.xp.streakProtectedNow
        });
        setBundle((current) =>
            current
                ? updateBundleAfterAnswer(current, {
                      questionId: result.questionId,
                      selectedOption: result.selectedOption,
                      isCorrect: result.isCorrect,
                      explanation: result.explanation,
                      progress: result.progress
                  })
                : current
        );
        setSubmittingQuestionId(null);
    };

    return (
        <div className="mt-auto border-t border-white/5 pt-6 md:pt-8">
            <div className="mb-5 md:mb-7">
                <p className="text-[10px] font-bold tracking-[0.22em] text-[#8A9A5B] uppercase mb-2 opacity-80">
                    {copy.title}
                </p>
                <p className="max-w-2xl text-xs leading-6 text-[#E5E4E2]/65 md:text-sm md:leading-7">{copy.subtitle}</p>
            </div>

            {loading ? <p className="text-sm text-sage/75">{copy.loading}</p> : null}
            {!loading && pending ? <p className="text-sm text-clay/80">{copy.pending}</p> : null}
            {!loading && error ? <p className="text-sm text-red-300">{error}</p> : null}

            {!loading && !pending && !error && !movieBlock ? (
                <p className="text-sm text-clay/80">{copy.noQuestions}</p>
            ) : null}

            {!loading && movieBlock ? (
                <div className="space-y-4 md:space-y-6">
                    <div className="rounded-2xl border border-white/6 bg-[#0f0f0f] px-4 py-3 md:px-6 md:py-4">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.16em] text-clay/75 md:gap-x-6 md:gap-y-3">
                            <span>{copy.progress}: {answeredCount}/{movieBlock.questions.length}</span>
                            <span>{copy.correct}: {correctCount}/{requiredCorrectCount}</span>
                            <span>{copy.xp}: {bundle?.progress?.xpAwarded || 0}</span>
                            {lastXpDelta > 0 ? <span>+{lastXpDelta} XP</span> : null}
                        </div>
                    </div>

                    {movieBlock.questions.map((question) => {
                        const isSaving = submittingQuestionId === question.id;
                        const selectedOption = question.attempt?.selectedOption || null;
                        const isAnswered = Boolean(question.attempt);

                        return (
                            <div key={question.id} className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4 md:px-6 md:py-6">
                                <p className="mb-4 text-sm leading-6 text-[#F4F1E8] md:mb-5 md:text-[15px] md:leading-7">
                                    {question.question}
                                </p>
                                <div className="grid gap-2 md:gap-3">
                                    {question.options.map((option) => {
                                        const isSelected = selectedOption === option.key;
                                        const isCorrectSelection = isSelected && question.attempt?.isCorrect;
                                        const isWrongSelection = isSelected && question.attempt && !question.attempt.isCorrect;
                                        const toneClass = isCorrectSelection
                                            ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                                            : isWrongSelection
                                                ? 'border-red-400/40 bg-red-500/10 text-red-100'
                                                : 'border-white/8 bg-[#181818] text-[#E7E1D4] hover:border-sage/40 hover:bg-[#1d1d1d]';

                                        return (
                                            <button
                                                key={option.key}
                                                type="button"
                                                disabled={isAnswered || isSaving}
                                                onClick={() => void handleAnswer(question.id, option.key)}
                                                className={`rounded-2xl border px-3 py-3 text-left text-sm leading-6 transition-colors disabled:cursor-default disabled:opacity-90 md:px-4 md:py-4 md:text-[15px] ${toneClass}`}
                                            >
                                                <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-sage/75">
                                                    {option.key}
                                                </span>
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {isSaving ? (
                                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-sage/70">{copy.saving}</p>
                                ) : null}

                                {question.attempt ? (
                                    <div className="mt-4 rounded-xl border border-white/6 bg-black/20 px-3 py-3 text-sm text-[#DED7C8] md:px-4 md:py-4 md:text-[15px]">
                                        <p className="text-[10px] uppercase tracking-[0.16em] text-sage/70">
                                            {question.attempt.isCorrect ? copy.correct : copy.wrong}
                                        </p>
                                        <p className="mt-2 leading-6 md:leading-7">{question.attempt.explanation}</p>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}

                    <div className="rounded-2xl border border-white/6 bg-[#0f0f0f] px-4 py-4 md:px-6 md:py-5">
                        <p className="mb-4 text-sm leading-6 text-[#E5E4E2]/75 md:mb-5 md:text-[15px] md:leading-7">
                            {isUnlocked ? copy.unlockedHint : unlockHint}
                        </p>
                        <button
                            type="button"
                            disabled={!isUnlocked}
                            onClick={onStartComment}
                            className="w-full py-4 bg-[#8A9A5B] text-[#121212] text-xs font-bold tracking-[0.2em] uppercase transition-colors shadow-lg disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-[#8A9A5B] hover:bg-[#9AB06B]"
                        >
                            {copy.commentCta}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};


