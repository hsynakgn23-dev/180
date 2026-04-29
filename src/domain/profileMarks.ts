import { MARK_CATALOG } from './marksCatalog.js';
import { readProfileFollowingCount } from './profileSocialState.js';
import { TMDB_SEEDS } from '../data/tmdbSeeds.js';
import { getLocalDateKey } from '../context/xpShared/state.js';

type ProfileXpState = Record<string, unknown>;

type StoredRitualEntry = {
  dateKey: string | null;
  movieId: number | null;
  movieTitle: string;
  text: string;
  genre: string | null;
  year: number | null;
  sortKey: string;
};

export type ResolvedProfileMarks = {
  marks: string[];
  featuredMarks: string[];
};

const LONG_FORM_RITUAL_THRESHOLD = 160;
const MARK_ORDER = new Map(MARK_CATALOG.map((mark, index) => [mark.id, index] as const));
const MOVIE_BY_TITLE = new Map(
  TMDB_SEEDS.map((movie) => [String(movie.title || '').trim().toLowerCase(), movie] as const)
);
const HIDDEN_GEM_MOVIE_IDS = new Set(
  TMDB_SEEDS.filter((movie) => typeof movie.voteAverage === 'number' && movie.voteAverage <= 7.9).map(
    (movie) => movie.id
  )
);

const MARK_KEYS = [
  'marks',
  'markIds',
  'mark_ids',
  'unlockedMarks',
  'unlocked_mark_ids',
  'badgeIds',
  'badge_ids',
  'badges',
] as const;

const FEATURED_MARK_KEYS = [
  'featuredMarks',
  'featuredMarkIds',
  'featured_mark_ids',
  'featured_marks',
] as const;

const normalizeText = (value: unknown, maxLength = 180): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
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

const sanitizeStringList = (value: unknown, maxItems = 120, itemLimit = 80): string[] => {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((entry) => normalizeText(entry, itemLimit))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, maxItems);
};

const normalizeDateKey = (value: unknown): string | null => {
  const text = normalizeText(value, 80);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateKey(parsed);
};

const parseDateKeyToDayIndex = (dateKey: string): number | null => {
  const parts = dateKey.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / (24 * 60 * 60 * 1000));
};

const sortDateKeysDesc = (dateKeys: string[]): string[] =>
  Array.from(
    new Set(dateKeys.map((dateKey) => normalizeDateKey(dateKey)).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => {
    const leftIndex = parseDateKeyToDayIndex(left) ?? 0;
    const rightIndex = parseDateKeyToDayIndex(right) ?? 0;
    return rightIndex - leftIndex;
  });

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

const collectMarkIds = (
  xpState: ProfileXpState,
  keys: readonly string[],
  maxItems: number
): string[] =>
  Array.from(
    new Set(
      keys.flatMap((key) => sanitizeStringList(xpState[key], maxItems, 80))
    )
  ).slice(0, maxItems);

const parseStoredRituals = (value: unknown): StoredRitualEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const row = entry as Record<string, unknown>;
      const movieTitle = normalizeText(row.movieTitle ?? row.movie_title ?? row.title, 180);
      const text = normalizeText(row.text ?? row.comment ?? row.note ?? row.body, 400);
      if (!movieTitle || !text) return null;

      const seed = MOVIE_BY_TITLE.get(movieTitle.toLowerCase());
      const rawDate =
        normalizeDateKey(row.date ?? row.dayKey ?? row.day_key) ||
        normalizeDateKey(row.timestamp ?? row.createdAt ?? row.created_at);

      return {
        dateKey: rawDate,
        movieId: toSafeMovieId(row.movieId ?? row.movie_id) ?? (seed ? toSafeMovieId(seed.id) : null),
        movieTitle,
        text,
        genre:
          normalizeText(row.genre ?? row.movieGenre ?? row.movie_genre, 80) ||
          normalizeText(seed?.genre, 80) ||
          null,
        year:
          toSafeYear(row.year ?? row.releaseYear ?? row.release_year) ??
          (seed ? toSafeYear((seed as { year?: unknown }).year) : null),
        sortKey:
          normalizeText(row.timestamp ?? row.createdAt ?? row.created_at, 80) ||
          rawDate ||
          movieTitle.toLowerCase(),
      } satisfies StoredRitualEntry;
    })
    .filter((entry): entry is StoredRitualEntry => Boolean(entry))
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
    .slice(0, 420);
};

