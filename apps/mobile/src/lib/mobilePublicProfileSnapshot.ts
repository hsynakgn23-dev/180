import { isSupabaseLive, supabase } from './supabase';
import {
  readMobileProfileVisibilityFromXpState,
  type MobileProfileVisibility,
} from './mobileProfileVisibility';
import { resolveMobileAvatarFromXpState } from './mobileAvatar';
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

export type MobilePublicProfileSnapshot = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  totalXp: number;
  streak: number;
  ritualsCount: number;
  daysPresent: number;
  followersCount: number;
  followingCount: number;
  marks: string[];
  featuredMarks: string[];
  lastRitualDate: string | null;
  source: 'xp_state' | 'fallback';
  visibility: MobileProfileVisibility;
};

export type MobilePublicProfileSnapshotResult =
  | { ok: true; message: string; profile: MobilePublicProfileSnapshot }
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
  for (let index = 1; index < uniqueIndexes.length; index += 1) {
    const next = uniqueIndexes[index];
    if (prev - next !== 1) break;
    streak += 1;
    prev = next;
  }
  return streak;
};

const parseStatsFromXpState = (
  xpState: ProfileXpState | null | undefined
): {
  displayNameCandidate: string;
  totalXp: number;
  streak: number;
  ritualsCount: number;
  daysPresent: number;
  followersCount: number;
  followingCount: number;
  marks: string[];
  featuredMarks: string[];
  lastRitualDate: string | null;
} | null => {
  if (!xpState || typeof xpState !== 'object' || Array.isArray(xpState)) return null;

  const displayNameCandidate =
    normalizeText(xpState.username, 80) || normalizeText(xpState.fullName, 80) || '';
  const totalXp = readProfileTotalXp(xpState);
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
  const lastRitualDate = readProfileLastRitualDate(xpState);

  return {
    displayNameCandidate,
    totalXp,
    streak,
    ritualsCount: readProfileRitualCount(xpState),
    daysPresent: readProfileDaysPresentCount(xpState),
    followersCount: readProfileFollowersCount(xpState),
    followingCount: readProfileFollowingCount(xpState),
    marks,
    featuredMarks,
    lastRitualDate,
  };
};

const readFollowCounts = async (
  userId: string
): Promise<{ followersCount: number | null; followingCount: number | null }> => {
  if (!supabase) return { followersCount: null, followingCount: null };

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

  return { followersCount, followingCount };
};

const readRitualTimeline = async (
  userId: string
): Promise<{ dateKeys: string[]; ritualsCount: number | null; lastRitualDate: string | null }> => {
  if (!supabase) return { dateKeys: [], ritualsCount: null, lastRitualDate: null };

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

export const fetchMobilePublicProfileSnapshot = async ({
  userId,
  displayNameHint,
}: {
  userId: string;
  displayNameHint?: string;
}): Promise<MobilePublicProfileSnapshotResult> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const normalizedUserId = normalizeText(userId, 120);
  if (!normalizedUserId) {
    return {
      ok: false,
      message: 'Gecersiz kullanici kimligi.',
    };
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles_public')
    .select('display_name,xp_state')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (profileError && !isSupabaseCapabilityError(profileError)) {
    return {
      ok: false,
      message: normalizeText(profileError.message, 220) || 'Profil okunamadi.',
    };
  }

  const profileRow = (profileData || null) as ProfileRow | null;
  const xpStats = parseStatsFromXpState(profileRow?.xp_state || null);
  const avatarUrl = resolveMobileAvatarFromXpState(profileRow?.xp_state);
  const visibility = readMobileProfileVisibilityFromXpState(profileRow?.xp_state);
  const followCounts = await readFollowCounts(normalizedUserId);
  const timeline = await readRitualTimeline(normalizedUserId);

  const displayNameBase =
    (xpStats && xpStats.displayNameCandidate) ||
    normalizeText(profileRow?.display_name, 80) ||
    normalizeText(displayNameHint, 80) ||
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

    return {
      ok: true,
      message: 'Profil verisi guncellendi.',
      profile: {
        userId: normalizedUserId,
        displayName: displayNameBase,
        avatarUrl,
        totalXp: visibility.showStats ? xpStats.totalXp : 0,
        streak: visibility.showStats ? xpStats.streak : 0,
        ritualsCount: visibility.showStats ? resolvedRitualsCount : 0,
        daysPresent: visibility.showStats ? resolvedDaysPresent : 0,
        followersCount: visibility.showFollowCounts ? resolvedFollowersCount : 0,
        followingCount: visibility.showFollowCounts ? resolvedFollowingCount : 0,
        marks: visibility.showMarks ? xpStats.marks : [],
        featuredMarks: visibility.showMarks ? xpStats.featuredMarks : [],
        lastRitualDate: visibility.showActivity ? resolvedLastRitualDate : null,
        source: 'xp_state',
        visibility,
      },
    };
  }

  const uniqueDays = Array.from(new Set(timeline.dateKeys));
  return {
    ok: true,
    message: 'Profil fallback verisi gosteriliyor.',
    profile: {
      userId: normalizedUserId,
      displayName: displayNameBase,
      avatarUrl,
      totalXp: 0,
      streak: visibility.showStats ? computeCurrentStreak(uniqueDays) : 0,
      ritualsCount: visibility.showStats ? Math.max(0, Number(timeline.ritualsCount || 0)) : 0,
      daysPresent: visibility.showStats ? uniqueDays.length : 0,
      followersCount: visibility.showFollowCounts ? Math.max(0, Number(followCounts.followersCount || 0)) : 0,
      followingCount: visibility.showFollowCounts ? Math.max(0, Number(followCounts.followingCount || 0)) : 0,
      marks: [],
      featuredMarks: [],
      lastRitualDate: visibility.showActivity ? timeline.lastRitualDate : null,
      source: 'fallback',
      visibility,
    },
  };
};
