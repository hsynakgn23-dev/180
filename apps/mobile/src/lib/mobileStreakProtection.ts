import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { resolveSupabaseUserEmail } from './supabaseUser';
import { readProfileTotalXp, withMirroredProfileXp } from '../../../../src/domain/profileXpState';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  xp_state?: unknown;
};

type RitualTimestampRow = {
  timestamp?: string | null;
  created_at?: string | null;
};

export type MobileStreakProtectionWindow = 'at_risk' | 'restore';

export type MobileStreakProtectionStatus =
  | {
      mode: 'available';
      currentWeekKey: string;
      claimedWeekKey: string | null;
      protectedDate: string | null;
      targetDate: string;
      claimWindow: MobileStreakProtectionWindow;
    }
  | {
      mode: 'claimed';
      currentWeekKey: string;
      claimedWeekKey: string | null;
      protectedDate: string | null;
      targetDate: string | null;
      claimWindow: null;
    }
  | {
      mode: 'safe' | 'too_late' | 'unavailable';
      currentWeekKey: string;
      claimedWeekKey: string | null;
      protectedDate: string | null;
      targetDate: string | null;
      claimWindow: null;
    };

export type MobileStreakProtectionClaimInput = {
  fallbackDisplayName: string;
  fallbackTotalXp?: number;
  fallbackStreak?: number;
  fallbackLastRitualDate?: string | null;
  fallbackMarks?: string[];
  fallbackFeaturedMarks?: string[];
  fallbackFollowersCount?: number;
  ignoreWeeklyClaimLimit?: boolean;
};

export type MobileStreakProtectionClaimResult =
  | {
      ok: true;
      protectedDate: string;
      streak: number;
      weekKey: string;
      claimWindow: MobileStreakProtectionWindow;
    }
  | {
      ok: false;
      reason:
        | 'auth_required'
        | 'supabase_unavailable'
        | 'schema_missing'
        | 'already_claimed'
        | 'not_eligible'
        | 'unknown';
    };

const normalizeText = (value: unknown, maxLength = 120): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const sanitizeStringList = (value: unknown, maxItems = 420, itemLimit = 80): string[] => {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((entry) => normalizeText(entry, itemLimit))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, maxItems);
};

const sanitizeRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
};

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = normalizeText(error.code, 40).toUpperCase();
  const message = normalizeText(error.message, 220).toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501' || code === '42703') return true;
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('forbidden')
  );
};

const getLocalDateKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildWeekKey = (value = new Date()): string => {
  const copy = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const weekday = copy.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + diffToMonday);
  return getLocalDateKey(copy);
};

const parseDateKeyToDayIndex = (dateKey: string): number | null => {
  const parts = dateKey.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / (24 * 60 * 60 * 1000));
};

const addDaysToDateKey = (dateKey: string, amount: number): string | null => {
  const dayIndex = parseDateKeyToDayIndex(dateKey);
  if (dayIndex === null) return null;
  const next = new Date((dayIndex + amount) * 24 * 60 * 60 * 1000);
  return getLocalDateKey(next);
};

const normalizeDateKey = (value: unknown): string | null => {
  const text = normalizeText(value, 80);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateKey(parsed);
};

const sortDateKeysDesc = (dateKeys: string[]): string[] =>
  Array.from(
    new Set(dateKeys.map((dateKey) => normalizeDateKey(dateKey)).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => {
    const leftIndex = parseDateKeyToDayIndex(left) ?? 0;
    const rightIndex = parseDateKeyToDayIndex(right) ?? 0;
    return rightIndex - leftIndex;
  });

const computeCurrentStreak = (dateKeys: string[]): number => {
  const todayIndex = parseDateKeyToDayIndex(getLocalDateKey());
  if (todayIndex === null) return 0;

  const uniqueIndexes = Array.from(
    new Set(
      dateKeys
        .map((dateKey) => parseDateKeyToDayIndex(dateKey))
        .filter((value): value is number => value !== null)
    )
  ).sort((a, b) => b - a);

  if (uniqueIndexes.length === 0) return 0;
  const latest = uniqueIndexes[0];
  if (todayIndex - latest > 1) return 0;

  let streak = 1;
  let previous = latest;
  for (let index = 1; index < uniqueIndexes.length; index += 1) {
    const next = uniqueIndexes[index];
    if (previous - next !== 1) break;
    streak += 1;
    previous = next;
  }

  return streak;
};

const readRecentRitualDateKeys = async (userId: string): Promise<string[]> => {
  if (!supabase) return [];

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'timestamp', orderBy: 'timestamp' },
    { select: 'created_at', orderBy: 'created_at' },
  ];

  for (const variant of variants) {
    const { data, error } = await supabase
      .from('rituals')
      .select(variant.select)
      .eq('user_id', userId)
      .order(variant.orderBy, { ascending: false })
      .limit(420);

    if (error) {
      if (isSupabaseCapabilityError(error)) continue;
      return [];
    }

    const rows = Array.isArray(data) ? (data as RitualTimestampRow[]) : [];
    return sortDateKeysDesc(
      rows
        .map((row) => normalizeDateKey(row.timestamp || row.created_at))
        .filter((value): value is string => Boolean(value))
    );
  }

  return [];
};

