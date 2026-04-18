import {
  getCurrentWeekKey,
  normalizeDailyCommentRewardState,
  normalizeWeeklyArenaState,
  type DailyCommentRewardState,
  type ProgressionRewardGrant,
  type WeeklyArenaState,
} from '../../src/domain/progressionRewards.js';
import {
  readProfileTotalXp,
  withMirroredProfileXp,
} from '../../src/domain/profileXpState.js';
import { resolveLeagueKeyFromXp } from '../../src/domain/leagueSystem.js';
import {
  loadWalletProfile,
  mutateWalletProfile,
  type ProgressionWalletState,
} from './progressionWallet.js';
import { resolveStoredProfileMarks } from '../../src/domain/profileMarks.js';
import { recordProgressionRewardLedger } from './progressionLedger.js';

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

const MAX_REWARD_MUTATION_KEYS = 120;

const normalizeRewardMutationKey = (value: unknown): string =>
  normalizeText(value, 160);

const readProcessedRewardKeys = (
  xpState: Record<string, unknown>,
  maxItems = MAX_REWARD_MUTATION_KEYS
): string[] =>
  Array.from(
    new Set(
      (Array.isArray(xpState.rewardMutationKeys) ? xpState.rewardMutationKeys : [])
        .map((entry) => normalizeRewardMutationKey(entry))
        .filter((entry): entry is string => Boolean(entry))
    )
  ).slice(-maxItems);

const appendProcessedRewardKey = (keys: string[], key: string): string[] =>
  Array.from(new Set([...keys, key])).slice(-MAX_REWARD_MUTATION_KEYS);

const deriveNextStreak = (currentStreak: number, previousDateKey: string | null, nextDateKey: string): number => {
  if (previousDateKey === nextDateKey) return Math.max(1, currentStreak);
  const currentDayIndex = parseDateKeyToDayIndex(nextDateKey);
  const previousDayIndex = previousDateKey ? parseDateKeyToDayIndex(previousDateKey) : null;
  if (currentDayIndex === null) {
    return { nextStreak: Math.max(1, currentStreak), shieldConsumed: false, gapDays: 0 };
  }
  if (previousDayIndex === null) {
    return { nextStreak: 1, shieldConsumed: false, gapDays: 0 };
  }
  const gap = currentDayIndex - previousDayIndex;
  if (gap === 1) {
    return { nextStreak: Math.max(1, currentStreak) + 1, shieldConsumed: false, gapDays: gap };
  }
  if (gap === 0) {
    return { nextStreak: Math.max(1, currentStreak), shieldConsumed: false, gapDays: gap };
  }
  // Gap > 1 — streak would normally reset.
  // A shield can repair a single missed day (gap === 2).
  if (gap === 2 && shieldsAvailable > 0) {
    return {
      nextStreak: Math.max(1, currentStreak) + 1,
      shieldConsumed: true,
      gapDays: gap,
    };
  }
  return { nextStreak: 1, shieldConsumed: false, gapDays: gap };
};

const readCurrentXp = (xpState: Record<string, unknown>): number =>
  readProfileTotalXp(xpState);

