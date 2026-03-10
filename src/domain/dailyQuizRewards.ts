const normalizeQuestionCount = (questionCount: number): number =>
  Math.max(0, Math.floor(Number(questionCount) || 0));

export const DAILY_QUIZ_CORRECT_XP = 2;
export const DAILY_QUIZ_PASS_RATIO = 0.6;
export const DAILY_QUIZ_FIRST_COMPLETION_XP_BASE = 8;
export const DAILY_QUIZ_EXTRA_COMPLETION_XP_BASE = 4;

export const getDailyQuizRequiredCorrectCount = (questionCount: number): number => {
  const normalized = normalizeQuestionCount(questionCount);
  if (!normalized) return 0;
  return Math.min(normalized, Math.max(1, Math.ceil(normalized * DAILY_QUIZ_PASS_RATIO)));
};

export const getDailyQuizCompletionXp = (
  questionCount: number,
  isFirstMovieCompletion: boolean
): number => {
  const requiredCorrectCount = getDailyQuizRequiredCorrectCount(questionCount);
  const baseXp = isFirstMovieCompletion
    ? DAILY_QUIZ_FIRST_COMPLETION_XP_BASE
    : DAILY_QUIZ_EXTRA_COMPLETION_XP_BASE;

  if (requiredCorrectCount <= 3) {
    return baseXp;
  }

  return Math.max(baseXp, Math.round(baseXp * (requiredCorrectCount / 3)));
};
