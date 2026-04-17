import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { resolveSupabaseUserEmail } from './supabaseUser';
import {
  resolveMobileLeagueInfoFromXp,
  resolveMobileNextLeagueKey,
  resolveMobileLeagueInfo,
} from './mobileLeagueSystem';
import { getCurrentWeekKey, normalizeWeeklyArenaState } from '../../../../src/domain/progressionRewards';
import { resolveStoredProfileMarks } from '../../../../src/domain/profileMarks';
import { readProfileTotalXp } from '../../../../src/domain/profileXpState';
import {
  readProfileDaysPresentCount,
  readProfileFollowersCount,
  readProfileFollowingCount,
  readProfileLastRitualDate,
  readProfileRitualCount,
} from '../../../../src/domain/profileSocialState';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type ProfileXpState = Record<string, unknown>;

type ProfileRow = {
  display_name?: string | null;
  xp_state?: ProfileXpState | null;
};

type RitualTimestampRow = {
  timestamp?: string | null;
  created_at?: string | null;
};

export type MobileProfileStats = {
  displayName: string;
  totalXp: number;
  leagueKey: string;
  leagueName: string;
  leagueColor: string;
  nextLeagueKey: string | null;
  nextLeagueName: string | null;
  streak: number;
  weeklyArenaScore: number;
  weeklyArenaActivity: number;
  ritualsCount: number;
  daysPresent: number;
  followersCount: number;
  followingCount: number;
  marks: string[];
  featuredMarks: string[];
  lastRitualDate: string | null;
  streakProtectionWeekKey: string | null;
  streakProtectionDate: string | null;
  streakProtectionClaimedAt: string | null;
  source: 'xp_state' | 'fallback';
};

export type MobileProfileStatsResult =
  | { ok: true; stats: MobileProfileStats }
  | { ok: false; message: string };

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

const sanitizeStringList = (value: unknown, maxItems = 120): string[] => {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((entry) => normalizeText(entry, 80))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, maxItems);
};

const sortDateKeysDesc = (dateKeys: string[]): string[] =>
  Array.from(new Set(dateKeys))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort((left, right) => {
      const leftIndex = parseDateKeyToDayIndex(left) ?? 0;
      const rightIndex = parseDateKeyToDayIndex(right) ?? 0;
      return rightIndex - leftIndex;
    });

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501') return true;
  return (
    message.includes('relation "') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('jwt') ||
    message.includes('forbidden')
  );
};

const getLocalDateKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKeyToDayIndex = (dateKey: string): number | null => {
  const parts = dateKey.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / (24 * 60 * 60 * 1000));
};

const parseIsoToDateKey = (value: unknown): string | null => {
  const text = normalizeText(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateKey(parsed);
};

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
  let prev = latest;
  for (let i = 1; i < uniqueIndexes.length; i += 1) {
    const next = uniqueIndexes[i];
    if (prev - next === 1) {
      streak += 1;
      prev = next;
      continue;
    }
    break;
  }
  return streak;
};

const readFollowCounts = async (
  userId: string
): Promise<{ followersCount: number | null; followingCount: number | null }> => {
  if (!supabase) {
    return { followersCount: null, followingCount: null };
  }

  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from('user_follows')
      .select('follower_user_id', { head: true, count: 'exact' })
      .eq('followed_user_id', userId),
    supabase
      .from('user_follows')
      .select('followed_user_id', { head: true, count: 'exact' })
      .eq('follower_user_id', userId),
  ]);

  const followersCount =
    followersRes.error && isSupabaseCapabilityError(followersRes.error)
      ? null
      : Math.max(0, Number(followersRes.count || 0));
  const followingCount =
    followingRes.error && isSupabaseCapabilityError(followingRes.error)
      ? null
      : Math.max(0, Number(followingRes.count || 0));

  return {
    followersCount,
    followingCount,
  };
};

