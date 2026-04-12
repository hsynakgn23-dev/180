import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { TMDB_SEEDS } from '../../../../src/data/tmdbSeeds';

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

type PoolMovieMetadataRow = {
  title?: string | null;
  tmdb_id?: number | string | null;
  poster_path?: string | null;
  genre?: string | null;
  release_year?: number | string | null;
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

const MOVIE_BY_TITLE = new Map(
  TMDB_SEEDS.map((movie) => [normalizeText(movie.title, 180).toLowerCase(), movie] as const).filter(
    ([title]) => Boolean(title)
  )
);

const inferPosterPathFromTitle = (movieTitle: string): string | null => {
  const seed = MOVIE_BY_TITLE.get(normalizeText(movieTitle, 180).toLowerCase());
  const posterPath = normalizeText((seed as { posterPath?: string | null } | undefined)?.posterPath, 600);
  return posterPath || null;
};

const inferYearFromTitle = (movieTitle: string): number | null => {
  const seed = MOVIE_BY_TITLE.get(normalizeText(movieTitle, 180).toLowerCase());
  return seed ? toSafeYear((seed as { year?: unknown }).year) : null;
};

const inferGenreFromTitle = (movieTitle: string): string | null => {
  const seed = MOVIE_BY_TITLE.get(normalizeText(movieTitle, 180).toLowerCase());
  return normalizeText((seed as { genre?: unknown } | undefined)?.genre, 80) || null;
};

const inferMovieIdFromTitle = (movieTitle: string): number | null => {
  const seed = MOVIE_BY_TITLE.get(normalizeText(movieTitle, 180).toLowerCase());
  return seed ? toSafeInt((seed as { id?: unknown }).id) : null;
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
        movieId: toSafeInt(row.movie_id) ?? inferMovieIdFromTitle(movieTitle),
        movieTitle,
        text,
        genre: normalizeText(row.genre, 80) || inferGenreFromTitle(movieTitle),
        posterPath: normalizeText(row.poster_path, 600) || inferPosterPathFromTitle(movieTitle),
        year: toSafeYear(row.year) ?? inferYearFromTitle(movieTitle),
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
      const movieTitle = normalizeText(row.movieTitle ?? row.movie_title ?? row.title, 180);
      const text = normalizeText(row.text ?? row.comment ?? row.note ?? row.body, 400);
      if (!movieTitle || !text) return null;

      const rawTimestamp = toRawTimestamp(
        row.timestamp ?? row.createdAt ?? row.created_at ?? row.date ?? row.dayKey ?? row.day_key
      );
      const explicitDayKey = normalizeText(row.date ?? row.dayKey ?? row.day_key, 40);

      return {
        id: normalizeText(row.id, 120) || `xp-ritual-${index}`,
        movieId: toSafeInt(row.movieId ?? row.movie_id) ?? inferMovieIdFromTitle(movieTitle),
        movieTitle,
        text,
        genre:
          normalizeText(row.genre ?? row.movieGenre ?? row.movie_genre, 80) ||
          inferGenreFromTitle(movieTitle),
        posterPath:
          normalizeText(row.posterPath ?? row.poster_path, 600) || inferPosterPathFromTitle(movieTitle),
        year:
          toSafeYear(row.year ?? row.releaseYear ?? row.release_year) ?? inferYearFromTitle(movieTitle),
        rawTimestamp,
        timestampLabel: toRelativeTimestamp(rawTimestamp),
        dayKey: explicitDayKey || toDayKey(rawTimestamp),
      } satisfies MobileProfileActivityItem;
    })
    .filter((item): item is MobileProfileActivityItem => Boolean(item))
    .sort((left, right) => Date.parse(right.rawTimestamp) - Date.parse(left.rawTimestamp));

const enrichItemsWithPoolMetadata = async (
  items: MobileProfileActivityItem[]
): Promise<MobileProfileActivityItem[]> => {
  if (items.length === 0) return items;

  const withSeedFallback = items.map((item) => ({
    ...item,
    movieId: item.movieId ?? inferMovieIdFromTitle(item.movieTitle),
    genre: item.genre || inferGenreFromTitle(item.movieTitle),
    posterPath: item.posterPath || inferPosterPathFromTitle(item.movieTitle),
    year: item.year ?? inferYearFromTitle(item.movieTitle),
  }));

  if (!supabase) return withSeedFallback;

  const unresolvedTitles = Array.from(
    new Set(
      withSeedFallback
        .filter((item) => !item.genre || !item.movieId || !item.posterPath || !item.year)
        .map((item) => normalizeText(item.movieTitle, 180))
        .filter(Boolean)
    )
  );
  if (unresolvedTitles.length === 0) return withSeedFallback;

  const metadataByTitle = new Map<string, PoolMovieMetadataRow>();
  const selectVariants = [
    'title,tmdb_id,poster_path,genre,release_year',
    'title,poster_path,genre,release_year',
    'title,genre,release_year',
    'title,genre',
  ];

  for (let index = 0; index < unresolvedTitles.length; index += 24) {
    const titleBatch = unresolvedTitles.slice(index, index + 24);
    let batchRows: PoolMovieMetadataRow[] = [];

    for (const select of selectVariants) {
      const { data, error } = await supabase
        .from('question_pool_movies')
        .select(select)
        .in('title', titleBatch)
        .limit(titleBatch.length);

      if (error) {
        if (isSupabaseCapabilityError(error)) continue;
        return withSeedFallback;
      }

      batchRows = Array.isArray(data) ? (data as PoolMovieMetadataRow[]) : [];
      break;
    }

    for (const row of batchRows) {
      const titleKey = normalizeText(row.title, 180).toLowerCase();
      if (!titleKey || metadataByTitle.has(titleKey)) continue;
      metadataByTitle.set(titleKey, row);
    }
  }

  if (metadataByTitle.size === 0) return withSeedFallback;

  return withSeedFallback.map((item) => {
    const metadata = metadataByTitle.get(normalizeText(item.movieTitle, 180).toLowerCase());
    if (!metadata) return item;
    return {
      ...item,
      movieId: item.movieId ?? toSafeInt(metadata.tmdb_id),
      genre: item.genre || normalizeText(metadata.genre, 80) || null,
      posterPath: item.posterPath || normalizeText(metadata.poster_path, 600) || null,
      year: item.year ?? toSafeYear(metadata.release_year),
    };
  });
};

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
    const xpStateItems = await enrichItemsWithPoolMetadata(
      normalizeXpStateRows(Array.isArray(profileXpState.dailyRituals) ? profileXpState.dailyRituals : [])
    );

    return {
      ok: true,
      message: xpStateItems.length > 0 ? 'Profil aktivitesi guncellendi.' : 'Henuz yorum aktivitesi yok.',
      items: xpStateItems.slice(0, queryLimit),
    };
  }

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,movie_id,movie_title,text,poster_path,year,genre,timestamp', orderBy: 'timestamp' },
    {
      select: 'id,movie_id,movie_title,text,poster_path,year,genre,timestamp:created_at',
      orderBy: 'created_at',
    },
    { select: 'id,movie_title,text,poster_path,year,genre,timestamp', orderBy: 'timestamp' },
    {
      select: 'id,movie_title,text,poster_path,year,genre,timestamp:created_at',
      orderBy: 'created_at',
    },
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

  const items = await enrichItemsWithPoolMetadata(normalizeRows(rows));
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
