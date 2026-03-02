import { isSupabaseLive, supabase } from './supabase';
import {
  readMobileProfileVisibilityFromXpState,
  type MobileProfileVisibility,
} from './mobileProfileVisibility';
import { resolveMobileAvatarFromXpState } from './mobileAvatar';

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
  marks: string[];
  featuredMarks: string[];
  lastRitualDate: string | null;
} | null => {
  if (!xpState || typeof xpState !== 'object' || Array.isArray(xpState)) return null;

  const displayNameCandidate =
    normalizeText(xpState.username, 80) || normalizeText(xpState.fullName, 80) || '';
  const totalXp = toSafeInt(xpState.totalXP);
  const streak = toSafeInt(xpState.streak);
  const dailyRituals = Array.isArray(xpState.dailyRituals) ? xpState.dailyRituals : [];
  const activeDays = Array.isArray(xpState.activeDays) ? xpState.activeDays : [];
  const ritualsCount = dailyRituals.length;
  const daysPresent = activeDays.length;
  const marks = sanitizeStringList(xpState.marks, 160);
  const featuredMarks = sanitizeStringList(xpState.featuredMarks, 8).filter((markId) =>
    marks.includes(markId)
  );

  const lastRitualDate = (() => {
    if (dailyRituals.length === 0) return null;
    const latest = dailyRituals[0];
    if (!latest || typeof latest !== 'object' || Array.isArray(latest)) return null;
    return normalizeText((latest as Record<string, unknown>).date, 40) || null;
  })();

  return {
    displayNameCandidate,
    totalXp,
    streak,
    ritualsCount,
    daysPresent,
    marks,
    featuredMarks,
    lastRitualDate,
  };
};

const readFollowCounts = async (
  userId: string
): Promise<{ followersCount: number; followingCount: number }> => {
  if (!supabase) return { followersCount: 0, followingCount: 0 };

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
      ? 0
      : Math.max(0, Number(followersRes.count || 0));
  const followingCount =
    followingRes.error && isSupabaseCapabilityError(followingRes.error)
      ? 0
      : Math.max(0, Number(followingRes.count || 0));

  return { followersCount, followingCount };
};

const readRitualTimeline = async (
  userId: string
): Promise<{ dateKeys: string[]; ritualsCount: number; lastRitualDate: string | null }> => {
  if (!supabase) return { dateKeys: [], ritualsCount: 0, lastRitualDate: null };

  const { count } = await supabase
    .from('rituals')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId);

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'timestamp', orderBy: 'timestamp' },
    { select: 'created_at', orderBy: 'created_at' },
  ];

  let rows: RitualTimestampRow[] = [];
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
    break;
  }

  const dateKeys = rows
    .map((row) => parseIsoToDateKey(row.timestamp || row.created_at))
    .filter((value): value is string => Boolean(value));
  const lastRitualDate = dateKeys[0] || null;

  return {
    dateKeys,
    ritualsCount: Math.max(0, Number(count || 0)),
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
    .from('profiles')
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

  const displayNameBase =
    (xpStats && xpStats.displayNameCandidate) ||
    normalizeText(profileRow?.display_name, 80) ||
    normalizeText(displayNameHint, 80) ||
    'Observer';

  if (xpStats) {
    return {
      ok: true,
      message: 'Profil verisi guncellendi.',
      profile: {
        userId: normalizedUserId,
        displayName: displayNameBase,
        avatarUrl,
        totalXp: visibility.showStats ? xpStats.totalXp : 0,
        streak: visibility.showStats ? xpStats.streak : 0,
        ritualsCount: visibility.showStats ? xpStats.ritualsCount : 0,
        daysPresent: visibility.showStats ? xpStats.daysPresent : 0,
        followersCount: visibility.showFollowCounts ? followCounts.followersCount : 0,
        followingCount: visibility.showFollowCounts ? followCounts.followingCount : 0,
        marks: visibility.showMarks ? xpStats.marks : [],
        featuredMarks: visibility.showMarks ? xpStats.featuredMarks : [],
        lastRitualDate: visibility.showActivity ? xpStats.lastRitualDate : null,
        source: 'xp_state',
        visibility,
      },
    };
  }

  const timeline = await readRitualTimeline(normalizedUserId);
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
      ritualsCount: visibility.showStats ? timeline.ritualsCount : 0,
      daysPresent: visibility.showStats ? uniqueDays.length : 0,
      followersCount: visibility.showFollowCounts ? followCounts.followersCount : 0,
      followingCount: visibility.showFollowCounts ? followCounts.followingCount : 0,
      marks: [],
      featuredMarks: [],
      lastRitualDate: visibility.showActivity ? timeline.lastRitualDate : null,
      source: 'fallback',
      visibility,
    },
  };
};
