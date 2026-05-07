import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchMobileMoviePage, type MobileMoviePageData, type MobileMovieRecommendation } from '../lib/mobileMoviePageApi';
import {
  fetchPoolQuiz,
  submitPoolAnswer,
  type PoolQuestion,
  type PoolOptionKey,
} from '../lib/mobilePoolQuizApi';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg: '#121212',
  surface: '#1f1f1f',
  surfaceAlt: '#1f1f1f',
  surfaceAlt2: '#141414',
  overlay: 'rgba(23,23,23,0.90)',
  text: '#E5E4E2',
  text2: '#c9c6bf',
  muted: '#a09890',
  muted2: '#8e8b84',
  sage: '#8A9A5B',
  sageTint: 'rgba(138,154,91,0.08)',
  sageActive: 'rgba(138,154,91,0.20)',
  rose: '#A57164',
  roseTint: 'rgba(165,113,100,0.08)',
  roseActive: 'rgba(165,113,100,0.22)',
  border: 'rgba(255,255,255,0.12)',
  borderHi: 'rgba(255,255,255,0.24)',
};

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_CAST_BASE = 'https://image.tmdb.org/t/p/w200';

// ─── Types ───────────────────────────────────────────────────────────────────
export type MoviePageModalProps = {
  visible: boolean;
  movieId: string | null;
  movieTitle?: string;
  onClose: () => void;
  onWriteRitual: (movieId: string, movieTitle: string) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getInitials = (title: string): string => {
  return title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
};

const formatRuntime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m} dk`;
};

const OPTION_LABELS: PoolOptionKey[] = ['a', 'b', 'c', 'd'];
const OPTION_DISPLAY = ['A', 'B', 'C', 'D'];

// ─── Skeleton ────────────────────────────────────────────────────────────────
const SkeletonBlock = ({ width, height, style }: { width?: number | string; height: number; style?: object }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={[
        { width: width ?? '100%', height, backgroundColor: C.surface, borderRadius: 6, opacity: anim },
        style,
      ]}
    />
  );
};

// ─── Quiz Overlay ────────────────────────────────────────────────────────────
type QuizState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | {
      phase: 'question';
      questions: PoolQuestion[];
      currentIndex: number;
      selected: PoolOptionKey | null;
      answered: boolean;
      isCorrect: boolean | null;
      correctOption: PoolOptionKey | null;
      explanation: string;
      xpEarned: number;
      totalXp: number;
      correctCount: number;
    }
  | { phase: 'done'; totalXp: number; correctCount: number; totalCount: number };

type QuizOverlayProps = {
  visible: boolean;
  movieId: string;
  movieTitle: string;
  onClose: () => void;
};

const MovieQuizOverlay = ({ visible, movieId, movieTitle, onClose }: QuizOverlayProps) => {
  const [quizState, setQuizState] = useState<QuizState>({ phase: 'loading' });
  const progressAnim = useRef(new Animated.Value(0)).current;

  const loadQuiz = useCallback(async () => {
    setQuizState({ phase: 'loading' });
    const result = await fetchPoolQuiz({ movie_id: movieId, language: 'tr' });
    if (!result.ok) {
      setQuizState({ phase: 'error', message: result.error });
      return;
    }
    if (result.questions.length === 0) {
      setQuizState({ phase: 'done', totalXp: 0, correctCount: 0, totalCount: 0 });
      return;
    }
    setQuizState({
      phase: 'question',
      questions: result.questions,
      currentIndex: 0,
      selected: null,
      answered: false,
      isCorrect: null,
      correctOption: null,
      explanation: '',
      xpEarned: 0,
      totalXp: 0,
      correctCount: 0,
    });
  }, [movieId]);

  useEffect(() => {
    if (visible && movieId) {
      void loadQuiz();
    }
  }, [visible, movieId, loadQuiz]);

  useEffect(() => {
    if (quizState.phase !== 'question') return;
    const total = quizState.questions.length;
    const current = quizState.currentIndex;
    const progress = total > 0 ? current / total : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [quizState, progressAnim]);

  const handleSelectOption = useCallback(
    async (option: PoolOptionKey) => {
      if (quizState.phase !== 'question' || quizState.answered) return;
      const question = quizState.questions[quizState.currentIndex];
      if (!question) return;

      setQuizState((prev) => {
        if (prev.phase !== 'question') return prev;
        return { ...prev, selected: option };
      });

      const result = await submitPoolAnswer({
        movie_id: movieId,
        question_id: question.id,
        selected_option: option,
        language: 'tr',
      });

      if (!result.ok) {
        setQuizState((prev) => {
          if (prev.phase !== 'question') return prev;
          return {
            ...prev,
            answered: true,
            isCorrect: false,
            correctOption: option,
            explanation: result.error,
            xpEarned: 0,
          };
        });
        return;
      }

      setQuizState((prev) => {
        if (prev.phase !== 'question') return prev;
        return {
          ...prev,
          answered: true,
          isCorrect: result.is_correct,
          correctOption: result.correct_option,
          explanation: result.explanation,
          xpEarned: result.xp_earned + result.bonus_xp,
          totalXp: prev.totalXp + result.xp_earned + result.bonus_xp,
          correctCount: prev.correctCount + (result.is_correct ? 1 : 0),
        };
      });
    },
    [quizState, movieId]
  );

  const handleNext = useCallback(() => {
    if (quizState.phase !== 'question') return;
    const nextIndex = quizState.currentIndex + 1;
    if (nextIndex >= quizState.questions.length) {
      setQuizState({
        phase: 'done',
        totalXp: quizState.totalXp,
        correctCount: quizState.correctCount,
        totalCount: quizState.questions.length,
      });
      return;
    }
    setQuizState((prev) => {
      if (prev.phase !== 'question') return prev;
      return {
        ...prev,
        currentIndex: nextIndex,
        selected: null,
        answered: false,
        isCorrect: null,
        correctOption: null,
        explanation: '',
        xpEarned: 0,
      };
    });
  }, [quizState]);

  const handleSkip = useCallback(() => {
    handleNext();
  }, [handleNext]);

  const screenWidth = Dimensions.get('window').width;

  const renderContent = () => {
    if (quizState.phase === 'loading') {
      return (
        <View style={qs.loadingContainer}>
          <SkeletonBlock height={24} style={{ marginBottom: 16, width: '70%' }} />
          <SkeletonBlock height={60} style={{ marginBottom: 12 }} />
          <SkeletonBlock height={60} style={{ marginBottom: 12 }} />
          <SkeletonBlock height={60} style={{ marginBottom: 12 }} />
          <SkeletonBlock height={60} />
        </View>
      );
    }

    if (quizState.phase === 'error') {
      return (
        <View style={qs.loadingContainer}>
          <Text style={qs.errorText}>{quizState.message}</Text>
          <Pressable style={qs.retryBtn} onPress={() => void loadQuiz()}>
            <Text style={qs.retryBtnText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      );
    }

    if (quizState.phase === 'done') {
      return (
        <View style={qs.loadingContainer}>
          <Text style={qs.doneTitle}>Quiz Tamamlandi!</Text>
          <Text style={qs.doneScore}>
            {quizState.correctCount}/{quizState.totalCount} dogru
          </Text>
          <Text style={qs.doneXp}>+{quizState.totalXp} XP kazandin</Text>
          <Pressable style={qs.closeBtn} onPress={onClose}>
            <Text style={qs.closeBtnText}>Kapat</Text>
          </Pressable>
        </View>
      );
    }

    // phase === 'question'
    const { questions, currentIndex, selected, answered, isCorrect, correctOption, explanation, xpEarned } = quizState;
    const question = questions[currentIndex];
    if (!question) return null;
    const total = questions.length;
    const progressFraction = total > 0 ? (currentIndex + 1) / total : 0;

    return (
      <>
        {/* Header */}
        <View style={qs.header}>
          <Pressable style={qs.closeCircle} onPress={onClose} hitSlop={8}>
            <Text style={qs.closeCircleText}>✕</Text>
          </Pressable>
          <View style={qs.headerMid}>
            <Text style={qs.headerLabel} numberOfLines={1}>
              Film Quiz · {movieTitle}
            </Text>
            <Text style={qs.headerSub}>Yanıtla, ritual'ını aç + XP kazan.</Text>
          </View>
          <Text style={qs.counter}>
            {currentIndex + 1}/{total}
          </Text>
        </View>

        {/* Progress */}
        <View style={qs.progressContainer}>
          <View style={qs.progressTrack}>
            <View style={[qs.progressFill, { width: screenWidth * progressFraction - 32 }]} />
          </View>
          <View style={qs.progressLabels}>
            <Text style={qs.progressLeft}>
              SORU {String(currentIndex + 1).padStart(2, '0')}
            </Text>
            {answered && xpEarned > 0 && (
              <Text style={qs.progressRight}>+{xpEarned} XP</Text>
            )}
          </View>
        </View>

        {/* Question body */}
        <ScrollView style={qs.questionBody} contentContainerStyle={qs.questionBodyContent}>
          <Text style={qs.questionText}>{question.question}</Text>

          <View style={qs.optionsContainer}>
            {question.options.map((opt, idx) => {
              const isSelected = selected === opt.key;
              const isCorrectOpt = answered && correctOption === opt.key;
              const isWrongOpt = answered && isSelected && !isCorrect;

              let bgColor = C.surfaceAlt;
              let borderColor = C.border;
              let circleColor = 'transparent';
              let circleTextColor = C.muted;
              let circleBorderColor = C.borderHi;

              if (answered) {
                if (isCorrectOpt) {
                  bgColor = C.sageActive;
                  borderColor = C.sage;
                  circleColor = C.sage;
                  circleTextColor = C.bg;
                  circleBorderColor = C.sage;
                } else if (isWrongOpt) {
                  bgColor = C.roseActive;
                  borderColor = C.rose;
                  circleColor = C.rose;
                  circleTextColor = C.bg;
                  circleBorderColor = C.rose;
                }
              } else if (isSelected) {
                bgColor = C.sageActive;
                borderColor = C.sage;
                circleColor = C.sage;
                circleTextColor = C.bg;
                circleBorderColor = C.sage;
              }

              return (
                <Pressable
                  key={opt.key}
                  style={[qs.optionBtn, { backgroundColor: bgColor, borderColor }]}
                  onPress={() => void handleSelectOption(opt.key)}
                  disabled={answered}
                >
                  <View style={[qs.optionCircle, { backgroundColor: circleColor, borderColor: circleBorderColor }]}>
                    <Text style={[qs.optionCircleText, { color: circleTextColor }]}>
                      {OPTION_DISPLAY[OPTION_LABELS.indexOf(opt.key)] ?? opt.key.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={qs.optionLabel}>{opt.label}</Text>
                  {answered && isCorrectOpt && (
                    <Text style={[qs.checkMark, { color: C.sage }]}>✓</Text>
                  )}
                  {answered && isWrongOpt && (
                    <Text style={[qs.checkMark, { color: C.rose }]}>✗</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {answered && explanation.length > 0 && (
            <View style={qs.explanationBox}>
              <Text style={qs.explanationLabel}>Hint</Text>
              <Text style={qs.explanationText}>{explanation}</Text>
            </View>
          )}
        </ScrollView>

        {/* Actions */}
        <View style={qs.actions}>
          <Pressable style={qs.skipBtn} onPress={handleSkip}>
            <Text style={qs.skipBtnText}>Atla</Text>
          </Pressable>
          <Pressable
            style={[qs.nextBtn, !answered && qs.nextBtnDisabled]}
            onPress={handleNext}
          >
            <Text style={qs.nextBtnText}>Sonraki →</Text>
          </Pressable>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={qs.root}>{renderContent()}</View>
    </Modal>
  );
};

// ─── Movie Page View ─────────────────────────────────────────────────────────
type MoviePageViewProps = {
  movie: MobileMoviePageData;
  recommendations: MobileMovieRecommendation[];
  onBack: () => void;
  onWriteRitual: () => void;
  onOpenQuiz: () => void;
  onRecommendationPress: (id: string, title: string) => void;
};

const MoviePageView = ({
  movie,
  recommendations,
  onBack,
  onWriteRitual,
  onOpenQuiz,
  onRecommendationPress,
}: MoviePageViewProps) => {
  const genres = movie.genre ? movie.genre.split(/[\/,]/).map((g) => g.trim()).filter(Boolean) : [];
  const initials = getInitials(movie.title);

  return (
    <ScrollView style={mp.root} contentContainerStyle={mp.content}>
      {/* HERO */}
      <View style={mp.hero}>
        {/* Gradient background */}
        <View style={mp.heroBg} />

        {/* Nav bar */}
        <View style={mp.nav}>
          <Pressable style={mp.navCircle} onPress={onBack} hitSlop={8}>
            <Text style={mp.navCircleText}>‹</Text>
          </Pressable>
          <View style={mp.navRight}>
            <Pressable style={mp.navCircle}>
              <Text style={mp.navCircleText}>♡</Text>
            </Pressable>
            <Pressable style={mp.navCircle}>
              <Text style={mp.navCircleText}>↗</Text>
            </Pressable>
          </View>
        </View>

        {/* Hero content: poster + title */}
        <View style={mp.heroContent}>
          {/* Poster */}
          <View style={mp.posterWrapper}>
            {movie.poster_path ? (
              <Image
                source={{ uri: TMDB_POSTER_BASE + movie.poster_path }}
                style={mp.posterImage}
                resizeMode="cover"
              />
            ) : (
              <View style={mp.posterFallback}>
                <Text style={mp.posterFallbackText}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Title block */}
          <View style={mp.heroText}>
            <Text style={mp.archiveLabel}>In the Archive</Text>
            <Text style={mp.heroTitle} numberOfLines={4}>
              {movie.title}
            </Text>
            {movie.tagline ? (
              <Text style={mp.heroTagline} numberOfLines={2}>
                "{movie.tagline}"
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* META STRIP */}
      <View style={mp.metaStrip}>
        {movie.release_year ? (
          <View style={mp.chip}>
            <Text style={mp.chipTextMono}>{movie.release_year}</Text>
          </View>
        ) : null}
        {genres.map((g) => (
          <View key={g} style={mp.chip}>
            <Text style={mp.chipText}>{g}</Text>
          </View>
        ))}
        {movie.runtime ? (
          <Text style={mp.runtimeText}>{formatRuntime(movie.runtime)}</Text>
        ) : null}
      </View>

      {/* DIRECTOR + SCORE */}
      <View style={mp.directorRow}>
        <View style={mp.directorLeft}>
          <Text style={mp.directorLabel}>Directed by</Text>
          <Text style={mp.directorName}>{movie.director ?? '—'}</Text>
        </View>
        {movie.vote_average != null && (
          <View style={mp.scoreBox}>
            <Text style={mp.scoreStar}>✦</Text>
            <View>
              <Text style={mp.score180Label}>180</Text>
              <Text style={mp.scoreValue}>
                {movie.vote_average.toFixed(1)}
                <Text style={mp.scoreDenom}> / 10</Text>
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* CTA BUTTONS */}
      <View style={mp.ctaRow}>
        <Pressable style={mp.ctaWrite} onPress={onWriteRitual}>
          <Text style={mp.ctaWriteText}>Write Ritual →</Text>
        </Pressable>
        <Pressable style={mp.ctaHeart}>
          <Text style={mp.ctaHeartText}>♡</Text>
        </Pressable>
      </View>

      {/* QUIZ HINT CARD */}
      <Pressable style={mp.quizCard} onPress={onOpenQuiz}>
        <View style={mp.quizIcon}>
          <Text style={mp.quizIconText}>?</Text>
        </View>
        <View style={mp.quizCardText}>
          <Text style={mp.quizCardLabel}>Film Quiz · 5 soru</Text>
          <Text style={mp.quizCardSub}>Yanıtla, ritual'ını aç + XP kazan</Text>
        </View>
        <Text style={mp.quizChevron}>›</Text>
      </Pressable>

      {/* STORY */}
      {movie.overview ? (
        <View style={mp.storySection}>
          <Text style={mp.sectionLabel}>STORY</Text>
          <Text style={mp.storyText}>{movie.overview}</Text>
        </View>
      ) : null}

      {/* CAST */}
      {movie.cast_details.length > 0 && (
        <View style={mp.castSection}>
          <View style={mp.castHeader}>
            <Text style={mp.sectionLabel}>CAST</Text>
            <Text style={mp.swipeHint}>Swipe →</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mp.castScroll}>
            {movie.cast_details.map((member, idx) => (
              <View key={`${member.name}-${idx}`} style={mp.castItem}>
                {member.profile_path ? (
                  <Image
                    source={{ uri: TMDB_CAST_BASE + member.profile_path }}
                    style={mp.castAvatar}
                  />
                ) : (
                  <View style={[mp.castAvatar, mp.castAvatarFallback]}>
                    <Text style={mp.castAvatarText}>{getInitials(member.name)}</Text>
                  </View>
                )}
                <Text style={mp.castName} numberOfLines={2}>
                  {member.name}
                </Text>
                <Text style={mp.castCharacter} numberOfLines={2}>
                  {member.character}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* SIMILAR FILMS */}
      {recommendations.length > 0 && (
        <View style={mp.similarSection}>
          <View style={mp.castHeader}>
            <Text style={mp.sectionLabel}>You Might Also Like</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mp.castScroll}>
            {recommendations.map((rec) => (
              <Pressable
                key={rec.id}
                style={mp.recCard}
                onPress={() => onRecommendationPress(rec.id, rec.title)}
              >
                {rec.poster_path ? (
                  <Image
                    source={{ uri: TMDB_POSTER_BASE + rec.poster_path }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, mp.recFallback]}>
                    <Text style={mp.recFallbackText}>{getInitials(rec.title)}</Text>
                  </View>
                )}
                <View style={mp.recGradient} />
                <View style={mp.recMeta}>
                  {rec.director ? (
                    <Text style={mp.recDirector} numberOfLines={1}>{rec.director}</Text>
                  ) : null}
                  <Text style={mp.recTitle} numberOfLines={2}>{rec.title}</Text>
                  {rec.release_year ? (
                    <Text style={mp.recYear}>{rec.release_year}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
};

// ─── MoviePageModal (export) ─────────────────────────────────────────────────
export const MoviePageModal = ({
  visible,
  movieId,
  movieTitle = '',
  onClose,
  onWriteRitual,
}: MoviePageModalProps) => {
  type PageState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; movie: MobileMoviePageData; recommendations: MobileMovieRecommendation[] };

  const [pageState, setPageState] = useState<PageState>({ status: 'idle' });
  const [quizVisible, setQuizVisible] = useState(false);

  const loadMovie = useCallback(async (id: string) => {
    setPageState({ status: 'loading' });
    const result = await fetchMobileMoviePage(id);
    if (!result.ok) {
      setPageState({ status: 'error', message: result.error });
    } else {
      setPageState({ status: 'success', movie: result.movie, recommendations: result.recommendations });
    }
  }, []);

  useEffect(() => {
    if (visible && movieId) {
      void loadMovie(movieId);
    } else if (!visible) {
      setQuizVisible(false);
    }
  }, [visible, movieId, loadMovie]);

  const handleRecommendationPress = useCallback(
    (id: string, title: string) => {
      // Load the new movie in the same modal
      void loadMovie(id);
    },
    [loadMovie]
  );

  const renderBody = () => {
    if (pageState.status === 'loading' || pageState.status === 'idle') {
      return (
        <ScrollView style={mp.root} contentContainerStyle={mp.content}>
          <View style={[mp.hero, { justifyContent: 'flex-end', padding: 20 }]}>
            <View style={mp.heroBg} />
            <Pressable style={[mp.navCircle, { position: 'absolute', top: 14, left: 16 }]} onPress={onClose}>
              <Text style={mp.navCircleText}>‹</Text>
            </Pressable>
            <SkeletonBlock height={165} style={{ width: 110, borderRadius: 4 }} />
          </View>
          <View style={{ padding: 20, gap: 12 }}>
            <SkeletonBlock height={20} style={{ width: '60%' }} />
            <SkeletonBlock height={14} />
            <SkeletonBlock height={14} style={{ width: '80%' }} />
            <SkeletonBlock height={14} style={{ width: '70%' }} />
          </View>
        </ScrollView>
      );
    }

    if (pageState.status === 'error') {
      return (
        <View style={mp.errorContainer}>
          <Pressable style={[mp.navCircle, { alignSelf: 'flex-start', margin: 16 }]} onPress={onClose}>
            <Text style={mp.navCircleText}>‹</Text>
          </Pressable>
          <Text style={mp.errorText}>{pageState.message}</Text>
          <Pressable
            style={mp.retryBtn}
            onPress={() => movieId && void loadMovie(movieId)}
          >
            <Text style={mp.retryBtnText}>Tekrar Dene</Text>
          </Pressable>
          <Pressable style={mp.backBtn} onPress={onClose}>
            <Text style={mp.backBtnText}>Geri Don</Text>
          </Pressable>
        </View>
      );
    }

    // status === 'success'
    const { movie, recommendations } = pageState;
    const displayTitle = movie.title || movieTitle;

    return (
      <>
        <MoviePageView
          movie={movie}
          recommendations={recommendations}
          onBack={onClose}
          onWriteRitual={() => onWriteRitual(movie.id, movie.title)}
          onOpenQuiz={() => setQuizVisible(true)}
          onRecommendationPress={handleRecommendationPress}
        />
        <MovieQuizOverlay
          visible={quizVisible}
          movieId={movie.id}
          movieTitle={displayTitle}
          onClose={() => setQuizVisible(false)}
        />
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: C.bg }}>{renderBody()}</View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const HERO_HEIGHT = 480;

const mp = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flexGrow: 1 },

  // Hero
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: '#1a1510',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1510',
  },
  nav: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navRight: { flexDirection: 'row', gap: 8 },
  navCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.overlay,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCircleText: { color: C.text, fontSize: 18 },

  heroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    paddingBottom: 24,
    gap: 16,
  },
  posterWrapper: {
    width: 110,
    height: 165,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  posterImage: { width: 110, height: 165, borderRadius: 4 },
  posterFallback: {
    width: 110,
    height: 165,
    borderRadius: 4,
    backgroundColor: '#2a2018',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFallbackText: { color: C.text2, fontSize: 28, fontWeight: '700' },

  heroText: { flex: 1, paddingBottom: 4 },
  archiveLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: C.sage,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.72,
    lineHeight: 28,
    color: C.text,
    marginBottom: 8,
  },
  heroTagline: {
    fontSize: 11,
    color: C.muted,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // Meta strip
  metaStrip: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: C.text2,
  },
  chipTextMono: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: C.text2,
  },
  runtimeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted2,
    marginLeft: 'auto',
  },

  // Director + score
  directorRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  directorLeft: { flex: 1 },
  directorLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    color: C.muted2,
    marginBottom: 4,
  },
  directorName: { fontSize: 14, fontWeight: '500', color: C.text },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.sage,
    backgroundColor: C.sageTint,
    borderRadius: 8,
  },
  scoreStar: { fontSize: 16, color: C.sage },
  score180Label: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 2.8,
    color: C.sage,
    textTransform: 'uppercase',
  },
  scoreValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.36, color: C.text },
  scoreDenom: { fontSize: 10, color: C.muted2 },

  // CTA
  ctaRow: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexDirection: 'row',
    gap: 10,
  },
  ctaWrite: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: C.sage,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaWriteText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: C.bg,
  },
  ctaHeart: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaHeartText: { fontSize: 18, color: C.text },

  // Quiz hint card
  quizCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.rose,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quizIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.roseTint,
    borderWidth: 1,
    borderColor: C.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizIconText: { fontSize: 16, fontWeight: '700', color: C.rose },
  quizCardText: { flex: 1 },
  quizCardLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    color: C.rose,
    marginBottom: 3,
  },
  quizCardSub: { fontSize: 12, color: C.text2, lineHeight: 17 },
  quizChevron: { color: C.rose, fontSize: 18 },

  // Story
  storySection: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: C.sage,
    marginBottom: 12,
  },
  storyText: { fontSize: 14, lineHeight: 23, color: C.text2, fontWeight: '300' },

  // Cast
  castSection: {
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  castHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  swipeHint: {
    fontSize: 9,
    color: C.muted2,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  castScroll: { paddingHorizontal: 20, gap: 14 },
  castItem: { width: 84, alignItems: 'center' },
  castAvatar: { width: 84, height: 84, borderRadius: 42 },
  castAvatarFallback: {
    backgroundColor: '#2a3a4a',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castAvatarText: { fontSize: 24, fontWeight: '700', color: C.text2 },
  castName: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
    lineHeight: 15,
  },
  castCharacter: {
    fontSize: 10,
    color: C.muted2,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Similar
  similarSection: {
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  recCard: {
    width: 120,
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#1a1a2a',
    justifyContent: 'flex-end',
  },
  recFallback: {
    backgroundColor: '#1a1a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recFallbackText: { fontSize: 24, fontWeight: '700', color: C.muted2 },
  recGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  recMeta: { padding: 10, position: 'relative' },
  recDirector: {
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: C.muted2,
    marginBottom: 2,
  },
  recTitle: { fontSize: 11, fontWeight: '500', color: C.text, marginTop: 2 },
  recYear: { fontFamily: 'monospace', fontSize: 8, color: C.muted2, marginTop: 2 },

  // Error
  errorContainer: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: { fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.sage,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: C.bg },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  backBtnText: { fontSize: 12, fontWeight: '700', color: C.text2 },
});

const qs = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircleText: { color: C.text, fontSize: 16 },
  headerMid: { flex: 1 },
  headerLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: C.sage,
    marginBottom: 3,
  },
  headerSub: { fontSize: 11, color: C.muted, fontStyle: 'italic' },
  counter: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: C.text2,
    letterSpacing: 1.8,
  },

  // Progress
  progressContainer: { paddingHorizontal: 16, paddingTop: 14 },
  progressTrack: {
    height: 3,
    backgroundColor: C.surfaceAlt,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: C.sage, borderRadius: 2 },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLeft: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.muted2,
    letterSpacing: 1.8,
  },
  progressRight: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.sage,
    letterSpacing: 1.8,
  },

  // Question
  questionBody: { flex: 1 },
  questionBodyContent: { padding: 20, paddingTop: 28, paddingBottom: 16 },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    letterSpacing: -0.44,
    color: C.text,
    marginBottom: 24,
  },
  optionsContainer: { gap: 10 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  optionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionCircleText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  optionLabel: { fontSize: 14, color: C.text, lineHeight: 20, flex: 1 },
  checkMark: { fontSize: 16 },

  explanationBox: {
    marginTop: 22,
    padding: 14,
    backgroundColor: C.roseTint,
    borderWidth: 1,
    borderColor: C.rose,
    borderRadius: 10,
  },
  explanationLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.rose,
    marginBottom: 4,
  },
  explanationText: { fontSize: 11, color: C.text2, fontStyle: 'italic', lineHeight: 17 },

  // Actions
  actions: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    flexDirection: 'row',
    gap: 10,
  },
  skipBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 9999,
  },
  skipBtnText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: C.text2,
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: C.sage,
    borderRadius: 9999,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: C.bg,
  },

  // Loading / error states
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  errorText: { fontSize: 14, color: C.muted, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.sage,
    borderRadius: 8,
    marginTop: 8,
  },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: C.bg },
  closeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 8,
  },
  closeBtnText: { fontSize: 12, fontWeight: '700', color: C.text2 },

  // Done screen
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  doneScore: { fontSize: 16, color: C.text2, textAlign: 'center' },
  doneXp: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sage,
    textAlign: 'center',
    marginTop: 4,
  },
});
