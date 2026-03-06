import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { resolveSupabaseUserEmail } from './supabaseUser';
import { resolveUserIdsByAuthorNames, toAuthorIdentityKey } from './mobileAuthorUserMap';
import {
  normalizeMobileLeagueKey,
  resolveMobileLeagueInfo,
  resolveMobileLeagueInfoFromXp,
} from './mobileLeagueSystem';
import { resolveMobileAvatarFromXpState } from './mobileAvatar';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RitualRow = {
  id?: string;
  user_id?: string | null;
  author?: string | null;
  movie_title?: string | null;
  text?: string | null;
  league?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

type RitualLiteItem = {
  id: string;
  userId: string | null;
  author: string;
  authorAvatarUrl: string | null;
  leagueKey: string;
  leagueColor: string;
  movieTitle: string;
  text: string;
  rawTimestamp: string;
  createdAtMs: number | null;
  dayKey: string;
};

type FeedFetchVariant = {
  select: string;
  orderBy: 'timestamp' | 'created_at';
};

type FeedFetchResult = {
  rows: RitualRow[];
  error: SupabaseErrorLike | null;
  hasMore: boolean;
};

type FeedOptions = {
  scope?: CommentFeedScope;
  sort?: CommentFeedSort;
  query?: string;
  page?: number;
  pageSize?: number;
};

export type CommentFeedScope = 'all' | 'today';
export type CommentFeedSort = 'latest' | 'echoes';

export type MobileCommentFeedItem = {
  id: string;
  userId: string | null;
  author: string;
  authorAvatarUrl: string | null;
  leagueKey: string;
  leagueColor: string;
  movieTitle: string;
  text: string;
  timestampLabel: string;
  dayKey: string;
  createdAtMs: number | null;
  echoCount: number;
  replyCount: number;
  isEchoedByMe: boolean;
  isMine: boolean;
};

export type MobileCommentFeedResult =
  | {
      ok: true;
      source: 'live' | 'fallback';
      message: string;
      page: number;
      pageSize: number;
      hasMore: boolean;
      items: MobileCommentFeedItem[];
    }
  | {
      ok: false;
      source: 'fallback';
      message: string;
      page: number;
      pageSize: number;
      hasMore: boolean;
      items: MobileCommentFeedItem[];
    };

export const MOBILE_COMMENT_FEED_PAGE_SIZE = 24;
const MOBILE_COMMENT_FEED_MIN_PAGE_SIZE = 10;
const MOBILE_COMMENT_FEED_MAX_PAGE_SIZE = 80;
const MOBILE_COMMENT_FEED_MAX_PAGE = 200;

const FEED_FETCH_VARIANTS: FeedFetchVariant[] = [
  {
    select: 'id,user_id,author,movie_title,text,league,timestamp',
    orderBy: 'timestamp',
  },
  {
    select: 'id,user_id,author,movie_title,text,league,created_at',
    orderBy: 'created_at',
  },
  {
    select: 'id,user_id,author,movie_title,text,timestamp',
    orderBy: 'timestamp',
  },
  {
    select: 'id,user_id,author,movie_title,text,created_at',
    orderBy: 'created_at',
  },
  {
    select: 'id,author,movie_title,text,timestamp',
    orderBy: 'timestamp',
  },
  {
    select: 'id,author,movie_title,text,created_at',
    orderBy: 'created_at',
  },
];

const normalizeText = (value: unknown, maxLength = 220): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const clampInteger = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.trunc(parsed);
  if (integer < min) return min;
  if (integer > max) return max;
  return integer;
};