const resolveProgressionLedgerSource = (input: {
  isCommentReward?: boolean;
  isQuizReward?: boolean;
  source?: string | null;
}): string => {
  const explicit = normalizeText(input.source, 80);
  if (explicit) return explicit;
  if (input.isCommentReward) return 'daily_comment_reward';
  if (input.isQuizReward) return 'quiz_reward';
  return 'progression_reward';
};

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
  idempotencyKey?: string | null;
  ledger?: {
    source?: string | null;
    sourceId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
    eventKey?: string | null;
  } | null;
}): Promise<{
  totalXP: number;
  streak: number;
  wallet: ProgressionWalletState;
  xpState: Record<string, unknown>;
  weeklyArena: WeeklyArenaState;
  applied: boolean;
}> => {
  const now = input.now || new Date();
  const nowIso = now.toISOString();
  const mutation = await mutateWalletProfile<{
    totalXP: number;
    streak: number;
    weeklyArena: WeeklyArenaState;
    applied: boolean;
  }, never>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      const currentState = { ...loaded.xpState };
      const currentTotalXp = readCurrentXp(currentState);
      const weeklyArena = readWeeklyArenaState(currentState, now);
      const currentStreak = toSafeInt(currentState.streak);
      const rewardMutationKey = normalizeRewardMutationKey(input.idempotencyKey);
      const processedRewardKeys = readProcessedRewardKeys(currentState);

      if (rewardMutationKey && processedRewardKeys.includes(rewardMutationKey)) {
        return {
          ok: true,
          wallet: loaded.wallet,
          xpState: currentState,
          result: {
            totalXP: currentTotalXp,
            streak: currentStreak,
            weeklyArena,
            applied: false,
          },
          persist: false,
        };
      }

      const nextWeeklyArena: WeeklyArenaState = {
        ...weeklyArena,
        cohortLeagueKey: weeklyArena.cohortLeagueKey || resolveLeagueKeyFromXp(currentTotalXp),
        score: weeklyArena.score + toSafeInt(input.reward.arenaScore),
        activityCount: weeklyArena.activityCount + toSafeInt(input.reward.arenaActivity),
        commentRewards: weeklyArena.commentRewards + (input.isCommentReward ? 1 : 0),
        quizRewards: weeklyArena.quizRewards + (input.isQuizReward ? 1 : 0),
        updatedAt: nowIso,
      };

      const nextWallet: ProgressionWalletState = {
        ...loaded.wallet,
        balance: loaded.wallet.balance + toSafeInt(input.reward.tickets),
        lifetimeEarned: loaded.wallet.lifetimeEarned + toSafeInt(input.reward.tickets),
      };

      let nextStreak = currentStreak;
      let nextLastStreakDate = normalizeDateKey(currentState.lastStreakDate);
      let nextActiveDays = sanitizeDateKeys(currentState.activeDays);
      let shieldConsumed = false;
      const activeDateKey = normalizeDateKey(input.markActiveDateKey);
      if (activeDateKey) {
        const shieldsAvailable = toSafeInt(loaded.wallet.inventory.streak_shield);
        const update = deriveNextStreak(prevStreak, nextLastStreakDate, activeDateKey, shieldsAvailable);
        nextStreak = update.nextStreak;
        shieldConsumed = update.shieldConsumed;
        nextLastStreakDate = activeDateKey;
        nextActiveDays = sanitizeDateKeys([...nextActiveDays, activeDateKey]);
      }

      // Evaluate streak milestone rewards (one-time per run, idempotent)
      const milestoneState = normalizeStreakMilestoneState(currentState.streakMilestones);
      const milestoneEval = evaluateStreakMilestones({
        prevStreak,
        nextStreak,
        prevState: milestoneState,
        nowIso,
      });

      const nextWallet: ProgressionWalletState = {
        ...loaded.wallet,
        balance:
          loaded.wallet.balance
          + toSafeInt(input.reward.tickets)
          + milestoneEval.totalReward.tickets,
        lifetimeEarned:
          loaded.wallet.lifetimeEarned
          + toSafeInt(input.reward.tickets)
          + milestoneEval.totalReward.tickets,
        inventory: {
          ...loaded.wallet.inventory,
          streak_shield: Math.max(
            0,
            toSafeInt(loaded.wallet.inventory.streak_shield) - (shieldConsumed ? 1 : 0)
          ),
        },
      };

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

      let nextXpState: Record<string, unknown> = {
        ...currentState,
        streak: nextStreak,
        lastStreakDate: nextLastStreakDate,
        activeDays: nextActiveDays,
        weeklyArena: nextWeeklyArena,
        streakMilestones: milestoneEval.nextState,
      };
      nextXpState = withMirroredProfileXp(nextXpState, currentTotalXp + toSafeInt(input.reward.xp));

      if (nextDailyRituals.length > 0) {
        nextXpState.dailyRituals = nextDailyRituals;
      }

      if (input.dailyCommentRewardState) {
        nextXpState.dailyCommentRewards = input.dailyCommentRewardState;
      }

      const resolvedMarks = resolveStoredProfileMarks(nextXpState);
      nextXpState.marks = resolvedMarks.marks;
      nextXpState.featuredMarks = resolvedMarks.featuredMarks;

      if (rewardMutationKey) {
        nextXpState.rewardMutationKeys = appendProcessedRewardKey(processedRewardKeys, rewardMutationKey);
      }

      return {
        ok: true,
        wallet: nextWallet,
        xpState: nextXpState,
        result: {
          totalXP: readCurrentXp(nextXpState),
          streak: nextStreak,
          weeklyArena: nextWeeklyArena,
          applied: true,
        },
      };
    },
  });

  if (!mutation.ok) {
    throw new Error('Failed to apply progression reward.');
  }

  if (mutation.result.applied) {
    const ledgerMetadata = {
      ...(input.ledger?.metadata || {}),
      isCommentReward: input.isCommentReward ? true : undefined,
      isQuizReward: input.isQuizReward ? true : undefined,
      markActiveDateKey: normalizeDateKey(input.markActiveDateKey) || undefined,
      dailyRitualDate: normalizeDateKey(input.dailyRitualEntry?.date) || undefined,
      dailyRitualMovieTitle: normalizeText(input.dailyRitualEntry?.movieTitle, 220) || undefined,
    };

    await recordProgressionRewardLedger({
      supabase: input.supabase,
      userId: input.userId,
      source: resolveProgressionLedgerSource({
        isCommentReward: input.isCommentReward,
        isQuizReward: input.isQuizReward,
        source: input.ledger?.source,
      }),
      sourceId: normalizeText(input.ledger?.sourceId, 160) || null,
      reason: normalizeText(input.ledger?.reason, 160) || null,
      xpDelta: toSafeInt(input.reward.xp),
      totalXpAfter: mutation.result.totalXP,
      ticketDelta: toSafeInt(input.reward.tickets),
      walletBalanceAfter: mutation.wallet.balance,
      arenaDelta: toSafeInt(input.reward.arenaScore),
      arenaActivityDelta: toSafeInt(input.reward.arenaActivity),
      arenaTotalAfter: mutation.result.weeklyArena.score,
      arenaWeekKey: mutation.result.weeklyArena.weekKey ?? '',
      metadata: ledgerMetadata,
      eventKey:
        normalizeText(input.ledger?.eventKey, 240) ||
        normalizeRewardMutationKey(input.idempotencyKey) ||
        null,
    });
  }

  return {
    totalXP: mutation.result.totalXP,
    streak: mutation.result.streak,
    wallet: mutation.wallet,
    xpState: mutation.xpState,
    weeklyArena: mutation.result.weeklyArena,
    applied: mutation.result.applied,
  };
};
