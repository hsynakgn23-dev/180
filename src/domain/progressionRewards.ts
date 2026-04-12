export type ProgressionRewardGrant = {
  xp: number;
  tickets: number;
  arenaScore: number;
  arenaActivity: number;
};

export type DailyCommentRewardState = {
  dateKey: string | null;
  rewardedMovieKeys: string[];
  completionBonusClaimed: boolean;
};

export type WeeklyArenaState = {
  weekKey: string | null;
  cohortLeagueKey: string | null;
  score: number;
  activityCount: number;
  commentRewards: number;
  quizRewards: number;
  updatedAt: string | null;
};

export const DAILY_COMMENT_MIN_CHARACTERS = 80;
export const DAILY_COMMENT_MIN_WORDS = 8;

const DAILY_COMMENT_REWARD_STEPS: ReadonlyArray<ProgressionRewardGrant> = [
  { xp: 14, tickets: 1, arenaScore: 12, arenaActivity: 1 },
  { xp: 14, tickets: 1, arenaScore: 12, arenaActivity: 1 },
  { xp: 16, tickets: 1, arenaScore: 14, arenaActivity: 1 },
  { xp: 18, tickets: 2, arenaScore: 16, arenaActivity: 1 },
  { xp: 22, tickets: 2, arenaScore: 18, arenaActivity: 1 },
];

export const DAILY_COMMENT_COMPLETION_BONUS: ProgressionRewardGrant = {
  xp: 35,
  tickets: 3,
  arenaScore: 25,
  arenaActivity: 1,
};

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const stripDiacritics = (value: string): string =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export const normalizeProgressionMovieKey = (value: unknown): string =>
  stripDiacritics(normalizeText(value, 220))
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isRewardableDailyCommentText = (value: unknown): boolean => {
  const text = normalizeText(value, 1000);
  if (!text || text.length < DAILY_COMMENT_MIN_CHARACTERS) return false;
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  return words.length >= DAILY_COMMENT_MIN_WORDS;
};

export const normalizeDailyCommentRewardState = (value: unknown, dateKey: string): DailyCommentRewardState => {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  const storedDateKey = normalizeText(raw.dateKey, 40) || null;
  if (storedDateKey !== dateKey) {
    return {
      dateKey,
      rewardedMovieKeys: [],
      completionBonusClaimed: false,
    };
  }
  return {
    dateKey,
    rewardedMovieKeys: Array.from(
      new Set(
        (Array.isArray(raw.rewardedMovieKeys) ? raw.rewardedMovieKeys : [])
          .map((entry) => normalizeProgressionMovieKey(entry))
          .filter(Boolean)
      )
    ).slice(0, 12),
    completionBonusClaimed: raw.completionBonusClaimed === true,
  };
};

export const normalizeWeeklyArenaState = (value: unknown, weekKey: string): WeeklyArenaState => {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  const storedWeekKey = normalizeText(raw.weekKey, 40) || null;
  if (storedWeekKey !== weekKey) {
    return {
      weekKey,
      cohortLeagueKey: null,
      score: 0,
      activityCount: 0,
      commentRewards: 0,
      quizRewards: 0,
      updatedAt: null,
    };
  }
  return {
    weekKey,
    cohortLeagueKey: normalizeText(raw.cohortLeagueKey, 40) || null,
    score: toSafeInt(raw.score),
    activityCount: toSafeInt(raw.activityCount),
    commentRewards: toSafeInt(raw.commentRewards),
    quizRewards: toSafeInt(raw.quizRewards),
    updatedAt: normalizeText(raw.updatedAt, 80) || null,
  };
};

