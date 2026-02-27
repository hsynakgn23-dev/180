import { isSupabaseLive, supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  xp_state?: unknown;
};

type RitualRow = {
  id?: string | null;
  movie_id?: number | null;
  movie_title?: string | null;
  text?: string | null;
  genre?: string | null;
  poster_path?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

type ShareRewardGoal = 'comment' | 'streak';
type ShareRewardPlatform = 'instagram' | 'tiktok' | 'x';

type ShareRewardCommentSnapshot = {
  id: string;
  text: string;
  movieTitle: string;
  dayKey: string;
};

type ShareRewardIdentityFallback = {
  fullName?: string;
  username?: string;
  gender?: string;
  birthDate?: string;
  bio?: string;
  avatarUrl?: string;
  profileLink?: string;
};

type RitualLog = {
  id: string;
  date: string;
  movieId: number;
  movieTitle: string;
  text: string;
  genre?: string;
  posterPath?: string;
};

export type MobileShareRewardSyncInput = {
  platform: ShareRewardPlatform;
  goal: ShareRewardGoal;
  fallbackTotalXp: number;
  fallbackStreak: number;
  fallbackDisplayName: string;
  fallbackLastRitualDate?: string | null;
  fallbackMarks?: string[];
  fallbackFeaturedMarks?: string[];
  fallbackReferralCode?: string;
  fallbackFollowersCount?: number;
  fallbackIdentity?: ShareRewardIdentityFallback;
  fallbackComment?: ShareRewardCommentSnapshot | null;
};

export type MobileShareRewardSyncResult =
  | {
      ok: true;
      message: string;
      awardedXp: number;
      totalXp: number;
      rewardDate: string;
    }
  | {
      ok: false;
      reason:
        | 'auth_required'
        | 'supabase_unavailable'
        | 'schema_missing'
        | 'goal_not_ready'
        | 'already_claimed'
        | 'unknown';
      message: string;
      rewardDate?: string;
      totalXp?: number;
    };

export const MOBILE_SHARE_REWARD_XP = 18;

const VALID_GENDERS = new Set(['female', 'male', 'non_binary', 'prefer_not_to_say']);

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeUsername = (value: unknown): string =>
  normalizeText(value, 80)
    .replace(/\s+/g, '')
    .toLowerCase();

const normalizeAvatarUrl = (value: unknown): string => {
  const normalized = normalizeText(value, 1200);
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^data:image\//i.test(normalized)) return normalized;
  return '';
};

const normalizeGender = (value: unknown): string => {
  const normalized = normalizeText(value, 40);
  return VALID_GENDERS.has(normalized) ? normalized : '';
};

const normalizeBirthDate = (value: unknown): string => {
  const normalized = normalizeText(value, 32);
  if (!normalized) return '';
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const slashMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  return normalized;
};

const toSafeInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const sanitizeStringList = (value: unknown, maxItems = 160, itemLimit = 80): string[] => {
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

const parseDateKeyToDayIndex = (dateKey: string): number | null => {
  const parts = dateKey.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / (24 * 60 * 60 * 1000));
};

const toDateKey = (value: unknown): string | null => {
  const text = normalizeText(value, 80);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
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
  let previous = latest;
  for (let index = 1; index < uniqueIndexes.length; index += 1) {
    const next = uniqueIndexes[index];
    if (previous - next !== 1) break;
    streak += 1;
    previous = next;
  }

  return streak;
};

const parseRitualLogsFromXpState = (value: unknown): RitualLog[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const record = entry as Record<string, unknown>;
      const date = normalizeText(record.date, 40);
      const text = normalizeText(record.text, 280);
      if (!date || !text) return null;
      return {
        ...record,
        id: normalizeText(record.id, 120) || `${date}-${text.slice(0, 16)}`,
        date,
        movieId: toSafeInt(record.movieId),
        movieTitle: normalizeText(record.movieTitle, 160),
        text,
        genre: normalizeText(record.genre, 80) || undefined,
        posterPath: normalizeText(record.posterPath, 280) || undefined,
      } as RitualLog;
    })
    .filter((entry): entry is RitualLog => Boolean(entry))
    .slice(0, 420);
};

const readRecentRitualRows = async (userId: string): Promise<RitualRow[]> => {
  if (!supabase) return [];

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,movie_id,movie_title,text,genre,poster_path,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_id,movie_title,text,genre,poster_path,created_at', orderBy: 'created_at' },
    { select: 'id,movie_title,text,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,text,created_at', orderBy: 'created_at' },
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

    return Array.isArray(data) ? (data as RitualRow[]) : [];
  }

  return [];
};

