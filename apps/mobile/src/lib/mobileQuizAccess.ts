import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalQuizKey = 'swipe' | 'blur';
export const MOBILE_QUIZ_ACCESS_STORAGE_ERROR =
  'Quiz haklari cihazda kaydedilemedi. Lutfen depolama alanini kontrol edip tekrar dene.';

type QuizUsageRecord = {
  date: string;
  usage: Record<LocalQuizKey, number>;
  rewardCredits: Record<LocalQuizKey, number>;
};

export const FREE_DAILY_QUIZ_LIMITS: Record<LocalQuizKey, number> = {
  swipe: 3,
  blur: 3,
};

export const MAX_DAILY_REWARD_CREDITS: Record<LocalQuizKey, number> = {
  swipe: FREE_DAILY_QUIZ_LIMITS.swipe,
  blur: FREE_DAILY_QUIZ_LIMITS.blur,
};

const QUIZ_ACCESS_STORAGE_KEY = 'mobile.quiz.access.v1';
let quizAccessMutationQueue: Promise<unknown> = Promise.resolve();

const buildTodayKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createEmptyRecord = (date = buildTodayKey()): QuizUsageRecord => ({
  date,
  usage: { swipe: 0, blur: 0 },
  rewardCredits: { swipe: 0, blur: 0 },
});

const createEmptySummary = (key: LocalQuizKey) => ({
  used: 0,
  rewardCredits: 0,
  freeLimit: FREE_DAILY_QUIZ_LIMITS[key],
  remaining: FREE_DAILY_QUIZ_LIMITS[key],
});

const toQuizAccessStorageError = (action: string, error: unknown): Error => {
  console.warn(`mobileQuizAccess:${action}`, error);
  return new Error(MOBILE_QUIZ_ACCESS_STORAGE_ERROR);
};

const withQuizAccessMutationLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  const nextOperation = quizAccessMutationQueue.then(operation, operation);
  quizAccessMutationQueue = nextOperation.catch(() => undefined);
  return nextOperation;
};

const clampRewardCreditCount = (key: LocalQuizKey, value: unknown): number => {
  const parsed = Math.max(0, Number(value) || 0);
  return Math.min(MAX_DAILY_REWARD_CREDITS[key], parsed);
};

const normalizeRecord = (value: unknown): QuizUsageRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyRecord();
  }

  const raw = value as Partial<QuizUsageRecord>;
  const today = buildTodayKey();
  if (String(raw.date || '') !== today) {
    return createEmptyRecord(today);
  }

  return {
    date: today,
    usage: {
      swipe: Math.max(0, Number(raw.usage?.swipe) || 0),
      blur: Math.max(0, Number(raw.usage?.blur) || 0),
    },
    rewardCredits: {
      swipe: clampRewardCreditCount('swipe', raw.rewardCredits?.swipe),
      blur: clampRewardCreditCount('blur', raw.rewardCredits?.blur),
    },
  };
};

const readRecord = async (): Promise<QuizUsageRecord> => {
  try {
    const raw = await AsyncStorage.getItem(QUIZ_ACCESS_STORAGE_KEY);
    if (!raw) return createEmptyRecord();
    try {
      return normalizeRecord(JSON.parse(raw));
    } catch (error) {
      console.warn('mobileQuizAccess:parse', error);
      return createEmptyRecord();
    }
  } catch (error) {
    throw toQuizAccessStorageError('read', error);
  }
};

const writeRecord = async (record: QuizUsageRecord): Promise<void> => {
  try {
    await AsyncStorage.setItem(QUIZ_ACCESS_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    throw toQuizAccessStorageError('write', error);
  }
};

export type QuizAccessSummary = {
  used: number;
  rewardCredits: number;
  freeLimit: number;
  remaining: number;
  storageError?: string;
};

export const readQuizAccessSummary = async (key: LocalQuizKey): Promise<QuizAccessSummary> => {
  try {
    const record = await readRecord();
    const used = record.usage[key];
    const rewardCredits = record.rewardCredits[key];
    const freeLimit = FREE_DAILY_QUIZ_LIMITS[key];
    return {
      used,
      rewardCredits,
      freeLimit,
      remaining: Math.max(0, freeLimit - used) + rewardCredits,
    };
  } catch (error) {
    return createStorageFailureSummary(key, error);
  }
};

const createStorageFailureSummary = (key: LocalQuizKey, error: unknown): QuizAccessSummary => ({
  ...createEmptySummary(key),
  storageError:
    error instanceof Error && error.message
      ? error.message
      : MOBILE_QUIZ_ACCESS_STORAGE_ERROR,
});

export type QuizEntryResult = QuizAccessSummary & {
  ok: boolean;
  usedRewardCredit: boolean;
};

export const consumeQuizEntry = async (
  key: LocalQuizKey,
  options?: { isPremium?: boolean },
): Promise<QuizEntryResult> => {
  if (options?.isPremium) {
    return {
      ok: true,
      used: 0,
      rewardCredits: 0,
      freeLimit: Number.MAX_SAFE_INTEGER,
      remaining: Number.MAX_SAFE_INTEGER,
      usedRewardCredit: false,
    };
  }

  try {
    return await withQuizAccessMutationLock(async () => {
      const record = await readRecord();
      const freeLimit = FREE_DAILY_QUIZ_LIMITS[key];
      const next = normalizeRecord(record);

      if (next.rewardCredits[key] > 0) {
        next.rewardCredits[key] -= 1;
        await writeRecord(next);
        return {
          ok: true,
          used: next.usage[key],
          rewardCredits: next.rewardCredits[key],
          freeLimit,
          remaining: Math.max(0, freeLimit - next.usage[key]) + next.rewardCredits[key],
          usedRewardCredit: true,
        };
      }

      if (next.usage[key] >= freeLimit) {
        return {
          ok: false,
          used: next.usage[key],
          rewardCredits: next.rewardCredits[key],
          freeLimit,
          remaining: next.rewardCredits[key],
          usedRewardCredit: false,
        };
      }

      next.usage[key] += 1;
      await writeRecord(next);
      return {
        ok: true,
        used: next.usage[key],
        rewardCredits: next.rewardCredits[key],
        freeLimit,
        remaining: Math.max(0, freeLimit - next.usage[key]) + next.rewardCredits[key],
        usedRewardCredit: false,
      };
    });
  } catch (error) {
    return {
      ...createStorageFailureSummary(key, error),
      ok: false,
      usedRewardCredit: false,
    };
  }
};

export const grantQuizRewardCredit = async (key: LocalQuizKey): Promise<QuizAccessSummary> => {
  try {
    return await withQuizAccessMutationLock(async () => {
      const next = await readRecord();
      next.rewardCredits[key] = Math.min(MAX_DAILY_REWARD_CREDITS[key], next.rewardCredits[key] + 1);
      await writeRecord(next);
      const used = next.usage[key];
      const rewardCredits = next.rewardCredits[key];
      const freeLimit = FREE_DAILY_QUIZ_LIMITS[key];
      return {
        used,
        rewardCredits,
        freeLimit,
        remaining: Math.max(0, freeLimit - used) + rewardCredits,
      };
    });
  } catch (error) {
    return createStorageFailureSummary(key, error);
  }
};
