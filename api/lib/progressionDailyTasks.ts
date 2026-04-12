import {
  findWalletDailyTask,
  isWalletDailyTaskKey,
  WALLET_DAILY_TASKS,
  type WalletDailyTaskKey,
  type WalletDailyTaskSnapshot,
} from '../../src/domain/walletDailyTasks.js';
import {
  loadWalletProfile,
  mutateWalletProfile,
  type ProgressionWalletState,
} from './progressionWallet.js';

type SupabaseClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type WalletDailyTaskClaimLog = {
  dateKey: string | null;
  claimedKeys: WalletDailyTaskKey[];
};

type WalletDailyTaskProgress = {
  completedDailyMovies: number;
  rewardableDailyComments: number;
  sideQuizPlays: number;
};

const DAILY_ROLLOVER_TIMEZONE = 'Europe/Istanbul';

const toSafeInt = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
};

const normalizeText = (value: unknown, maxLength = 160): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const sanitizeRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
};

const getDateKeyFromFormatter = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_ROLLOVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
};

const getLocalDayRange = (dateKey: string): { startIso: string; endIso: string } => {
  // Istanbul is UTC+3 without daylight saving for our daily rollover.
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const startUtcMs = Date.UTC(year, month - 1, day, -3, 0, 0, 0);
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
};

const normalizeDailyTaskClaimLog = (
  value: unknown,
  dateKey: string
): WalletDailyTaskClaimLog => {
  const raw = sanitizeRecord(value);
  if (normalizeText(raw.dateKey, 40) !== dateKey) {
    return {
      dateKey,
      claimedKeys: [],
    };
  }
  return {
    dateKey,
    claimedKeys: Array.from(
      new Set(
        (Array.isArray(raw.claimedKeys) ? raw.claimedKeys : [])
          .filter(isWalletDailyTaskKey)
      )
    ),
  };
};

const countDailyCommentsFromXpState = (
  xpState: Record<string, unknown>,
  dateKey: string
): number => {
  const dailyCommentRewards = sanitizeRecord(xpState.dailyCommentRewards);
  if (normalizeText(dailyCommentRewards.dateKey, 40) === dateKey) {
    return Math.min(
      5,
      (Array.isArray(dailyCommentRewards.rewardedMovieKeys)
        ? dailyCommentRewards.rewardedMovieKeys
        : []
      ).filter(Boolean).length
    );
  }

  const dailyRituals = Array.isArray(xpState.dailyRituals) ? xpState.dailyRituals : [];
  return Math.min(
    5,
    dailyRituals.filter((entry) => {
      const ritual = sanitizeRecord(entry);
      return normalizeText(ritual.date, 40) === dateKey && Boolean(normalizeText(ritual.text, 20));
    }).length
  );
};

const readDailyQuizCompletedMovieCount = async (
  supabase: SupabaseClientLike,
  userId: string,
  dateKey: string
): Promise<number> => {
  const { data } = await supabase
    .from('daily_quiz_user_progress')
    .select('completed_movie_ids')
    .eq('batch_date', dateKey)
    .eq('user_id', userId)
    .maybeSingle();

  const ids = Array.isArray(data?.completed_movie_ids) ? data.completed_movie_ids : [];
  return Math.min(5, ids.filter((id: unknown) => toSafeInt(id) > 0).length);
};