const readRitualTimeline = async (
  userId: string
): Promise<{ dateKeys: string[]; ritualsCount: number | null; lastRitualDate: string | null }> => {
  if (!supabase) {
    return { dateKeys: [], ritualsCount: null, lastRitualDate: null };
  }

  const { count, error: countError } = await supabase
    .from('rituals')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId);
  const countAvailable = !countError;

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'timestamp', orderBy: 'timestamp' },
    { select: 'created_at', orderBy: 'created_at' },
  ];

  let rows: RitualTimestampRow[] = [];
  let rowsAvailable = false;
  for (const variant of variants) {
    const { data, error } = await supabase
      .from('rituals')
      .select(variant.select)
      .eq('user_id', userId)
      .order(variant.orderBy, { ascending: false })
      .limit(420);

    if (error) {
      if (isSupabaseCapabilityError(error)) continue;
      break;
    }

    rows = Array.isArray(data) ? (data as RitualTimestampRow[]) : [];
    rowsAvailable = true;
    break;
  }

  const dateKeys = rows
    .map((row) => parseIsoToDateKey(row.timestamp || row.created_at))
    .filter((value): value is string => Boolean(value));
  const lastRitualDate = rowsAvailable ? dateKeys[0] || null : null;

  return {
    dateKeys,
    ritualsCount: countAvailable ? Math.max(0, Number(count || 0)) : rowsAvailable ? dateKeys.length : null,
    lastRitualDate,
  };
};

const parseStatsFromXpState = (
  xpState: ProfileXpState | null | undefined
): {
  displayNameCandidate: string;
  totalXp: number;
  streak: number;
  weeklyArenaScore: number;
  weeklyArenaActivity: number;
  ritualsCount: number;
  daysPresent: number;
  followersCount: number;
  followingCount: number;
  marks: string[];
  featuredMarks: string[];
  lastRitualDate: string | null;
  streakProtectionWeekKey: string | null;
  streakProtectionDate: string | null;
  streakProtectionClaimedAt: string | null;
} | null => {
  if (!xpState || typeof xpState !== 'object' || Array.isArray(xpState)) return null;

  const displayNameCandidate =
    normalizeText(xpState.username, 80) || normalizeText(xpState.fullName, 80) || '';
  const totalXp = readProfileTotalXp(xpState);
  const weeklyArena = normalizeWeeklyArenaState(xpState.weeklyArena, getCurrentWeekKey(new Date()));
  const dailyRituals = Array.isArray(xpState.dailyRituals) ? xpState.dailyRituals : [];
  const dailyRitualDates = sortDateKeysDesc(
    dailyRituals
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        return normalizeText((entry as Record<string, unknown>).date, 40) || null;
      })
      .filter((value): value is string => Boolean(value))
  );
  const activeDays = sortDateKeysDesc(sanitizeStringList(xpState.activeDays, 420));
  const streakSeed = activeDays.length > 0 ? activeDays : dailyRitualDates;
  const streak = Math.max(toSafeInt(xpState.streak), computeCurrentStreak(streakSeed));
  const { marks, featuredMarks } = resolveStoredProfileMarks(xpState);
  const streakProtectionDate = normalizeText(xpState.lastStreakProtectionDate, 40) || null;
  const lastRitualDate = readProfileLastRitualDate(xpState) || streakProtectionDate;

  return {
    displayNameCandidate,
    totalXp,
    streak,
    weeklyArenaScore: weeklyArena.score,
    weeklyArenaActivity: weeklyArena.activityCount,
    ritualsCount: readProfileRitualCount(xpState),
    daysPresent: readProfileDaysPresentCount(xpState),
    followersCount: readProfileFollowersCount(xpState),
    followingCount: readProfileFollowingCount(xpState),
    marks,
    featuredMarks,
    lastRitualDate,
    streakProtectionWeekKey: normalizeText(xpState.lastStreakProtectionWeekKey, 40) || null,
    streakProtectionDate,
    streakProtectionClaimedAt: normalizeText(xpState.lastStreakProtectionClaimedAt, 80) || null,
  };
};