const applyMark = (marks: string[], markId: string): string[] =>
  marks.includes(markId) ? marks : [...marks, markId];

const sortMarkIds = (markIds: string[]): string[] =>
  Array.from(new Set(markIds.map((markId) => normalizeText(markId, 80)).filter(Boolean))).sort((left, right) => {
    const leftOrder = MARK_ORDER.get(left);
    const rightOrder = MARK_ORDER.get(right);
    if (leftOrder != null && rightOrder != null) return leftOrder - rightOrder;
    if (leftOrder != null) return -1;
    if (rightOrder != null) return 1;
    return left.localeCompare(right);
  });

export const resolveStoredProfileMarks = (
  xpState: ProfileXpState | null | undefined
): ResolvedProfileMarks => {
  if (!xpState || typeof xpState !== 'object' || Array.isArray(xpState)) {
    return { marks: [], featuredMarks: [] };
  }

  let marks = collectMarkIds(xpState, MARK_KEYS, 160);
  const featuredMarks = collectMarkIds(xpState, FEATURED_MARK_KEYS, 8);
  const rituals = parseStoredRituals(xpState.dailyRituals);
  const activeDays = sortDateKeysDesc([
    ...sanitizeStringList(xpState.activeDays, 420, 40),
    ...rituals.map((ritual) => ritual.dateKey).filter((value): value is string => Boolean(value)),
  ]);

  const streak = Math.max(toSafeInt(xpState.streak), computeCurrentStreak(activeDays));
  const uniqueGenres = new Set(
    [
      ...sanitizeStringList(xpState.uniqueGenres, 40, 80),
      ...rituals.map((ritual) => normalizeText(ritual.genre, 80)).filter(Boolean),
    ].map((genre) => genre.toLowerCase())
  );

  if (rituals.length > 0) {
    marks = applyMark(marks, 'first_mark');
    marks = applyMark(marks, 'mystery_solver');
  }

  const exact180Count = rituals.filter((ritual) => ritual.text.length === 180).length;
  if (exact180Count > 0) marks = applyMark(marks, '180_exact');
  if (exact180Count >= 3) marks = applyMark(marks, 'precision_loop');
  if (rituals.some((ritual) => ritual.text.length < 40)) marks = applyMark(marks, 'minimalist');
  if (rituals.some((ritual) => ritual.text.length >= LONG_FORM_RITUAL_THRESHOLD)) {
    marks = applyMark(marks, 'deep_diver');
  }

  if (toSafeInt(xpState.nonConsecutiveCount) >= 10) marks = applyMark(marks, 'no_rush');
  if (streak >= 3) marks = applyMark(marks, 'daily_regular');
  if (streak >= 5) marks = applyMark(marks, 'held_for_five');
  if (streak >= 7) marks = applyMark(marks, 'seven_quiet_days');
  if (streak >= 14) marks = applyMark(marks, 'streak_fourteen');
  if (streak >= 30) marks = applyMark(marks, 'streak_thirty');
  if (rituals.length >= 20) marks = applyMark(marks, 'ritual_marathon');
  if (rituals.length >= 50) marks = applyMark(marks, 'archive_keeper');

  if (activeDays.length >= 14) marks = applyMark(marks, 'daybreaker');
  if (activeDays.length >= 30) marks = applyMark(marks, 'legacy');

  if (uniqueGenres.size >= 3) marks = applyMark(marks, 'genre_discovery');
  if (uniqueGenres.size >= 10) marks = applyMark(marks, 'wide_lens');

  const genreCounts = new Map<string, number>();
  for (const ritual of rituals) {
    const genreKey = normalizeText(ritual.genre, 80).toLowerCase();
    if (!genreKey) continue;
    genreCounts.set(genreKey, (genreCounts.get(genreKey) || 0) + 1);
  }

  if (Array.from(genreCounts.values()).some((count) => count >= 20)) {
    marks = applyMark(marks, 'one_genre_devotion');
  }

  const latestFiveGenres = rituals
    .map((ritual) => normalizeText(ritual.genre, 80).toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
  if (latestFiveGenres.length === 5 && new Set(latestFiveGenres).size === 5) {
    marks = applyMark(marks, 'genre_nomad');
  }

  if (rituals.some((ritual) => typeof ritual.year === 'number' && ritual.year < 1990)) {
    marks = applyMark(marks, 'classic_soul');
  }
  if (rituals.some((ritual) => ritual.movieId != null && HIDDEN_GEM_MOVIE_IDS.has(ritual.movieId))) {
    marks = applyMark(marks, 'hidden_gem');
  }

  const followingCount = readProfileFollowingCount(xpState);
  if (followingCount >= 5) marks = applyMark(marks, 'quiet_following');

  const echoesGiven = toSafeInt(xpState.echoesGiven);
  const echoesReceived = toSafeInt(xpState.echoesReceived);
  if (echoesGiven >= 1) marks = applyMark(marks, 'echo_initiate');
  if (echoesGiven >= 10) marks = applyMark(marks, 'echo_chamber');
  if (echoesReceived >= 1) {
    marks = applyMark(marks, 'first_echo');
    marks = applyMark(marks, 'echo_receiver');
  }
  if (echoesReceived >= 5) {
    marks = applyMark(marks, 'influencer');
    marks = applyMark(marks, 'resonator');
  }

  const totalPoolAnswered = toSafeInt(xpState.totalPoolAnswered);
  const totalPoolCorrect = toSafeInt(xpState.totalPoolCorrect);
  const perfectFilmCount = toSafeInt(xpState.perfectFilmCount);
  const consecutivePerfect = toSafeInt(xpState.consecutivePerfect);
  const rushSessions = toSafeInt(xpState.rushSessions);
  const rushBestScore10 = toSafeInt(xpState.rushBestScore10);
  const rushBestScore20 = toSafeInt(xpState.rushBestScore20);
  const rushEndlessBest = toSafeInt(xpState.rushEndlessBest);
  const swipeCount = toSafeInt(xpState.swipeCount);
  const genresAnswered = sanitizeStringList(xpState.genresAnswered, 80, 80);

  if (totalPoolAnswered >= 1) marks = applyMark(marks, 'first_answer');
  if (totalPoolAnswered >= 25) marks = applyMark(marks, 'quiz_curious');
  if (totalPoolAnswered >= 100) marks = applyMark(marks, 'quiz_scholar');
  if (totalPoolCorrect >= 500) marks = applyMark(marks, 'quiz_master');
  if (perfectFilmCount >= 1) marks = applyMark(marks, 'perfect_film');
  if (consecutivePerfect >= 3) marks = applyMark(marks, 'perfect_streak');
  if (rushSessions >= 1) marks = applyMark(marks, 'rush_survivor');
  if (rushBestScore10 >= 7) marks = applyMark(marks, 'rush_ace');
  if (rushBestScore20 >= 14) marks = applyMark(marks, 'rush_legend');
  if (rushEndlessBest >= 10) marks = applyMark(marks, 'rush_endless_10');
  if (swipeCount >= 20) marks = applyMark(marks, 'swipe_explorer');
  if (genresAnswered.length >= 5) marks = applyMark(marks, 'genre_brain');

  const sortedMarks = sortMarkIds(marks);
  return {
    marks: sortedMarks,
    featuredMarks: sortMarkIds(featuredMarks.filter((markId) => sortedMarks.includes(markId))).slice(0, 8),
  };
};
