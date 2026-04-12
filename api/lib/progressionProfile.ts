import {
  getCurrentWeekKey,
  normalizeDailyCommentRewardState,
  normalizeWeeklyArenaState,
  type DailyCommentRewardState,
  type ProgressionRewardGrant,
  type WeeklyArenaState,
} from '../../src/domain/progressionRewards.js';
import { resolveLeagueKeyFromXp } from '../../src/domain/leagueSystem.js';
import {
  loadWalletProfile,
  mutateWalletProfile,
  type ProgressionWalletState,
} from './progressionWallet.js';
import { resolveStoredProfileMarks } from '../../src/domain/profileMarks.js';

// Supabase's generated builder types vary across local and deployed contexts.
// This helper only needs the `from(...)` entrypoint, so keep the contract broad.
type SupabaseClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type LoadedProfileContext = Awaited<
  ReturnType<
    typeof loadWalletProfile
  >
>;

const normalizeText = (value: unknown, maxLength = 160): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
};

const parseDateKeyToDayIndex = (dateKey: string): number | null => {
  const parts = dateKey.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(parsed.getTime() / (24 * 60 * 60 * 1000));
};

const normalizeDateKey = (value: unknown): string | null => {
  const text = normalizeText(value, 40);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const sanitizeDateKeys = (value: unknown, maxItems = 420): string[] =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => normalizeDateKey(entry))
        .filter((entry): entry is string => Boolean(entry))
    )
  )
    .sort()
    .slice(-maxItems);

const deriveNextStreak = (currentStreak: number, previousDateKey: string | null, nextDateKey: string): number => {
  if (previousDateKey === nextDateKey) return Math.max(1, currentStreak);
  const currentDayIndex = parseDateKeyToDayIndex(nextDateKey);
  const previousDayIndex = previousDateKey ? parseDateKeyToDayIndex(previousDateKey) : null;
  if (currentDayIndex === null) return Math.max(1, currentStreak);
  if (previousDayIndex === null) return 1;
  if (currentDayIndex - previousDayIndex === 1) return Math.max(1, currentStreak) + 1;
  if (currentDayIndex === previousDayIndex) return Math.max(1, currentStreak);
  return 1;
};

const readCurrentXp = (xpState: Record<string, unknown>): number =>
  toSafeInt(xpState.totalXP ?? xpState.xp);

export const readDailyCommentRewardTracker = (
  xpState: Record<string, unknown>,
  dateKey: string
): DailyCommentRewardState => normalizeDailyCommentRewardState(xpState.dailyCommentRewards, dateKey);

export const readWeeklyArenaState = (
  xpState: Record<string, unknown>,
  now = new Date()
): WeeklyArenaState => normalizeWeeklyArenaState(xpState.weeklyArena, getCurrentWeekKey(now));

export const loadProgressionProfile = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
}): Promise<LoadedProfileContext> =>
  loadWalletProfile({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
  });