const normalizeSearchQuery = (value: unknown): string =>
  normalizeText(value, 120).replace(/[%(),']/g, ' ').replace(/\s+/g, ' ').trim();

const buildServerSearchFilter = (query: string): string | null => {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return null;
  return `author.ilike.%${normalized}%,movie_title.ilike.%${normalized}%,text.ilike.%${normalized}%`;
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

const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimestampToMs = (value: string): number | null => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toRelativeTimestamp = (rawTimestamp: string): string => {
  const parsedMs = parseTimestampToMs(rawTimestamp);
  if (parsedMs === null) return rawTimestamp || 'unknown';

  const diffMs = Date.now() - parsedMs;
  if (diffMs < 0) return 'simdi';

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return 'simdi';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}dk once`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}s once`;
  return `${Math.floor(diffMs / dayMs)}g once`;
};

const toDayKeyFromTimestamp = (rawTimestamp: string): string => {
  const parsedMs = parseTimestampToMs(rawTimestamp);
  if (parsedMs === null) return '';
  return getLocalDateKey(new Date(parsedMs));
};

const normalizeRitualRows = (rows: RitualRow[]): RitualLiteItem[] => {
  return rows
    .map((row): RitualLiteItem | null => {
      const id = normalizeText(row.id, 120);
      const text = normalizeText(row.text, 220);
      if (!id || !text) return null;

      const rawTimestamp =
        normalizeText(row.timestamp, 80) || normalizeText(row.created_at, 80) || new Date().toISOString();
      const movieTitle = normalizeText(row.movie_title, 120) || 'Untitled film';
      const author = normalizeText(row.author, 80) || 'observer';
      const leagueKey = normalizeMobileLeagueKey(row.league);
      const leagueInfo = resolveMobileLeagueInfo(leagueKey);
      const dayKey = toDayKeyFromTimestamp(rawTimestamp);
      const createdAtMs = parseTimestampToMs(rawTimestamp);

      return {
        id,
        userId: normalizeText(row.user_id, 80) || null,
        author,
        authorAvatarUrl: null as string | null,
        leagueKey,
        leagueColor: leagueInfo.color,
        movieTitle,
        text,
        rawTimestamp,
        createdAtMs,
        dayKey,
      };
    })
    .filter((item): item is RitualLiteItem => Boolean(item));
};

const hydrateMissingUserIds = async (items: RitualLiteItem[]): Promise<RitualLiteItem[]> => {
  const missingAuthorNames = items
    .filter((item) => !item.userId)
    .map((item) => item.author)
    .filter(Boolean);
  if (missingAuthorNames.length === 0) return items;

  const authorUserMap = await resolveUserIdsByAuthorNames(missingAuthorNames);
  if (authorUserMap.size === 0) return items;

  return items.map((item) => {
    if (item.userId) return item;
    const resolvedUserId = authorUserMap.get(toAuthorIdentityKey(item.author)) || null;
    if (!resolvedUserId) return item;
    return {
      ...item,
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

const hydrateAuthorAvatars = async (items: RitualLiteItem[]): Promise<RitualLiteItem[]> => {
  const userIds = items.map((item) => item.userId || '').filter(Boolean);
  if (userIds.length === 0) return items;

  const avatarRows = await readAvatarRowsByUserIds(userIds);
  if (avatarRows.length === 0) return items;

  const avatarMap = new Map<string, string>();
  const leagueMap = new Map<string, { leagueKey: string; leagueColor: string }>();
  for (const row of avatarRows) {
    const userId = normalizeText(row.user_id, 120);
    if (!userId) continue;

    if (!leagueMap.has(userId) && row.xp_state && typeof row.xp_state === 'object' && !Array.isArray(row.xp_state)) {
      const xpState = row.xp_state as Record<string, unknown>;
      const { leagueKey, leagueInfo } = resolveMobileLeagueInfoFromXp(toSafeInt(xpState.totalXP));
      leagueMap.set(userId, { leagueKey, leagueColor: leagueInfo.color });
    }

    if (!avatarMap.has(userId)) {
      const avatarUrl = resolveMobileAvatarFromXpState(row.xp_state);
      if (avatarUrl) {
        avatarMap.set(userId, avatarUrl);
      }
    }
  }
  if (avatarMap.size === 0 && leagueMap.size === 0) return items;

  return items.map((item) => {
    const userId = item.userId || '';
    if (!userId) return item;
    const avatarUrl = avatarMap.get(userId) || '';
    const leagueMeta = leagueMap.get(userId);
    if (!avatarUrl && !leagueMeta) return item;
    return {
      ...item,
      authorAvatarUrl: avatarUrl || item.authorAvatarUrl,
      leagueKey: leagueMeta?.leagueKey || item.leagueKey,
      leagueColor: leagueMeta?.leagueColor || item.leagueColor,
    };
  });
};

const getTodayRangeIso = (): { startIso: string; endIso: string } => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const fetchRitualRows = async (options: {
  page: number;
  pageSize: number;
  scope: CommentFeedScope;
  query: string;
}): Promise<FeedFetchResult> => {
  if (!supabase) return { rows: [], error: null, hasMore: false };

  const pageSize = clampInteger(
    options.pageSize,
    MOBILE_COMMENT_FEED_MIN_PAGE_SIZE,
    MOBILE_COMMENT_FEED_MAX_PAGE_SIZE,
    MOBILE_COMMENT_FEED_PAGE_SIZE
  );
  const page = clampInteger(options.page, 1, MOBILE_COMMENT_FEED_MAX_PAGE, 1);
  const offset = (page - 1) * pageSize;
  const fetchLimit = pageSize + 1;
  const endIndex = offset + fetchLimit - 1;
  const searchFilter = buildServerSearchFilter(options.query);
  const todayRange = options.scope === 'today' ? getTodayRangeIso() : null;

  let lastError: SupabaseErrorLike | null = null;
  for (const variant of FEED_FETCH_VARIANTS) {
    let request = supabase
      .from('rituals')
      .select(variant.select)
      .order(variant.orderBy, { ascending: false })
      .range(offset, endIndex);

    if (todayRange) {
      request = request.gte(variant.orderBy, todayRange.startIso).lt(variant.orderBy, todayRange.endIso);
    }

    if (searchFilter) {
      request = request.or(searchFilter);
    }

    const { data, error } = await request;

    if (error) {
      lastError = error;
      if (isSupabaseCapabilityError(error)) continue;
      return { rows: [], error, hasMore: false };
    }

    const rows = Array.isArray(data) ? (data as RitualRow[]) : [];
    const hasMore = rows.length > pageSize;
    const boundedRows = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      rows: boundedRows,
      error: null,
      hasMore,
    };
  }

  return {
    rows: [],
    error: lastError,
    hasMore: false,
  };
};

const buildCountMap = (rows: Array<{ ritual_id: string }>): Map<string, number> => {
  const map = new Map<string, number>();
  for (const row of rows) {
    const ritualId = normalizeText(row.ritual_id, 120);
    if (!ritualId) continue;
    map.set(ritualId, (map.get(ritualId) || 0) + 1);
  }
  return map;
};

const readEngagementMaps = async (
  ritualIds: string[],
  currentUserId: string
): Promise<{ echoMap: Map<string, number>; replyMap: Map<string, number>; echoedByMe: Set<string> }> => {
  if (!supabase || ritualIds.length === 0) {
    return {
      echoMap: new Map<string, number>(),
      replyMap: new Map<string, number>(),
      echoedByMe: new Set<string>(),
    };
  }

  const [echoRes, replyRes] = await Promise.all([
    supabase.from('ritual_echoes').select('ritual_id,user_id').in('ritual_id', ritualIds),
    supabase.from('ritual_replies').select('ritual_id').in('ritual_id', ritualIds),
  ]);

  const echoRows =
    echoRes.error && isSupabaseCapabilityError(echoRes.error)
      ? []
      : Array.isArray(echoRes.data)
        ? (echoRes.data as Array<{ ritual_id: string; user_id?: string | null }>)
        : [];
  const replyRows =
    replyRes.error && isSupabaseCapabilityError(replyRes.error)
      ? []
      : Array.isArray(replyRes.data)
        ? (replyRes.data as Array<{ ritual_id: string }>)
        : [];

  const echoedByMe = new Set<string>();
  for (const row of echoRows) {
    const ritualId = normalizeText(row.ritual_id, 120);
    const userId = normalizeText(row.user_id, 120);
    if (!ritualId || !userId || !currentUserId) continue;
    if (userId === currentUserId) echoedByMe.add(ritualId);
  }

  return {
    echoMap: buildCountMap(echoRows),
    replyMap: buildCountMap(replyRows),
    echoedByMe,
  };
};

const filterItems = (
  items: MobileCommentFeedItem[],
  scope: CommentFeedScope,
  query: string
): MobileCommentFeedItem[] => {
  const normalizedQuery = normalizeText(query, 120).toLowerCase();
  const todayKey = getLocalDateKey();

  return items.filter((item) => {
    if (scope === 'today' && item.dayKey !== todayKey) return false;
    if (!normalizedQuery) return true;
    return (
      item.author.toLowerCase().includes(normalizedQuery) ||
      item.movieTitle.toLowerCase().includes(normalizedQuery) ||
      item.text.toLowerCase().includes(normalizedQuery)
    );
  });
};

const sortItems = (items: MobileCommentFeedItem[], sort: CommentFeedSort): MobileCommentFeedItem[] => {
  const next = [...items];
  if (sort === 'echoes') {
    next.sort((a, b) => {
      if (b.echoCount !== a.echoCount) return b.echoCount - a.echoCount;
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
    return next;
  }

  next.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return next;
};

const paginateItems = (
  items: MobileCommentFeedItem[],
  page: number,
  pageSize: number
): { items: MobileCommentFeedItem[]; hasMore: boolean } => {
  const normalizedPage = clampInteger(page, 1, MOBILE_COMMENT_FEED_MAX_PAGE, 1);
  const normalizedPageSize = clampInteger(
    pageSize,
    MOBILE_COMMENT_FEED_MIN_PAGE_SIZE,
    MOBILE_COMMENT_FEED_MAX_PAGE_SIZE,
    MOBILE_COMMENT_FEED_PAGE_SIZE
  );
  const start = (normalizedPage - 1) * normalizedPageSize;
  const end = start + normalizedPageSize;
  return {
    items: items.slice(start, end),
    hasMore: end < items.length,
  };
};

const toFeedItem = (
  ritual: RitualLiteItem,
  options: {
    echoCount: number;
    replyCount: number;
    isEchoedByMe: boolean;
    currentUserId: string;
  }
): MobileCommentFeedItem => ({
  id: ritual.id,
  userId: ritual.userId,
  author: ritual.author,
  authorAvatarUrl: ritual.authorAvatarUrl,
  leagueKey: ritual.leagueKey,
  leagueColor: ritual.leagueColor,
  movieTitle: ritual.movieTitle,
  text: ritual.text,
  timestampLabel: toRelativeTimestamp(ritual.rawTimestamp),
  dayKey: ritual.dayKey,
  createdAtMs: ritual.createdAtMs,
  echoCount: Math.max(0, options.echoCount),
  replyCount: Math.max(0, options.replyCount),
  isEchoedByMe: options.isEchoedByMe,
  isMine: Boolean(options.currentUserId && ritual.userId === options.currentUserId),
});

const readFallbackFromXpState = async (): Promise<MobileCommentFeedItem[]> => {
  if (!supabase) return [];

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 80);
  const userEmail = resolveSupabaseUserEmail(sessionResult.session?.user);
  if (!userId) return [];

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('display_name,xp_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return [];
  const xpState =
    profileData && typeof profileData === 'object' && !Array.isArray(profileData)
      ? (profileData as Record<string, unknown>).xp_state
      : null;
  const xpTotal = toSafeInt((xpState as Record<string, unknown> | null)?.totalXP);
  const { leagueKey: fallbackLeagueKey, leagueInfo: fallbackLeagueInfo } =
    resolveMobileLeagueInfoFromXp(xpTotal);
  const fallbackAvatarUrl = resolveMobileAvatarFromXpState(xpState);
  const dailyRituals = Array.isArray((xpState as Record<string, unknown> | null)?.dailyRituals)
    ? ((xpState as Record<string, unknown>).dailyRituals as Array<Record<string, unknown>>)
    : [];

  const fallbackAuthor =
    normalizeText(
      (profileData as Record<string, unknown> | null)?.display_name,
      80
    ) ||
    normalizeText(userEmail.split('@')[0], 80) ||
    'observer';

  const mapped = dailyRituals
    .map((ritual, index) => {
      const text = normalizeText(ritual.text, 220);
      if (!text) return null;

      const movieTitle = normalizeText(ritual.movieTitle, 120) || 'Untitled film';
      const dateKey = normalizeText(ritual.date, 40);
      const rawTimestamp = dateKey ? `${dateKey}T12:00:00` : '';
      const dayKey = dateKey || toDayKeyFromTimestamp(rawTimestamp);
      const id = `xp-${dateKey || 'unknown'}-${index}`;
      const createdAtMs = parseTimestampToMs(rawTimestamp);

      return {
        id,
        userId,
        author: fallbackAuthor,
        authorAvatarUrl: fallbackAvatarUrl || null,
        leagueKey: fallbackLeagueKey,
        leagueColor: fallbackLeagueInfo.color,
        movieTitle,
        text,
        timestampLabel: dateKey || 'unknown',
        dayKey,
        createdAtMs,
        echoCount: 0,
        replyCount: 0,
        isEchoedByMe: false,
        isMine: true,
      } as MobileCommentFeedItem;
    })
    .filter((item): item is MobileCommentFeedItem => Boolean(item));

  return mapped.sort((a, b) => b.timestampLabel.localeCompare(a.timestampLabel));
};

export const fetchMobileCommentFeed = async (
  options: FeedOptions = {}
): Promise<MobileCommentFeedResult> => {
  const scope = options.scope || 'all';
  const sort = options.sort || 'latest';
  const query = String(options.query || '').trim();
  const page = clampInteger(options.page, 1, MOBILE_COMMENT_FEED_MAX_PAGE, 1);
  const pageSize = clampInteger(
    options.pageSize,
    MOBILE_COMMENT_FEED_MIN_PAGE_SIZE,
    MOBILE_COMMENT_FEED_MAX_PAGE_SIZE,
    MOBILE_COMMENT_FEED_PAGE_SIZE
  );

  if (!isSupabaseLive() || !supabase) {
    const fallbackItems = await readFallbackFromXpState();
    const filteredFallback = filterItems(sortItems(fallbackItems, sort), scope, query);
    const pagedFallback = paginateItems(filteredFallback, page, pageSize);
    return {
      ok: true,
      source: 'fallback',
      message:
        pagedFallback.items.length > 0
          ? 'Genel yorum akisi yerine yerel yorumlar gosteriliyor.'
          : page > 1
            ? 'Bu sayfada ek yorum yok.'
            : 'Yorum akisi icin Supabase baglantisi hazir degil.',
      page,
      pageSize,
      hasMore: pagedFallback.hasMore,
      items: pagedFallback.items,
    };
  }

  const sessionResult = await readSupabaseSessionSafe();
  const currentUserId = normalizeText(sessionResult.session?.user?.id, 80);

  const feedFetch = await fetchRitualRows({
    page,
    pageSize,
    scope,
    query,
  });
  if (feedFetch.error) {
    const fallbackItems = await readFallbackFromXpState();
    const filteredFallback = filterItems(sortItems(fallbackItems, sort), scope, query);
    const pagedFallback = paginateItems(filteredFallback, page, pageSize);
    const capabilityFallback = isSupabaseCapabilityError(feedFetch.error);
    const errorText = normalizeText(feedFetch.error.message, 220);

    if (capabilityFallback || pagedFallback.items.length > 0) {
      return {
        ok: true,
        source: 'fallback',
        message:
          pagedFallback.items.length > 0
            ? 'Genel yorum akisi su an kullanilamiyor, yerel yorumlar gosteriliyor.'
            : 'Yorum tablosu icin erisim yetkisi yok.',
        page,
        pageSize,
        hasMore: pagedFallback.hasMore,
        items: pagedFallback.items,
      };
    }

    return {
      ok: false,
      source: 'fallback',
      message: errorText || 'Yorum akisi okunamadi.',
      page,
      pageSize,
      hasMore: false,
      items: [],
    };
  }

  const normalizedRows = await hydrateAuthorAvatars(
    await hydrateMissingUserIds(normalizeRitualRows(feedFetch.rows))
  );
  const ritualIds = normalizedRows.map((row) => row.id);
  const { echoMap, replyMap, echoedByMe } = await readEngagementMaps(ritualIds, currentUserId);

  const mappedItems = normalizedRows
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .map((ritual) =>
      toFeedItem(ritual, {
        echoCount: echoMap.get(ritual.id) || 0,
        replyCount: replyMap.get(ritual.id) || 0,
        isEchoedByMe: echoedByMe.has(ritual.id),
        currentUserId,
      })
    );

  const filtered = filterItems(sortItems(mappedItems, sort), scope, query);
  return {
    ok: true,
    source: 'live',
    message:
      filtered.length > 0
        ? 'Genel yorum akisi guncellendi.'
        : page > 1
          ? 'Bu sayfada ek yorum yok.'
          : 'Bu filtrede yorum bulunamadi.',
    page,
    pageSize,
    hasMore: feedFetch.hasMore,
    items: filtered,
  };
};