const buildRitualLogsFromRows = (rows: RitualRow[]): RitualLog[] =>
  rows
    .map((row) => {
      const rawTimestamp = normalizeText(row.timestamp || row.created_at, 80);
      const date = toDateKey(rawTimestamp);
      const text = normalizeText(row.text, 280);
      if (!date || !text) return null;
      return {
        id: normalizeText(row.id, 120) || `${date}-${text.slice(0, 16)}`,
        date,
        movieId: toSafeInt(row.movie_id),
        movieTitle: normalizeText(row.movie_title, 160),
        text,
        genre: normalizeText(row.genre, 80) || undefined,
        posterPath: normalizeText(row.poster_path, 280) || undefined,
      } satisfies RitualLog;
    })
    .filter((entry): entry is RitualLog => Boolean(entry))
    .slice(0, 420);

const mergeFallbackComment = (
  ritualLogs: RitualLog[],
  fallbackComment: ShareRewardCommentSnapshot | null | undefined
): RitualLog[] => {
  if (!fallbackComment) return ritualLogs;
  const date = normalizeText(fallbackComment.dayKey, 40);
  const text = normalizeText(fallbackComment.text, 280);
  if (!date || !text) return ritualLogs;

  const exists = ritualLogs.some(
    (entry) =>
      normalizeText(entry.id, 120) === normalizeText(fallbackComment.id, 120) ||
      (entry.date === date && entry.text === text)
  );
  if (exists) return ritualLogs;

  return [
    {
      id: normalizeText(fallbackComment.id, 120) || `${date}-${text.slice(0, 16)}`,
      date,
      movieId: 0,
      movieTitle: normalizeText(fallbackComment.movieTitle, 160),
      text,
    },
    ...ritualLogs,
  ].slice(0, 420);
};

const buildActiveDays = (currentActiveDays: unknown, ritualLogs: RitualLog[]): string[] => {
  const merged = new Set<string>(sanitizeStringList(currentActiveDays, 420, 40));
  for (const ritual of ritualLogs) {
    const date = normalizeText(ritual.date, 40);
    if (date) merged.add(date);
  }
  return Array.from(merged).sort((left, right) => right.localeCompare(left));
};

const resolveDisplayName = (
  profileRow: ProfileRow | null,
  currentState: Record<string, unknown>,
  fallbackDisplayName: string,
  userEmail: string
): string => {
  const fromState =
    normalizeText(currentState.fullName, 120) ||
    normalizeText(currentState.full_name, 120) ||
    normalizeText(currentState.username, 80);
  return (
    normalizeText(profileRow?.display_name, 120) ||
    fromState ||
    normalizeText(fallbackDisplayName, 120) ||
    normalizeText(userEmail.split('@')[0], 120) ||
    'Observer'
  );
};