export const applyProgressionReward = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  reward: ProgressionRewardGrant;
  now?: Date;
  loaded?: LoadedProfileContext;
  markActiveDateKey?: string | null;
  dailyCommentRewardState?: DailyCommentRewardState | null;
  dailyRitualEntry?: { date: string; movieTitle: string; text: string } | null;
  isCommentReward?: boolean;
  isQuizReward?: boolean;
}): Promise<{
  totalXP: number;
  streak: number;
  wallet: ProgressionWalletState;
  xpState: Record<string, unknown>;
  weeklyArena: WeeklyArenaState;
}> => {
  const now = input.now || new Date();
  const mutation = await mutateWalletProfile<{
    totalXP: number;
    streak: number;
    weeklyArena: WeeklyArenaState;
  }, never>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      const currentState = { ...loaded.xpState };
      const currentTotalXp = readCurrentXp(currentState);
      const weeklyArena = readWeeklyArenaState(currentState, now);
      const nextWeeklyArena: WeeklyArenaState = {
        ...weeklyArena,
        cohortLeagueKey: weeklyArena.cohortLeagueKey || resolveLeagueKeyFromXp(currentTotalXp),
        score: weeklyArena.score + toSafeInt(input.reward.arenaScore),
        activityCount: weeklyArena.activityCount + toSafeInt(input.reward.arenaActivity),
        commentRewards: weeklyArena.commentRewards + (input.isCommentReward ? 1 : 0),
        quizRewards: weeklyArena.quizRewards + (input.isQuizReward ? 1 : 0),
        updatedAt: now.toISOString(),
      };

      const nextWallet: ProgressionWalletState = {
        ...loaded.wallet,
        balance: loaded.wallet.balance + toSafeInt(input.reward.tickets),
        lifetimeEarned: loaded.wallet.lifetimeEarned + toSafeInt(input.reward.tickets),
      };

      let nextStreak = toSafeInt(currentState.streak);
      let nextLastStreakDate = normalizeDateKey(currentState.lastStreakDate);
      let nextActiveDays = sanitizeDateKeys(currentState.activeDays);
      const activeDateKey = normalizeDateKey(input.markActiveDateKey);
      if (activeDateKey) {
        nextStreak = deriveNextStreak(nextStreak, nextLastStreakDate, activeDateKey);
        nextLastStreakDate = activeDateKey;
        nextActiveDays = sanitizeDateKeys([...nextActiveDays, activeDateKey]);
      }

      let nextDailyRituals = Array.isArray(currentState.dailyRituals)
        ? [...(currentState.dailyRituals as unknown[])]
        : [];
      const dailyRitualEntry = input.dailyRitualEntry;
      if (dailyRitualEntry?.date) {
        const existingIndex = nextDailyRituals.findIndex((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
          const record = entry as Record<string, unknown>;
          return (
            normalizeDateKey(record.date) === dailyRitualEntry.date &&
            normalizeText(record.movieTitle, 220).toLowerCase() ===
              normalizeText(dailyRitualEntry.movieTitle, 220).toLowerCase()
          );
        });
        const serialized = {
          date: dailyRitualEntry.date,
          movieTitle: normalizeText(dailyRitualEntry.movieTitle, 220),
          text: normalizeText(dailyRitualEntry.text, 280),
        };
        if (existingIndex >= 0) {
          nextDailyRituals[existingIndex] = serialized;
        } else {
          nextDailyRituals = [...nextDailyRituals, serialized].slice(-120);
        }
      }

      const nextXpState: Record<string, unknown> = {
        ...currentState,
        totalXP: currentTotalXp + toSafeInt(input.reward.xp),
        xp: currentTotalXp + toSafeInt(input.reward.xp),
        streak: nextStreak,
        lastStreakDate: nextLastStreakDate,
        activeDays: nextActiveDays,
        weeklyArena: nextWeeklyArena,
      };

      if (nextDailyRituals.length > 0) {
        nextXpState.dailyRituals = nextDailyRituals;
      }

      if (input.dailyCommentRewardState) {
        nextXpState.dailyCommentRewards = input.dailyCommentRewardState;
      }

      const resolvedMarks = resolveStoredProfileMarks(nextXpState);
      nextXpState.marks = resolvedMarks.marks;
      nextXpState.featuredMarks = resolvedMarks.featuredMarks;

      return {
        ok: true,
        wallet: nextWallet,
        xpState: nextXpState,
        result: {
          totalXP: readCurrentXp(nextXpState),
          streak: nextStreak,
          weeklyArena: nextWeeklyArena,
        },
      };
    },
  });

  if (!mutation.ok) {
    throw new Error('Failed to apply progression reward.');
  }

  return {
    totalXP: mutation.result.totalXP,
    streak: mutation.result.streak,
    wallet: mutation.wallet,
    xpState: mutation.xpState,
    weeklyArena: mutation.result.weeklyArena,
  };
};
