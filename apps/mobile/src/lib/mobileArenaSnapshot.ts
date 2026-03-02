import { isSupabaseLive, supabase } from './supabase';
import { resolveUserIdsByAuthorNames, toAuthorIdentityKey } from './mobileAuthorUserMap';
import { resolveMobileAvatarFromXpState } from './mobileAvatar';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RitualRow = {
  id?: string | null;
  user_id?: string | null;
  author?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

type EchoRow = {
  ritual_id?: string | null;
};

type ArenaAccumulator = {
  userId: string | null;
  displayName: string;
  ritualsCount: number;
  echoCount: number;
  latestMs: number;
};

export type MobileArenaEntry = {
  rank: number;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  ritualsCount: number;
  echoCount: number;
};

export type MobileArenaSnapshotResult = {
  ok: boolean;
  source: 'live' | 'fallback';
  message: string;
  entries: MobileArenaEntry[];
};

const FALLBACK_ARENA_ENTRIES: MobileArenaEntry[] = [
  { rank: 1, userId: null, displayName: 'Cineast_Pro', avatarUrl: null, ritualsCount: 9, echoCount: 31 },
  { rank: 2, userId: null, displayName: 'Silent_Walker', avatarUrl: null, ritualsCount: 7, echoCount: 22 },
  { rank: 3, userId: null, displayName: 'User_4421', avatarUrl: null, ritualsCount: 6, echoCount: 18 },
  { rank: 4, userId: null, displayName: 'Ghibli_Stan', avatarUrl: null, ritualsCount: 5, echoCount: 15 },
  { rank: 5, userId: null, displayName: 'Novice_Watcher', avatarUrl: null, ritualsCount: 4, echoCount: 9 },
];

const normalizeText = (value: unknown, maxLength = 120): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeArenaName = (value: unknown): string =>
  normalizeText(value, 64).replace(/\s+/g, ' ').trim();

const parseTimestampMs = (row: RitualRow): number => {
  const raw = normalizeText(row.timestamp || row.created_at, 80);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
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

const getFallbackResult = (message: string): MobileArenaSnapshotResult => ({
  ok: true,
  source: 'fallback',
  message,
  entries: FALLBACK_ARENA_ENTRIES,
});

const readRitualRows = async (): Promise<{
  rows: RitualRow[];
  error: SupabaseErrorLike | null;
}> => {
  if (!supabase) {
    return { rows: [], error: { message: 'Supabase unavailable.' } };
  }

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,user_id,author,timestamp', orderBy: 'timestamp' },
    { select: 'id,user_id,author,created_at', orderBy: 'created_at' },
    { select: 'id,author,timestamp', orderBy: 'timestamp' },
    { select: 'id,author,created_at', orderBy: 'created_at' },
  ];

  let lastError: SupabaseErrorLike | null = null;
  for (const variant of variants) {
    const { data, error } = await supabase
      .from('rituals')
      .select(variant.select)
      .order(variant.orderBy, { ascending: false })
      .limit(280);

    if (error) {
      lastError = error;
      if (isSupabaseCapabilityError(error)) {
        continue;
      }
      return { rows: [], error };
    }

    const rows = Array.isArray(data) ? (data as RitualRow[]) : [];
    return { rows, error: null };
  }

  return { rows: [], error: lastError };
};

const readEchoCounts = async (ritualIds: string[]): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  if (!supabase || ritualIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('ritual_echoes')
    .select('ritual_id')
    .in('ritual_id', ritualIds);

  if (error) return counts;

  const rows = Array.isArray(data) ? (data as EchoRow[]) : [];
  for (const row of rows) {
    const ritualId = normalizeText(row.ritual_id, 80);
    if (!ritualId) continue;
    counts.set(ritualId, (counts.get(ritualId) || 0) + 1);
  }
  return counts;
};

const buildEntries = (rows: RitualRow[], echoByRitual: Map<string, number>): MobileArenaEntry[] => {
  const byAuthor = new Map<string, ArenaAccumulator>();

  for (const row of rows) {
    const displayName = normalizeArenaName(row.author) || 'Observer';
    const authorKey = displayName.toLowerCase();
    const userId = normalizeText(row.user_id, 80) || null;
    const ritualId = normalizeText(row.id, 80);
    const echoCount = ritualId ? echoByRitual.get(ritualId) || 0 : 0;
    const timestampMs = parseTimestampMs(row);

    const current = byAuthor.get(authorKey) || {
      userId: null,
      displayName,
      ritualsCount: 0,
      echoCount: 0,
      latestMs: 0,
    };

    current.displayName = current.displayName || displayName;
    current.userId = current.userId || userId;
    current.ritualsCount += 1;
    current.echoCount += echoCount;
    current.latestMs = Math.max(current.latestMs, timestampMs);
    byAuthor.set(authorKey, current);
  }

  return Array.from(byAuthor.values())
    .sort((a, b) => {
      const scoreA = a.ritualsCount * 100 + a.echoCount * 5;
      const scoreB = b.ritualsCount * 100 + b.echoCount * 5;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.latestMs !== a.latestMs) return b.latestMs - a.latestMs;
      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, 5)
    .map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      displayName: entry.displayName,
      avatarUrl: null,
      ritualsCount: entry.ritualsCount,
      echoCount: entry.echoCount,
    }));
};