export const fetchMobileProfileStats = async (): Promise<MobileProfileStatsResult> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 80);
  const userEmail = resolveSupabaseUserEmail(sessionResult.session?.user);
  if (!userId) {
    return {
      ok: false,
      message: 'Profil istatistikleri icin once giris yap.',
    };
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('display_name,xp_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError && !isSupabaseCapabilityError(profileError)) {
    return {
      ok: false,
      message: normalizeText(profileError.message, 220) || 'Profil okunamadi.',
    };
  }

  const profileRow = (profileData || null) as ProfileRow | null;
  const xpStats = parseStatsFromXpState(profileRow?.xp_state || null);
  const followCounts = await readFollowCounts(userId);
  const timeline = await readRitualTimeline(userId);

  const displayNameBase =
    (xpStats && xpStats.displayNameCandidate) ||
    normalizeText(profileRow?.display_name, 80) ||
    normalizeText(userEmail.split('@')[0], 80) ||
    'Observer';

  if (xpStats) {
    const resolvedFollowersCount =
      typeof followCounts.followersCount === 'number'
        ? followCounts.followersCount
        : xpStats.followersCount;
    const resolvedFollowingCount =
      typeof followCounts.followingCount === 'number'
        ? followCounts.followingCount
        : xpStats.followingCount;
    const uniqueTimelineDays = Array.from(new Set(timeline.dateKeys));
    const resolvedRitualsCount =
      typeof timeline.ritualsCount === 'number'
        ? timeline.ritualsCount
        : xpStats.ritualsCount;
    const resolvedDaysPresent =
      uniqueTimelineDays.length > 0 || timeline.ritualsCount === 0
        ? uniqueTimelineDays.length
        : xpStats.daysPresent;
    const resolvedLastRitualDate = timeline.lastRitualDate || xpStats.lastRitualDate;

    const { leagueKey, leagueInfo } = resolveMobileLeagueInfoFromXp(xpStats.totalXp);
    const nextLeagueKey = resolveMobileNextLeagueKey(leagueKey);
    const nextLeagueName = nextLeagueKey ? resolveMobileLeagueInfo(nextLeagueKey).name : null;
    return {
      ok: true,
      stats: {
        displayName: displayNameBase,
        totalXp: xpStats.totalXp,
        leagueKey,
        leagueName: leagueInfo.name,
        leagueColor: leagueInfo.color,
        nextLeagueKey,
        nextLeagueName,
        streak: xpStats.streak,
        weeklyArenaScore: xpStats.weeklyArenaScore,
        weeklyArenaActivity: xpStats.weeklyArenaActivity,
        ritualsCount: resolvedRitualsCount,
        daysPresent: resolvedDaysPresent,
        followersCount: resolvedFollowersCount,
        followingCount: resolvedFollowingCount,
        marks: xpStats.marks,
        featuredMarks: xpStats.featuredMarks,
        lastRitualDate: resolvedLastRitualDate,
        streakProtectionWeekKey: xpStats.streakProtectionWeekKey,
        streakProtectionDate: xpStats.streakProtectionDate,
        streakProtectionClaimedAt: xpStats.streakProtectionClaimedAt,
        source: 'xp_state',
      },
    };
  }

  const uniqueDays = Array.from(new Set(timeline.dateKeys));
  const { leagueKey, leagueInfo } = resolveMobileLeagueInfoFromXp(0);
  const nextLeagueKey = resolveMobileNextLeagueKey(leagueKey);
  const nextLeagueName = nextLeagueKey ? resolveMobileLeagueInfo(nextLeagueKey).name : null;
  return {
    ok: true,
    stats: {
      displayName: displayNameBase,
      totalXp: 0,
      leagueKey,
      leagueName: leagueInfo.name,
      leagueColor: leagueInfo.color,
      nextLeagueKey,
      nextLeagueName,
      streak: computeCurrentStreak(uniqueDays),
      weeklyArenaScore: 0,
      weeklyArenaActivity: 0,
      ritualsCount: Math.max(0, Number(timeline.ritualsCount || 0)),
      daysPresent: uniqueDays.length,
      followersCount: Math.max(0, Number(followCounts.followersCount || 0)),
      followingCount: Math.max(0, Number(followCounts.followingCount || 0)),
      marks: [],
      featuredMarks: [],
      lastRitualDate: timeline.lastRitualDate,
      streakProtectionWeekKey: null,
      streakProtectionDate: null,
      streakProtectionClaimedAt: null,
      source: 'fallback',
    },
  };
};