const resolveLatestDailyRitualDate = (value: unknown): string | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const dates = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      return normalizeDateKey((entry as Record<string, unknown>).date);
    })
    .filter((date): date is string => Boolean(date));
  return sortDateKeysDesc(dates)[0] || null;
};

const resolveLatestDateKey = (...values: Array<string | null | undefined>): string | null =>
  sortDateKeysDesc(values.filter((value): value is string => Boolean(value)))[0] || null;

const resolveDisplayName = (
  profileRow: ProfileRow | null,
  currentState: Record<string, unknown>,
  fallbackDisplayName: string,
  userEmail: string
): string =>
  normalizeText(profileRow?.display_name, 120) ||
  normalizeText(currentState.fullName, 120) ||
  normalizeText(currentState.full_name, 120) ||
  normalizeText(currentState.username, 80) ||
  normalizeText(fallbackDisplayName, 120) ||
  normalizeText(userEmail.split('@')[0], 120) ||
  'Observer';

export const resolveMobileStreakProtectionState = (input: {
  streak: number;
  lastRitualDate?: string | null;
  claimedWeekKey?: string | null;
  protectedDate?: string | null;
  isSignedIn?: boolean;
  isPremium?: boolean;
}): MobileStreakProtectionStatus => {
  const currentWeekKey = buildWeekKey();
  const claimedWeekKey = normalizeText(input.claimedWeekKey, 40) || null;
  const protectedDate = normalizeDateKey(input.protectedDate) || null;
  const lastRitualDate = normalizeDateKey(input.lastRitualDate) || null;

  if (!input.isSignedIn || input.isPremium || !lastRitualDate || Math.max(0, Number(input.streak || 0)) <= 0) {
    return {
      mode: 'unavailable',
      currentWeekKey,
      claimedWeekKey,
      protectedDate,
      targetDate: null,
      claimWindow: null,
    };
  }

  if (claimedWeekKey === currentWeekKey) {
    return {
      mode: 'claimed',
      currentWeekKey,
      claimedWeekKey,
      protectedDate,
      targetDate: null,
      claimWindow: null,
    };
  }

  const today = getLocalDateKey();
  const todayIndex = parseDateKeyToDayIndex(today);
  const lastIndex = parseDateKeyToDayIndex(lastRitualDate);
  if (todayIndex === null || lastIndex === null) {
    return {
      mode: 'unavailable',
      currentWeekKey,
      claimedWeekKey,
      protectedDate,
      targetDate: null,
      claimWindow: null,
    };
  }

  const dayDiff = todayIndex - lastIndex;
  if (dayDiff <= 0) {
    return {
      mode: 'safe',
      currentWeekKey,
      claimedWeekKey,
      protectedDate,
      targetDate: null,
      claimWindow: null,
    };
  }

  if (dayDiff === 1) {
    return {
      mode: 'available',
      currentWeekKey,
      claimedWeekKey,
      protectedDate,
      targetDate: today,
      claimWindow: 'at_risk',
    };
  }

  if (dayDiff === 2) {
    const targetDate = addDaysToDateKey(lastRitualDate, 1);
    if (targetDate) {
      return {
        mode: 'available',
        currentWeekKey,
        claimedWeekKey,
        protectedDate,
        targetDate,
        claimWindow: 'restore',
      };
    }
  }

  return {
    mode: 'too_late',
    currentWeekKey,
    claimedWeekKey,
    protectedDate,
    targetDate: null,
    claimWindow: null,
  };
};

