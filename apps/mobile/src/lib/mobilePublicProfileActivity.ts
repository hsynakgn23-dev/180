import { isSupabaseLive, supabase } from './supabase';
import { readMobileProfileVisibilityFromXpState } from './mobileProfileVisibility';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RitualRow = {
  id?: string | null;
  movie_title?: string | null;
  text?: string | null;
  poster_path?: string | null;
  year?: number | string | null;
  genre?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

export type MobilePublicProfileActivityItem = {
  id: string;
  movieTitle: string;
  text: string;
  posterPath: string | null;
  year: number | null;
  genre: string | null;
  rawTimestamp: string;
  timestampLabel: string;
};

export type MobilePublicProfileActivityResult =
  | { ok: true; message: string; items: MobilePublicProfileActivityItem[] }
  | { ok: false; message: string; items: MobilePublicProfileActivityItem[] };

const normalizeText = (value: unknown, maxLength = 220): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeYear = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const year = Math.floor(parsed);
  if (year < 1850 || year > 2200) return null;
  return year;
};

const parseTimestampMs = (value: string): number | null => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toRelativeTimestamp = (rawTimestamp: string): string => {
  const parsedMs = parseTimestampMs(rawTimestamp);
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

const normalizeRows = (rows: RitualRow[]): MobilePublicProfileActivityItem[] =>
  rows
    .map((row, index) => {
      const movieTitle = normalizeText(row.movie_title, 160);
      const text = normalizeText(row.text, 400);
      if (!movieTitle || !text) return null;
      const rawTimestamp =
        normalizeText(row.timestamp, 80) ||
        normalizeText(row.created_at, 80) ||
        new Date().toISOString();
      return {
        id: normalizeText(row.id, 120) || `ritual-${index}`,
        movieTitle,
        text,
        posterPath: normalizeText(row.poster_path, 600) || null,
        year: toSafeYear(row.year),
        genre: normalizeText(row.genre, 80) || null,
        rawTimestamp,
        timestampLabel: toRelativeTimestamp(rawTimestamp),
      };
    })
    .filter((item): item is MobilePublicProfileActivityItem => Boolean(item));

export const fetchMobilePublicProfileActivity = async ({
  userId,
  limit = 80,
}: {
  userId: string;
  limit?: number;
}): Promise<MobilePublicProfileActivityResult> => {
  const normalizedUserId = normalizeText(userId, 120);
  if (!normalizedUserId) {
    return {
      ok: false,
      message: 'Gecersiz kullanici kimligi.',
      items: [],
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      message: 'Supabase baglantisi hazir degil.',
      items: [],
    };
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('xp_state')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (profileError && !isSupabaseCapabilityError(profileError)) {
    return {
      ok: false,
      message: normalizeText(profileError.message, 220) || 'Profil filmi okunamadi.',
      items: [],
    };
  }

  const visibility = readMobileProfileVisibilityFromXpState(
    (profileData as { xp_state?: unknown } | null)?.xp_state
  );
  if (!visibility.showActivity) {
    return {
      ok: true,
      message: 'Film kayitlari kapali.',
      items: [],
    };
  }

  const queryLimit = Math.max(20, Math.min(180, Math.floor(Number(limit) || 80)));
  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,movie_title,text,poster_path,year,genre,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,text,poster_path,year,genre,created_at', orderBy: 'created_at' },
    { select: 'id,movie_title,text,year,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,text,year,created_at', orderBy: 'created_at' },
  ];

  let rows: RitualRow[] = [];
  let hasReadError = false;
  for (const variant of variants) {
    const { data, error } = await supabase
      .from('rituals')
      .select(variant.select)
      .eq('user_id', normalizedUserId)
      .order(variant.orderBy, { ascending: false })
      .limit(queryLimit);

    if (error) {
      hasReadError = true;
      if (isSupabaseCapabilityError(error)) continue;
      return {
        ok: false,
        message: normalizeText(error.message, 220) || 'Profil filmi okunamadi.',
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
      message: hasReadError ? 'Film kayitlari bu projede erisilebilir degil.' : 'Film kaydi yok.',
      items: [],
    };
  }

  return {
    ok: true,
    message: 'Film kayitlari guncellendi.',
    items,
  };
};