const readSideQuizPlays = async (
  supabase: SupabaseClientLike,
  userId: string,
  dateKey: string
): Promise<number> => {
  const { startIso, endIso } = getLocalDayRange(dateKey);

  const safeCount = async (read: () => Promise<{ count?: number | null }>): Promise<number> => {
    try {
      const result = await read();
      return Math.max(0, Number(result.count) || 0);
    } catch {
      return 0;
    }
  };

  const [rushCount, blurCount, poolCount] = await Promise.all([
    safeCount(async () => {
      const { count } = await supabase
        .from('quiz_rush_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['completed', 'expired'])
        .gte('completed_at', startIso)
        .lt('completed_at', endIso);
      return { count };
    }),
    safeCount(async () => {
      const { count } = await supabase
        .from('blur_quiz_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('updated_at', startIso)
        .lt('updated_at', endIso);
      return { count };
    }),
    safeCount(async () => {
      const { count } = await supabase
        .from('movie_pool_user_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('updated_at', startIso)
        .lt('updated_at', endIso);
      return { count };
    }),
  ]);

  return Math.min(1, rushCount + blurCount + poolCount);
};

const buildDailyTaskSnapshot = (input: {
  progress: WalletDailyTaskProgress;
  claims: WalletDailyTaskClaimLog;
}): WalletDailyTaskSnapshot[] =>
  WALLET_DAILY_TASKS.map((task) => {
    const progress =
      task.key === 'check_in'
        ? 1
        : task.key === 'daily_first_movie'
          ? Math.min(1, input.progress.completedDailyMovies)
          : task.key === 'daily_five_movies'
            ? input.progress.completedDailyMovies
            : task.key === 'daily_comment'
              ? Math.min(1, input.progress.rewardableDailyComments)
              : Math.min(1, input.progress.sideQuizPlays);
    const claimed = input.claims.claimedKeys.includes(task.key);
    const ready = progress >= task.target;
    return {
      key: task.key,
      title: task.title,
      description: task.description,
      ticketReward: task.ticketReward,
      progress: Math.min(task.target, progress),
      target: task.target,
      status: claimed ? 'claimed' : ready ? 'ready' : 'locked',
    };
  });

export const readWalletDailyTasks = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  date?: Date;
}): Promise<WalletDailyTaskSnapshot[]> => {
  const dateKey = getDateKeyFromFormatter(input.date || new Date());
  const loaded = await loadWalletProfile({
    supabase: input.supabase,
    userId: input.userId,
  });
  const claims = normalizeDailyTaskClaimLog(loaded.xpState.walletDailyTasks, dateKey);
  const [completedDailyMovies, sideQuizPlays] = await Promise.all([
    readDailyQuizCompletedMovieCount(input.supabase, input.userId, dateKey).catch(() => 0),
    readSideQuizPlays(input.supabase, input.userId, dateKey),
  ]);

  return buildDailyTaskSnapshot({
    claims,
    progress: {
      completedDailyMovies,
      rewardableDailyComments: countDailyCommentsFromXpState(loaded.xpState, dateKey),
      sideQuizPlays,
    },
  });
};

export const claimWalletDailyTask = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  taskKey: WalletDailyTaskKey;
  date?: Date;
}): Promise<
  | { ok: true; wallet: ProgressionWalletState; granted: number; dailyTasks: WalletDailyTaskSnapshot[] }
  | { ok: false; reason: 'invalid_task' | 'not_ready' | 'already_claimed'; wallet: ProgressionWalletState; dailyTasks: WalletDailyTaskSnapshot[] }
> => {
  const task = findWalletDailyTask(input.taskKey);
  if (!task) {
    const loaded = await loadWalletProfile({ supabase: input.supabase, userId: input.userId });
    const dailyTasks = await readWalletDailyTasks({ supabase: input.supabase, userId: input.userId, date: input.date });
    return { ok: false, reason: 'invalid_task', wallet: loaded.wallet, dailyTasks };
  }

  const date = input.date || new Date();
  const dateKey = getDateKeyFromFormatter(date);
  const dailyTasks = await readWalletDailyTasks({ supabase: input.supabase, userId: input.userId, date });
  const taskSnapshot = dailyTasks.find((entry) => entry.key === task.key) || null;
  if (taskSnapshot?.status === 'claimed') {
    const loaded = await loadWalletProfile({ supabase: input.supabase, userId: input.userId });
    return { ok: false, reason: 'already_claimed', wallet: loaded.wallet, dailyTasks };
  }
  if (taskSnapshot?.status !== 'ready') {
    const loaded = await loadWalletProfile({ supabase: input.supabase, userId: input.userId });
    return { ok: false, reason: 'not_ready', wallet: loaded.wallet, dailyTasks };
  }

  const mutation = await mutateWalletProfile<number, 'already_claimed'>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      const currentState = { ...loaded.xpState };
      const claims = normalizeDailyTaskClaimLog(currentState.walletDailyTasks, dateKey);
      if (claims.claimedKeys.includes(task.key)) {
        return { ok: false, reason: 'already_claimed' };
      }
      const nextClaims: WalletDailyTaskClaimLog = {
        dateKey,
        claimedKeys: [...claims.claimedKeys, task.key],
      };

      return {
        ok: true,
        wallet: {
          ...loaded.wallet,
          balance: loaded.wallet.balance + task.ticketReward,
          lifetimeEarned: loaded.wallet.lifetimeEarned + task.ticketReward,
        },
        xpState: {
          ...currentState,
          walletDailyTasks: nextClaims,
        },
        result: task.ticketReward,
      };
    },
  });

  if (!mutation.ok) {
    const nextDailyTasks = await readWalletDailyTasks({ supabase: input.supabase, userId: input.userId, date });
    return {
      ok: false,
      reason: mutation.reason,
      wallet: mutation.wallet,
      dailyTasks: nextDailyTasks,
    };
  }

  return {
    ok: true,
    wallet: mutation.wallet,
    granted: mutation.result,
    dailyTasks: await readWalletDailyTasks({ supabase: input.supabase, userId: input.userId, date }),
  };
};
