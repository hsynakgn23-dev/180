import { isSupabaseLive, supabase } from './supabase';
import { readMobileProfileVisibilityFromXpState } from './mobileProfileVisibility';
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

export type MobilePublicProfileActivityItem = {
  id: string;
  movieId: number | null;
  movieTitle: string;
  text: string;
  posterPath: string | null;
  year: number | null;
  genre: string | null;
  rawTimestamp: string;
  timestampLabel: string;
  dayKey: string;
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

const toSafeInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
};

const parseTimestampMs = (value: string): number | null => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
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

type ProfileRow = {
  display_name?: string | null;
  xp_state?: Record<string, unknown> | null;
};

type PoolMovieMetadataRow = {
  title?: string | null;
  tmdb_id?: number | string | null;
  poster_path?: string | null;
  genre?: string | null;
  release_year?: number | string | null;
};

const SEED_MOVIE_BY_TITLE = new Map(
  TMDB_SEEDS.map((movie) => [movie.title.trim().toLowerCase(), movie] as const)
);

const inferMovieFromTitle = (
  movieTitle: string
): { movieId: number | null; genre: string | null; posterPath: string | null; year: number | null } => {
  const seed = SEED_MOVIE_BY_TITLE.get(movieTitle.trim().toLowerCase());
  if (!seed) return { movieId: null, genre: null, posterPath: null, year: null };
  return {
    movieId: Number.isFinite(Number(seed.id)) ? Number(seed.id) : null,
    genre: normalizeText(seed.genre, 80) || null,
    posterPath: normalizeText((seed as { posterPath?: string | null }).posterPath, 600) || null,
    year: toSafeYear((seed as { year?: number | string | null }).year),
  };
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
  if (code === 'PGRST205' || code === 'PGRST204' || code === '42P01' || code === '42501' || code === '42703') {
    return true;
  }
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

const toAuthorCandidates = (profileRow: ProfileRow | null | undefined): string[] => {
  const xpState = profileRow?.xp_state;
  const candidates = [
    normalizeText((xpState as Record<string, unknown> | null | undefined)?.username, 80),
    normalizeText((xpState as Record<string, unknown> | null | undefined)?.fullName, 80),
    normalizeText(profileRow?.display_name, 80),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
};

const enrichItemsWithPoolMetadata = async (
  items: MobilePublicProfileActivityItem[]
): Promise<MobilePublicProfileActivityItem[]> => {
  if (!supabase || items.length === 0) return items;

  const unresolvedTitles = Array.from(
    new Set(
      items
        .filter((item) => !item.genre || !item.movieId || !item.posterPath || !item.year)
        .map((item) => normalizeText(item.movieTitle, 180))
        .filter(Boolean)
    )
  );

  if (unresolvedTitles.length === 0) return items;

  const selectVariants = [
    'title,tmdb_id,poster_path,genre,release_year',
    'title,poster_path,genre,release_year',
    'title,genre,release_year',
    'title,genre',
  ];

  const metadataByTitle = new Map<string, PoolMovieMetadataRow>();
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
        return items;
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

  if (metadataByTitle.size === 0) return items;

  return items.map((item) => {
    const metadata = metadataByTitle.get(normalizeText(item.movieTitle, 180).toLowerCase());
    if (!metadata) return item;
    return {
      ...item,
      movieId: item.movieId ?? toSafeInt(metadata.tmdb_id),
      posterPath: item.posterPath || normalizeText(metadata.poster_path, 600) || null,
      year: item.year ?? toSafeYear(metadata.release_year),
      genre: item.genre || normalizeText(metadata.genre, 80) || null,
    };
  });
};

const normalizeRows = (rows: RitualRow[]): MobilePublicProfileActivityItem[] =>
  rows
    .map((row, index) => {
      const movieTitle = normalizeText(row.movie_title, 160);
      const text = normalizeText(row.text, 400);
      if (!movieTitle) return null;
      const inferredMovie = inferMovieFromTitle(movieTitle);
      const rawTimestamp =
        normalizeText(row.timestamp, 80) ||
        normalizeText(row.created_at, 80) ||
        new Date().toISOString();
      return {
        id: normalizeText(row.id, 120) || `ritual-${index}`,
        movieId: toSafeInt(row.movie_id) ?? inferredMovie.movieId,
        movieTitle,
        text,
        posterPath: normalizeText(row.poster_path, 600) || inferredMovie.posterPath,
        year: toSafeYear(row.year) ?? inferredMovie.year,
        genre: normalizeText(row.genre, 80) || inferredMovie.genre,
        rawTimestamp,
        timestampLabel: toRelativeTimestamp(rawTimestamp),
        dayKey: toDayKey(rawTimestamp),
      };
    })
    .filter((item): item is MobilePublicProfileActivityItem => Boolean(item));

const normalizeXpStateRows = (rows: unknown[]): MobilePublicProfileActivityItem[] =>
  rows
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const row = entry as Record<string, unknown>;
      const movieTitle = normalizeText(row.movieTitle ?? row.movie_title ?? row.title, 180);
      const text = normalizeText(row.text ?? row.comment ?? row.note ?? row.body, 400);
      if (!movieTitle) return null;
      const inferredMovie = inferMovieFromTitle(movieTitle);
      const rawTimestamp = toRawTimestamp(
        row.timestamp || row.createdAt || row.created_at || row.dayKey || row.day_key || row.date
      );
      const explicitDayKey = normalizeText(row.date ?? row.dayKey ?? row.day_key, 40);

      return {
        id: normalizeText(row.id, 120) || `xp-ritual-${index}`,
        movieId: toSafeInt(row.movieId ?? row.movie_id) ?? inferredMovie.movieId,
        movieTitle,
        text,
        posterPath:
          normalizeText(
            row.posterPath ?? row.poster_path ?? row.moviePosterPath ?? row.movie_poster_path,
            600
          ) || inferredMovie.posterPath,
        year: toSafeYear(row.year ?? row.releaseYear ?? row.release_year) ?? inferredMovie.year,
        genre: normalizeText(row.genre ?? row.movieGenre ?? row.movie_genre, 80) || inferredMovie.genre,
        rawTimestamp,
        timestampLabel: toRelativeTimestamp(rawTimestamp),
        dayKey: explicitDayKey || toDayKey(rawTimestamp),
      } satisfies MobilePublicProfileActivityItem;
    })
    .filter((item): item is MobilePublicProfileActivityItem => Boolean(item))
    .sort((left, right) => Date.parse(right.rawTimestamp) - Date.parse(left.rawTimestamp));

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
    .from('profiles_public')
    .select('display_name,xp_state')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (profileError && !isSupabaseCapabilityError(profileError)) {
    return {
      ok: false,
      message: normalizeText(profileError.message, 220) || 'Profil filmi okunamadi.',
      items: [],
    };
  }

  const profileRow = (profileData as ProfileRow | null) || null;
  const xpState = profileRow?.xp_state;
  const visibility = readMobileProfileVisibilityFromXpState(xpState);
  if (!visibility.showActivity) {
    return {
      ok: true,
      message: 'Film kayitlari kapali.',
      items: [],
    };
  }

  const queryLimit = Math.max(20, Math.min(180, Math.floor(Number(limit) || 80)));
  if (xpState && typeof xpState === 'object' && !Array.isArray(xpState)) {
    const xpStateItems = normalizeXpStateRows(
      Array.isArray(xpState.dailyRituals) ? xpState.dailyRituals : []
    ).slice(0, queryLimit);

    if (xpStateItems.length > 0) {
      return {
        ok: true,
        message: 'Film kayitlari guncellendi.',
        items: xpStateItems,
      };
    }
  }

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,movie_title,text,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,text,created_at', orderBy: 'created_at' },
    { select: 'id,movie_title,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,created_at', orderBy: 'created_at' },
    { select: 'id,movie_title,text,year,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,text,year,created_at', orderBy: 'created_at' },
    { select: 'id,movie_title,text,poster_path,year,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,text,poster_path,year,created_at', orderBy: 'created_at' },
    { select: 'id,movie_id,movie_title,text,poster_path,year,genre,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_id,movie_title,text,poster_path,year,genre,created_at', orderBy: 'created_at' },
  ];

  const readRows = async (
    mode: 'user_id' | 'author',
    value: string
  ): Promise<{ rows: RitualRow[]; hasReadError: boolean; fatalMessage: string | null }> => {
    let rows: RitualRow[] = [];
    let hasReadError = false;

    for (const variant of variants) {
      let query = supabase
        .from('rituals')
        .select(variant.select)
        .order(variant.orderBy, { ascending: false })
        .limit(queryLimit);

      query =
        mode === 'user_id'
          ? query.eq('user_id', value)
          : query.ilike('author', value);

      const { data, error } = await query;

      if (error) {
        hasReadError = true;
        if (isSupabaseCapabilityError(error)) continue;
        return {
          rows: [],
          hasReadError,
          fatalMessage: normalizeText(error.message, 220) || 'Profil filmi okunamadi.',
        };
      }

      rows = Array.isArray(data) ? (data as RitualRow[]) : [];
      return { rows, hasReadError, fatalMessage: null };
    }

    return { rows, hasReadError, fatalMessage: null };
  };

  const byUserId = await readRows('user_id', normalizedUserId);
  if (byUserId.fatalMessage) {
    return {
      ok: false,
      message: byUserId.fatalMessage,
      items: [],
    };
  }

  let rows: RitualRow[] = byUserId.rows;
  let hasReadError = byUserId.hasReadError;

  if (rows.length === 0) {
    const authorCandidates = toAuthorCandidates(profileRow);
    for (const candidate of authorCandidates) {
      const byAuthor = await readRows('author', candidate);
      hasReadError = hasReadError || byAuthor.hasReadError;
      if (byAuthor.fatalMessage) {
        return {
          ok: false,
          message: byAuthor.fatalMessage,
          items: [],
        };
      }
      if (byAuthor.rows.length > 0) {
        rows = byAuthor.rows;
        break;
      }
    }
  }

  const items = await enrichItemsWithPoolMetadata(normalizeRows(rows));
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