export const claimMobileShareReward = async (
  input: MobileShareRewardSyncInput
): Promise<MobileShareRewardSyncResult> => {
  const today = getLocalDateKey();
  const hasCommentToday = input.fallbackComment?.dayKey === today && Boolean(normalizeText(input.fallbackComment.text, 280));
  const hasStreakToday = hasCommentToday && toSafeInt(input.fallbackStreak) > 0;

  if (input.goal === 'comment' && !hasCommentToday) {
    return {
      ok: false,
      reason: 'goal_not_ready',
      message: 'Yorum paylasim bonusu icin once bugun yorum yaz.',
    };
  }

  if (input.goal === 'streak' && !hasStreakToday) {
    return {
      ok: false,
      reason: 'goal_not_ready',
      message: 'Streak paylasim bonusu icin once bugunku rituelini tamamla.',
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      reason: 'supabase_unavailable',
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = normalizeText(sessionData.session?.user?.id, 120);
  const userEmail = normalizeText(sessionData.session?.user?.email, 220);
  if (!userId) {
    return {
      ok: false,
      reason: 'auth_required',
      message: 'Paylasim bonusu icin once mobilde giris yap.',
    };
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
      message: normalizeText(profileError.message, 220) || 'Profil okunamadi.',
    };
  }

  const profileRow = (profileData || null) as ProfileRow | null;
  const currentState = sanitizeRecord(profileRow?.xp_state);
  const currentTotalXp = Math.max(toSafeInt(currentState.totalXP), toSafeInt(input.fallbackTotalXp));
  const currentRewardDate = normalizeText(currentState.lastShareRewardDate, 40);
  if (currentRewardDate === today) {
    return {
      ok: false,
      reason: 'already_claimed',
      message: 'Bugun paylasim bonusu zaten alindi.',
      rewardDate: today,
      totalXp: currentTotalXp,
    };
  }

  const xpStateRitualLogs = parseRitualLogsFromXpState(currentState.dailyRituals);
  const ritualSeed =
    xpStateRitualLogs.length > 0 ? xpStateRitualLogs : buildRitualLogsFromRows(await readRecentRitualRows(userId));
  const dailyRituals = mergeFallbackComment(ritualSeed, input.fallbackComment);
  const activeDays = buildActiveDays(currentState.activeDays, dailyRituals);
  const computedStreak = computeCurrentStreak(activeDays);
  const marks = sanitizeStringList(currentState.marks, 160, 80);
  const fallbackMarks = sanitizeStringList(input.fallbackMarks, 160, 80);
  const nextMarks = marks.length > 0 ? marks : fallbackMarks;
  const featuredMarksBase = sanitizeStringList(currentState.featuredMarks, 8, 80);
  const fallbackFeaturedMarks = sanitizeStringList(input.fallbackFeaturedMarks, 8, 80);
  const nextFeaturedMarks = (featuredMarksBase.length > 0 ? featuredMarksBase : fallbackFeaturedMarks).filter(
    (markId) => nextMarks.includes(markId)
  );
  const nextStreak = Math.max(toSafeInt(currentState.streak), toSafeInt(input.fallbackStreak), computedStreak);
  const latestRitualDate =
    normalizeText(input.fallbackLastRitualDate, 40) || normalizeText(dailyRituals[0]?.date, 40);
  const displayName = resolveDisplayName(profileRow, currentState, input.fallbackDisplayName, userEmail);
  const nextTotalXp = currentTotalXp + MOBILE_SHARE_REWARD_XP;
  const identity = input.fallbackIdentity || {};
  const nextState: Record<string, unknown> = {
    ...currentState,
    totalXP: nextTotalXp,
    dailyRituals,
    marks: nextMarks,
    featuredMarks: nextFeaturedMarks,
    activeDays,
    streak: nextStreak,
    lastStreakDate: normalizeText(currentState.lastStreakDate, 40) || latestRitualDate || null,
    followers: Math.max(toSafeInt(currentState.followers), toSafeInt(input.fallbackFollowersCount)),
    following: Array.isArray(currentState.following) ? currentState.following : [],
    fullName:
      normalizeText(currentState.fullName, 120) ||
      normalizeText(currentState.full_name, 120) ||
      normalizeText(identity.fullName, 120) ||
      displayName,
    full_name:
      normalizeText(currentState.full_name, 120) ||
      normalizeText(currentState.fullName, 120) ||
      normalizeText(identity.fullName, 120) ||
      displayName,
    username:
      normalizeUsername(currentState.username) || normalizeUsername(identity.username) || normalizeUsername(displayName),
    gender: normalizeGender(currentState.gender) || normalizeGender(identity.gender),
    birthDate: normalizeBirthDate(currentState.birthDate || currentState.birth_date || identity.birthDate),
    birth_date: normalizeBirthDate(currentState.birth_date || currentState.birthDate || identity.birthDate),
    bio: normalizeText(currentState.bio || identity.bio, 180),
    avatarUrl:
      normalizeAvatarUrl(currentState.avatarUrl || currentState.avatar_url) ||
      normalizeAvatarUrl(identity.avatarUrl),
    avatar_url:
      normalizeAvatarUrl(currentState.avatar_url || currentState.avatarUrl) ||
      normalizeAvatarUrl(identity.avatarUrl),
    profileLink:
      normalizeText(currentState.profileLink || currentState.profile_link || identity.profileLink, 280),
    profile_link:
      normalizeText(currentState.profile_link || currentState.profileLink || identity.profileLink, 280),
    referralCode:
      normalizeText(currentState.referralCode, 120) || normalizeText(input.fallbackReferralCode, 120),
    referralCount: toSafeInt(currentState.referralCount),
    lastShareRewardDate: today,
  };

  const nowIso = new Date().toISOString();
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
      message:
        normalizeText(writeError.message, 220) ||
        'Paylasim bonusu cloud profile yazilamadi.',
    };
  }

  const triggerLabel = input.goal === 'streak' ? 'streak paylasimi' : 'yorum paylasimi';
  const platformLabel = input.platform === 'x' ? 'X' : input.platform === 'tiktok' ? 'TikTok' : 'Instagram';
  return {
    ok: true,
    message: `${platformLabel} ${triggerLabel} kaydedildi. +${MOBILE_SHARE_REWARD_XP} XP`,
    awardedXp: MOBILE_SHARE_REWARD_XP,
    totalXp: nextTotalXp,
    rewardDate: today,
  };
};
