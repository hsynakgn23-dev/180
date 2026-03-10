import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RitualRow = {
  id?: string | null;
  movie_id?: number | string | null;
  movie_title?: string | null;
  text?: string | null;
  poster_path?: string | null;
  year?: number | string | null;
  genre?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  xp_state?: Record<string, unknown> | null;
};

export type MobileProfileActivityItem = {
  id: string;
  movieId: number | null;
  movieTitle: string;
  text: string;
  genre: string | null;
  posterPath: string | null;
  year: number | null;
  rawTimestamp: string;
  timestampLabel: string;
  dayKey: string;
};

export type MobileProfileActivityResult =
  | { ok: true; message: string; items: MobileProfileActivityItem[] }
  | { ok: false; message: string; items: MobileProfileActivityItem[] };

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
};

const toSafeYear = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const year = Math.floor(parsed);
  if (year < 1850 || year > 2200) return null;
  return year;
};

const getLocalDateKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDayKey = (value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '';
  return getLocalDateKey(new Date(parsed));
};

const toRawTimestamp = (value: unknown): string => {
  const normalized = normalizeText(value, 80);
  if (!normalized) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized}T12:00:00`;
  return normalized;
};

const toRelativeTimestamp = (rawTimestamp: string): string => {
  const parsedMs = Date.parse(rawTimestamp);
  if (!Number.isFinite(parsedMs)) return rawTimestamp || 'simdi';

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

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501' || code === '42703') return true;
  return (
    message.includes('relation "') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('jwt') ||
    message.includes('forbidden')
  );
};

const normalizeRows = (rows: RitualRow[]): MobileProfileActivityItem[] =>
  rows
    .map((row, index) => {
      const movieTitle = normalizeText(row.movie_title, 180);
      const text = normalizeText(row.text, 400);
      if (!movieTitle || !text) return null;

      const rawTimestamp =
        normalizeText(row.timestamp, 80) ||
        normalizeText(row.created_at, 80) ||
        new Date().toISOString();

      return {
        id: normalizeText(row.id, 120) || `ritual-${index}`,
        movieId: toSafeInt(row.movie_id),
        movieTitle,
        text,
        genre: normalizeText(row.genre, 80) || null,
        posterPath: normalizeText(row.poster_path, 600) || null,
        year: toSafeYear(row.year),
        rawTimestamp,
        timestampLabel: toRelativeTimestamp(rawTimestamp),
        dayKey: toDayKey(rawTimestamp),
      } satisfies MobileProfileActivityItem;
    })
    .filter((item): item is MobileProfileActivityItem => Boolean(item))
    .sort((left, right) => Date.parse(right.rawTimestamp) - Date.parse(left.rawTimestamp));

const normalizeXpStateRows = (rows: unknown[]): MobileProfileActivityItem[] =>
  rows
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const row = entry as Record<string, unknown>;
      const movieTitle = normalizeText(row.movieTitle, 180);
      const text = normalizeText(row.text, 400);
      if (!movieTitle || !text) return null;

      const rawTimestamp = toRawTimestamp(row.timestamp || row.createdAt || row.date);
      const explicitDayKey = normalizeText(row.date, 40);

      return {
        id: normalizeText(row.id, 120) || `xp-ritual-${index}`,
        movieId: toSafeInt(row.movieId),
        movieTitle,
        text,
        genre: normalizeText(row.genre, 80) || null,
        posterPath: normalizeText(row.posterPath, 600) || null,
        year: toSafeYear(row.year),
        rawTimestamp,
        timestampLabel: toRelativeTimestamp(rawTimestamp),
        dayKey: explicitDayKey || toDayKey(rawTimestamp),
      } satisfies MobileProfileActivityItem;
    })
    .filter((item): item is MobileProfileActivityItem => Boolean(item))
    .sort((left, right) => Date.parse(right.rawTimestamp) - Date.parse(left.rawTimestamp));

export const fetchMobileProfileActivity = async ({
  limit = 80,
}: {
  limit?: number;
} = {}): Promise<MobileProfileActivityResult> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      message: 'Supabase baglantisi hazir degil.',
      items: [],
    };
  }

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 120);
  if (!userId) {
    return {
      ok: false,
      message: 'Profil aktivitesi icin once giris yap.',
      items: [],
    };
  }

  const queryLimit = Math.max(20, Math.min(180, Math.floor(Number(limit) || 80)));
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('xp_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError && !isSupabaseCapabilityError(profileError)) {
    return {
      ok: false,
      message: normalizeText(profileError.message, 220) || 'Profil aktivitesi okunamadi.',
      items: [],
    };
  }

  const profileRow = (profileData || null) as ProfileRow | null;
  const profileXpState =
    profileRow?.xp_state && typeof profileRow.xp_state === 'object' && !Array.isArray(profileRow.xp_state)
      ? profileRow.xp_state
      : null;
  if (profileXpState) {
    const xpStateItems = normalizeXpStateRows(
      Array.isArray(profileXpState.dailyRituals) ? profileXpState.dailyRituals : []
    ).slice(0, queryLimit);

    return {
      ok: true,
      message: xpStateItems.length > 0 ? 'Profil aktivitesi guncellendi.' : 'Henuz yorum aktivitesi yok.',
      items: xpStateItems,
    };
  }

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,movie_title,text,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,text,timestamp:created_at', orderBy: 'created_at' },
  ];

  let rows: RitualRow[] = [];
  let hasReadError = false;
  for (const variant of variants) {
    const { data, error } = await supabase
      .from('rituals')
      .select(variant.select)
      .eq('user_id', userId)
      .order(variant.orderBy, { ascending: false })
      .limit(queryLimit);

    if (error) {
      hasReadError = true;
      if (isSupabaseCapabilityError(error)) continue;
      return {
        ok: false,
        message: normalizeText(error.message, 220) || 'Profil aktivitesi okunamadi.',
        items: [],
      };
    }

    rows = Array.isArray(data) ? (data as RitualRow[]) : [];
    break;
  }

  const items = normalizeRows(rows);
  if (items.length === 0) {
    return {
      ok: true,
      message: hasReadError ? 'Profil aktivitesi bu projede erisilebilir degil.' : 'Henuz yorum aktivitesi yok.',
      items: [],
    };
  }

  return {
    ok: true,
    message: 'Profil aktivitesi guncellendi.',
    items,
  };
};