export const claimMobileStreakProtectionReward = async (
  input: MobileStreakProtectionClaimInput
): Promise<MobileStreakProtectionClaimResult> => {
  if (!isSupabaseLive() || !supabase) {
    return { ok: false, reason: 'supabase_unavailable' };
  }

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 120);
  const userEmail = resolveSupabaseUserEmail(sessionResult.session?.user);
  if (!userId) {
    return { ok: false, reason: 'auth_required' };
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('display_name,xp_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      reason: isSupabaseCapabilityError(profileError) ? 'schema_missing' : 'unknown',
    };
  }

  const profileRow = (profileData || null) as ProfileRow | null;
  const currentState = sanitizeRecord(profileRow?.xp_state);
  const timelineDateKeys = await readRecentRitualDateKeys(userId);
  const dailyRitualDates = Array.isArray(currentState.dailyRituals)
    ? (currentState.dailyRituals as unknown[])
        .map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
          return normalizeDateKey((entry as Record<string, unknown>).date);
        })
        .filter((value): value is string => Boolean(value))
    : [];
  const activeDays = sortDateKeysDesc([
    ...sanitizeStringList(currentState.activeDays, 420, 40),
    ...timelineDateKeys,
    ...dailyRitualDates,
  ]);
  const effectiveLastRitualDate = resolveLatestDateKey(
    resolveLatestDailyRitualDate(currentState.dailyRituals),
    activeDays[0] || null,
    normalizeDateKey(currentState.lastStreakDate),
    normalizeDateKey(currentState.lastStreakProtectionDate),
    normalizeDateKey(input.fallbackLastRitualDate)
  );
  const currentStreak = Math.max(
    toSafeInt(currentState.streak),
    toSafeInt(input.fallbackStreak),
    computeCurrentStreak(activeDays)
  );
  const protectionState = resolveMobileStreakProtectionState({
    streak: currentStreak,
    lastRitualDate: effectiveLastRitualDate,
    claimedWeekKey: input.ignoreWeeklyClaimLimit
      ? null
      : normalizeText(currentState.lastStreakProtectionWeekKey, 40) || null,
    protectedDate: input.ignoreWeeklyClaimLimit
      ? null
      : normalizeText(currentState.lastStreakProtectionDate, 40) || null,
    isSignedIn: true,
    isPremium: false,
  });

  if (protectionState.mode === 'claimed') {
    return { ok: false, reason: 'already_claimed' };
  }

  if (protectionState.mode !== 'available') {
    return { ok: false, reason: 'not_eligible' };
  }

  const targetDate = protectionState.targetDate;
  const nextActiveDays = sortDateKeysDesc([...activeDays, targetDate]);
  const nextStreak = Math.max(currentStreak, computeCurrentStreak(nextActiveDays));
  const marks = sanitizeStringList(currentState.marks, 160, 80);
  const fallbackMarks = sanitizeStringList(input.fallbackMarks, 160, 80);
  const nextMarks = marks.length > 0 ? marks : fallbackMarks;
  const featuredMarksBase = sanitizeStringList(currentState.featuredMarks, 8, 80);
  const fallbackFeaturedMarks = sanitizeStringList(input.fallbackFeaturedMarks, 8, 80);
  const nextFeaturedMarks = (featuredMarksBase.length > 0 ? featuredMarksBase : fallbackFeaturedMarks).filter(
    (markId) => nextMarks.includes(markId)
  );
  const displayName = resolveDisplayName(profileRow, currentState, input.fallbackDisplayName, userEmail);
  const nowIso = new Date().toISOString();
  const nextTotalXp = Math.max(readProfileTotalXp(currentState), toSafeInt(input.fallbackTotalXp));
  const nextState: Record<string, unknown> = withMirroredProfileXp({
    ...currentState,
    activeDays: nextActiveDays,
    streak: nextStreak,
    lastStreakDate: resolveLatestDateKey(normalizeDateKey(currentState.lastStreakDate), targetDate),
    lastStreakProtectionWeekKey: input.ignoreWeeklyClaimLimit
      ? normalizeText(currentState.lastStreakProtectionWeekKey, 40) || null
      : protectionState.currentWeekKey,
    lastStreakProtectionDate: targetDate,
    lastStreakProtectionClaimedAt: nowIso,
    marks: nextMarks,
    featuredMarks: nextFeaturedMarks,
    followers: Math.max(toSafeInt(currentState.followers), toSafeInt(input.fallbackFollowersCount)),
    following: Array.isArray(currentState.following) ? currentState.following : [],
    fullName:
      normalizeText(currentState.fullName, 120) ||
      normalizeText(currentState.full_name, 120) ||
      displayName,
    full_name:
      normalizeText(currentState.full_name, 120) ||
      normalizeText(currentState.fullName, 120) ||
      displayName,
    username: normalizeText(currentState.username, 80) || normalizeText(displayName, 80).replace(/\s+/g, '').toLowerCase(),
  }, nextTotalXp);

  const { error: writeError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      email: userEmail || null,
      display_name: displayName,
      xp_state: nextState,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  if (writeError) {
    return {
      ok: false,
      reason: isSupabaseCapabilityError(writeError) ? 'schema_missing' : 'unknown',
    };
  }

  return {
    ok: true,
    protectedDate: targetDate,
    streak: nextStreak,
    weekKey: protectionState.currentWeekKey,
    claimWindow: protectionState.claimWindow,
  };
};
