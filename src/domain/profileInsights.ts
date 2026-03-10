import { TMDB_SEEDS } from '../data/tmdbSeeds';

export type ProfileInsightRecord = {
  movieId?: number | null;
  movieTitle?: string | null;
  text?: string | null;
  genre?: string | null;
  dayKey?: string | null;
  rawTimestamp?: string | null;
  dateKey?: string | null;
  posterPath?: string | null;
  year?: number | null;
};

export type ProfileGenreDistributionItem = {
  genre: string;
  count: number;
  share: number;
};

export type ProfileDnaSegment = {
  id: string;
  label: string;
  detail: string;
  unlocked: boolean;
};

export type ProfileFilmSummary = {
  key: string;
  movieId: number | null;
  title: string;
  count: number;
  lastDate: string;
  lastText: string;
  genre: string | null;
  posterPath: string | null;
  year: number | null;
};

export type ProfileActivityPulse = {
  commentsCount: number;
  filmsCount: number;
  topGenre: string;
  mostCommented: string;
};

const HIDDEN_GEM_MOVIE_IDS = new Set(
  TMDB_SEEDS.filter((movie) => typeof movie.voteAverage === 'number' && movie.voteAverage <= 7.9).map(
    (movie) => movie.id
  )
);

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeMovieId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const movieId = Math.floor(parsed);
  return movieId > 0 ? movieId : null;
};

const toSafeYear = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const year = Math.floor(parsed);
  if (year < 1850 || year > 2200) return null;
  return year;
};

const toSortMs = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareDateLike = (left: string, right: string): number => {
  const leftMs = toSortMs(left);
  const rightMs = toSortMs(right);
  if (leftMs !== rightMs) return rightMs - leftMs;
  return right.localeCompare(left);
};

export const buildProfileGenreDistribution = (
  records: ProfileInsightRecord[],
  limit = 5
): ProfileGenreDistributionItem[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    const genre = normalizeText(record.genre, 48);
    if (!genre) continue;
    counts.set(genre, (counts.get(genre) || 0) + 1);
  }

  const totalCount = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const safeLimit = Math.max(1, Math.min(12, Math.floor(Number(limit) || 5)));

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, safeLimit)
    .map(([genre, count]) => ({
      genre,
      count,
      share: totalCount > 0 ? count / totalCount : 0,
    }));
};

export const countProfileHiddenGemSignals = (records: ProfileInsightRecord[]): number =>
  records.reduce((sum, record) => {
    const movieId = toSafeMovieId(record.movieId);
    return movieId && HIDDEN_GEM_MOVIE_IDS.has(movieId) ? sum + 1 : sum;
  }, 0);

export const countProfileExactCommentSignals = (
  records: ProfileInsightRecord[],
  exactLength = 180
): number =>
  records.reduce((sum, record) => {
    const text = normalizeText(record.text, 800);
    return text.length === exactLength ? sum + 1 : sum;
  }, 0);

export const buildProfileDnaSegments = ({
  genreItems,
  hiddenGemCount,
  exactCommentCount,
  streak,
  uniqueGenreCount,
}: {
  genreItems: ProfileGenreDistributionItem[];
  hiddenGemCount: number;
  exactCommentCount: number;
  streak: number;
  uniqueGenreCount?: number;
}): ProfileDnaSegment[] => {
  const resolvedUniqueGenreCount = Math.max(0, Math.floor(uniqueGenreCount ?? genreItems.length));
  const dominantGenreEntry = genreItems[0];
  const dominantGenreLabel = dominantGenreEntry
    ? `${dominantGenreEntry.genre} x${dominantGenreEntry.count}`
    : 'No genre signal yet';

  return [
    {
      id: 'hidden-gem',
      label: 'Hidden Gem Detector',
      detail: `${hiddenGemCount}/10 low-score gems`,
      unlocked: hiddenGemCount >= 10,
    },
    {
      id: 'genre-nomad',
      label: 'Genre Nomad',
      detail: `${resolvedUniqueGenreCount}/6 unique genres`,
      unlocked: resolvedUniqueGenreCount >= 6,
    },
    {
      id: 'precision-loop',
      label: 'Precision Loop',
      detail: `${exactCommentCount}/5 exact-180 comments`,
      unlocked: exactCommentCount >= 5,
    },
    {
      id: 'rhythm-engine',
      label: 'Rhythm Engine',
      detail: `${Math.max(0, Math.floor(streak || 0))}/7 active streak`,
      unlocked: Math.max(0, Math.floor(streak || 0)) >= 7,
    },
    {
      id: 'dominant-tone',
      label: 'Dominant Tone',
      detail: dominantGenreLabel,
      unlocked: Boolean(dominantGenreEntry && dominantGenreEntry.count >= 8),
    },
  ];
};

export const buildProfileFilmSummaries = (
  records: ProfileInsightRecord[],
  limit?: number
): ProfileFilmSummary[] => {
  const filmMap = new Map<string, ProfileFilmSummary>();

  for (const record of records) {
    const title =
      normalizeText(record.movieTitle, 180) ||
      (toSafeMovieId(record.movieId) ? `Film #${String(record.movieId)}` : '');
    if (!title) continue;

    const movieId = toSafeMovieId(record.movieId);
    const year = toSafeYear(record.year);
    const key = movieId ? `movie:${movieId}` : `title:${title.toLowerCase()}::${year ?? ''}`;
    const lastDate =
      normalizeText(record.dateKey, 80) ||
      normalizeText(record.dayKey, 80) ||
      normalizeText(record.rawTimestamp, 80) || '';
    const nextText = normalizeText(record.text, 400);
    const nextGenre = normalizeText(record.genre, 80) || null;
    const nextPosterPath = normalizeText(record.posterPath, 600) || null;
    const existing = filmMap.get(key);

    if (!existing) {
      filmMap.set(key, {
        key,
        movieId,
        title,
        count: 1,
        lastDate,
        lastText: nextText,
        genre: nextGenre,
        posterPath: nextPosterPath,
        year,
      });
      continue;
    }

    existing.count += 1;
    if (!existing.lastDate || compareDateLike(existing.lastDate, lastDate) > 0) {
      existing.lastDate = lastDate || existing.lastDate;
      existing.lastText = nextText || existing.lastText;
      existing.genre = nextGenre || existing.genre;
      existing.posterPath = nextPosterPath || existing.posterPath;
    }
  }

  const sorted = Array.from(filmMap.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return compareDateLike(left.lastDate, right.lastDate);
  });

  if (typeof limit !== 'number') return sorted;
  const safeLimit = Math.max(1, Math.min(40, Math.floor(limit)));
  return sorted.slice(0, safeLimit);
};

export const buildProfileActivityPulse = ({
  records,
  genreItems,
  filmSummaries,
}: {
  records: ProfileInsightRecord[];
  genreItems: ProfileGenreDistributionItem[];
  filmSummaries?: ProfileFilmSummary[];
}): ProfileActivityPulse => {
  const resolvedFilmSummaries = Array.isArray(filmSummaries)
    ? filmSummaries
    : buildProfileFilmSummaries(records);

  return {
    commentsCount: records.length,
    filmsCount: resolvedFilmSummaries.length,
    topGenre: genreItems[0]?.genre || 'No records',
    mostCommented: resolvedFilmSummaries[0]?.title || 'No records',
  };
};