export const getCurrentWeekKey = (value = new Date(), timeZone = 'Europe/Istanbul'): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value || 0);
  const day = Number(parts.find((part) => part.type === 'day')?.value || 0);
  const localDate = new Date(Date.UTC(year, Math.max(0, month - 1), day));
  const dayOfWeek = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() + 4 - dayOfWeek);
  const weekYear = localDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNumber = Math.ceil((((localDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
};

export const getDailyCommentReward = (
  rewardState: DailyCommentRewardState,
  movieKey: string
):
  | {
      ok: true;
      reward: ProgressionRewardGrant;
      nextState: DailyCommentRewardState;
      completionBonusAwarded: boolean;
    }
  | {
      ok: false;
      reason: 'already_rewarded';
      nextState: DailyCommentRewardState;
    } => {
  const normalizedMovieKey = normalizeProgressionMovieKey(movieKey);
  if (!normalizedMovieKey) {
    return {
      ok: false,
      reason: 'already_rewarded',
      nextState: rewardState,
    };
  }
  if (rewardState.rewardedMovieKeys.includes(normalizedMovieKey)) {
    return {
      ok: false,
      reason: 'already_rewarded',
      nextState: rewardState,
    };
  }

  const ordinal = rewardState.rewardedMovieKeys.length + 1;
  const stepReward =
    DAILY_COMMENT_REWARD_STEPS[Math.min(DAILY_COMMENT_REWARD_STEPS.length - 1, Math.max(0, ordinal - 1))];
  const nextRewardedMovieKeys = [...rewardState.rewardedMovieKeys, normalizedMovieKey];
  const completionBonusAwarded =
    nextRewardedMovieKeys.length >= 5 && rewardState.completionBonusClaimed !== true;

  const reward: ProgressionRewardGrant = {
    xp: stepReward.xp + (completionBonusAwarded ? DAILY_COMMENT_COMPLETION_BONUS.xp : 0),
    tickets: stepReward.tickets + (completionBonusAwarded ? DAILY_COMMENT_COMPLETION_BONUS.tickets : 0),
    arenaScore:
      stepReward.arenaScore + (completionBonusAwarded ? DAILY_COMMENT_COMPLETION_BONUS.arenaScore : 0),
    arenaActivity:
      stepReward.arenaActivity +
      (completionBonusAwarded ? DAILY_COMMENT_COMPLETION_BONUS.arenaActivity : 0),
  };

  return {
    ok: true,
    reward,
    completionBonusAwarded,
    nextState: {
      ...rewardState,
      rewardedMovieKeys: nextRewardedMovieKeys,
      completionBonusClaimed: rewardState.completionBonusClaimed || completionBonusAwarded,
    },
  };
};

export const getDailyQuizReward = (input: {
  isCorrect: boolean;
  completedMovieNow: boolean;
  completedBatchNow: boolean;
}): ProgressionRewardGrant => ({
  xp: 0,
  tickets: input.completedMovieNow ? 1 + (input.completedBatchNow ? 1 : 0) : 0,
  arenaScore:
    (input.isCorrect ? 1 : 0) + (input.completedMovieNow ? 4 : 0) + (input.completedBatchNow ? 6 : 0),
  arenaActivity: input.completedMovieNow ? 1 : 0,
});

export const getPoolQuizReward = (input: {
  isCompleted: boolean;
  isPerfect: boolean;
}): ProgressionRewardGrant => ({
  xp: 0,
  tickets: input.isCompleted ? (input.isPerfect ? 3 : 2) : 0,
  arenaScore: input.isCompleted ? (input.isPerfect ? 16 : 10) : 0,
  arenaActivity: input.isCompleted ? 1 : 0,
});

export const getBlurQuizReward = (input: {
  correct: boolean;
  blurStep: number;
  jokersUsed: number;
}): ProgressionRewardGrant => {
  if (!input.correct) {
    return { xp: 0, tickets: 0, arenaScore: 0, arenaActivity: 0 };
  }

  const safeStep = clamp(Math.floor(Number(input.blurStep) || 1), 1, 4);
  const safeJokers = clamp(Math.floor(Number(input.jokersUsed) || 0), 0, 3);
  const tickets = clamp(3 - Math.ceil(safeStep / 2) - Math.min(safeJokers, 1), 1, 2);
  const arenaScore = Math.max(6, 20 - safeStep * 3 - safeJokers * 2);
  return {
    xp: 0,
    tickets,
    arenaScore,
    arenaActivity: 1,
  };
};

export const getRushCompletionReward = (input: {
  mode: 'rush_15' | 'rush_30' | 'endless';
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  expired?: boolean;
}): ProgressionRewardGrant & { threshold: number; passedThreshold: boolean } => {
  const correct = Math.max(0, Math.floor(Number(input.correctCount) || 0));
  const wrong = Math.max(0, Math.floor(Number(input.wrongCount) || 0));
  const total = Math.max(correct + wrong, Math.floor(Number(input.totalQuestions) || 0));
  const accuracy = total > 0 ? correct / total : 0;

  if (input.mode === 'rush_15') {
    const threshold = 10;
    return {
      xp: correct * 3 + (accuracy >= 0.7 ? 12 : 0) + (correct >= threshold ? 15 : 0),
      tickets: correct >= 6 ? 2 + (accuracy >= 0.7 ? 1 : 0) + (correct >= threshold ? 1 : 0) : 0,
      arenaScore: correct * 2 + (accuracy >= 0.7 ? 10 : 0) + (correct >= threshold ? 8 : 0),
      arenaActivity: total > 0 ? 1 : 0,
      threshold,
      passedThreshold: correct >= threshold,
    };
  }

  if (input.mode === 'rush_30') {
    const threshold = 21;
    return {
      xp: correct * 4 + (accuracy >= 0.72 ? 18 : 0) + (correct >= threshold ? 30 : 0),
      tickets: correct >= 10 ? 3 + (accuracy >= 0.72 ? 2 : 0) + (correct >= threshold ? 1 : 0) : 0,
      arenaScore: correct * 2 + (accuracy >= 0.72 ? 14 : 0) + (correct >= threshold ? 14 : 0),
      arenaActivity: total > 0 ? 1 : 0,
      threshold,
      passedThreshold: correct >= threshold,
    };
  }

  const threshold = 18;
  const survivalBonus = input.expired ? 0 : 18;
  return {
    xp: correct * 4 + Math.floor(correct / 10) * 20 + survivalBonus,
    tickets:
      correct >= 12
        ? 4 + Math.floor(correct / 12) + (accuracy >= 0.72 ? 1 : 0)
        : 0,
    arenaScore: correct * 3 + Math.floor(correct / 10) * 10 + (accuracy >= 0.72 ? 16 : 0),
    arenaActivity: total > 0 ? 1 : 0,
    threshold,
    passedThreshold: correct >= threshold,
  };
};
