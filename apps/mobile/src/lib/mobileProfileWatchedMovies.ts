import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RitualMovieRow = {
  id?: string | null;
  movie_title?: string | null;
  poster_path?: string | null;
  year?: number | string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

export type MobileWatchedMovie = {
  id: string;
  movieTitle: string;
  posterPath: string | null;
  year: number | null;
  watchedAt: string;
  watchedDayKey: string;
  watchCount: number;
  source?: 'ritual' | 'letterboxd';
};

export type MobileProfileWatchedMoviesResult =
  | { ok: true; source: 'live'; message: string; items: MobileWatchedMovie[] }
  | { ok: false; source: 'fallback'; message: string; items: MobileWatchedMovie[] };

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

const toMovieKey = (title: string, year: number | null): string =>
  `${normalizeText(title, 180).toLowerCase()}::${year ?? ''}`;

const normalizeMovieRows = (rows: RitualMovieRow[]): MobileWatchedMovie[] => {
  const deduped = new Map<string, MobileWatchedMovie>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const movieTitle = normalizeText(row.movie_title, 180);
    if (!movieTitle) continue;

    const watchedAt =
      normalizeText(row.timestamp, 80) ||
      normalizeText(row.created_at, 80) ||
      new Date().toISOString();
    const year = toSafeYear(row.year);
    const key = toMovieKey(movieTitle, year);
    const existing = deduped.get(key);

    if (existing) {
      existing.watchCount += 1;
      continue;
    }

    const fallbackId = normalizeText(row.id, 120) || `${movieTitle}-${year ?? 'na'}-${index}`;
    deduped.set(key, {
      id: fallbackId,
      movieTitle,
      posterPath: normalizeText(row.poster_path, 500) || null,
      year,
      watchedAt,
      watchedDayKey: toDayKey(watchedAt),
      watchCount: 1,
      source: 'ritual',
    });
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftTime = Date.parse(left.watchedAt);
    const rightTime = Date.parse(right.watchedAt);
    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
    if (!Number.isFinite(leftTime)) return 1;
    if (!Number.isFinite(rightTime)) return -1;
    return rightTime - leftTime;
  });
};

export const fetchMobileProfileWatchedMovies = async ({
  limit = 24,
}: {
  limit?: number;
} = {}): Promise<MobileProfileWatchedMoviesResult> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      source: 'fallback',
      message: 'Supabase baglantisi hazir degil.',
      items: [],
    };
  }

  const normalizedLimit = Math.max(6, Math.min(80, Math.floor(Number(limit) || 24)));
  const queryLimit = Math.max(30, Math.min(320, normalizedLimit * 4));

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 120);
  if (!userId) {
    return {
      ok: false,
      source: 'fallback',
      message: 'Izlenen filmler icin once giris yap.',
      items: [],
    };
  }

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,movie_title,poster_path,year,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,poster_path,year,created_at', orderBy: 'created_at' },
    { select: 'id,movie_title,year,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,year,created_at', orderBy: 'created_at' },
  ];

  let rows: RitualMovieRow[] = [];
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
        source: 'fallback',
        message: normalizeText(error.message, 220) || 'Izlenen filmler okunamadi.',
        items: [],
      };
    }

    rows = Array.isArray(data) ? (data as RitualMovieRow[]) : [];
    break;
  }

  if (rows.length === 0) {
    return {
      ok: true,
      source: 'live',
      message: hasReadError
        ? 'Izlenen film verisi bu projede erisilebilir degil.'
        : 'Izlenen film kaydi bulunamadi.',
      items: [],
    };
  }

  const movies = normalizeMovieRows(rows).slice(0, normalizedLimit);
  return {
    ok: true,
    source: 'live',
    message: movies.length > 0 ? 'Izlenen filmler guncellendi.' : 'Izlenen film kaydi bulunamadi.',
    items: movies,
  };
};