const hydrateArenaEntryUserIds = async (
  entries: MobileArenaEntry[]
): Promise<MobileArenaEntry[]> => {
  const unresolvedNames = entries
    .filter((entry) => !entry.userId)
    .map((entry) => entry.displayName)
    .filter(Boolean);
  if (unresolvedNames.length === 0) return entries;

  const authorUserMap = await resolveUserIdsByAuthorNames(unresolvedNames);
  if (authorUserMap.size === 0) return entries;

  return entries.map((entry) => {
    if (entry.userId) return entry;
    const resolvedUserId = authorUserMap.get(toAuthorIdentityKey(entry.displayName)) || null;
    if (!resolvedUserId) return entry;
    return {
      ...entry,
      userId: resolvedUserId,
    };
  });
};

type ProfileAvatarRow = {
  user_id?: string | null;
  xp_state?: unknown;
};

const readAvatarRowsByUserIds = async (userIds: string[]): Promise<ProfileAvatarRow[]> => {
  if (!supabase) return [];

  const normalizedUserIds = Array.from(
    new Set(userIds.map((userId) => normalizeText(userId, 120)).filter(Boolean))
  );
  if (normalizedUserIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,xp_state')
    .in('user_id', normalizedUserIds);
  if (error) return [];
  return Array.isArray(data) ? (data as ProfileAvatarRow[]) : [];
};

const hydrateArenaEntryAvatars = async (
  entries: MobileArenaEntry[]
): Promise<MobileArenaEntry[]> => {
  const userIds = entries.map((entry) => entry.userId || '').filter(Boolean);
  if (userIds.length === 0) return entries;

  const avatarRows = await readAvatarRowsByUserIds(userIds);
  if (avatarRows.length === 0) return entries;

  const avatarMap = new Map<string, string>();
  for (const row of avatarRows) {
    const userId = normalizeText(row.user_id, 120);
    if (!userId || avatarMap.has(userId)) continue;
    const avatarUrl = resolveMobileAvatarFromXpState(row.xp_state);
    if (!avatarUrl) continue;
    avatarMap.set(userId, avatarUrl);
  }
  if (avatarMap.size === 0) return entries;

  return entries.map((entry) => {
    const userId = entry.userId || '';
    if (!userId) return entry;
    const avatarUrl = avatarMap.get(userId) || '';
    if (!avatarUrl) return entry;
    return {
      ...entry,
      avatarUrl,
    };
  });
};

export const fetchMobileArenaSnapshot = async (): Promise<MobileArenaSnapshotResult> => {
  if (!isSupabaseLive() || !supabase) {
    return getFallbackResult('Arena fallback listesi gosteriliyor.');
  }

  const { rows, error } = await readRitualRows();
  if (error || rows.length === 0) {
    return getFallbackResult('Arena canli verisi yok, fallback listesi gosteriliyor.');
  }

  const ritualIds = rows
    .map((row) => normalizeText(row.id, 80))
    .filter((value): value is string => Boolean(value));
  const echoByRitual = await readEchoCounts(ritualIds);
  const entries = await hydrateArenaEntryAvatars(
    await hydrateArenaEntryUserIds(buildEntries(rows, echoByRitual))
  );
  if (entries.length === 0) {
    return getFallbackResult('Arena canli verisi bos, fallback listesi gosteriliyor.');
  }

  return {
    ok: true,
    source: 'live',
    message: 'Arena leaderboard guncellendi.',
    entries,
  };
};
