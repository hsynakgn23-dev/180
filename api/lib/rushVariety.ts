type RushMovieShape = {
  id: string;
  genre: string | null;
  release_year: number | null;
};

export type RushSelectableQuestion = {
  id: string;
  tmdb_movie_id?: number | null;
  question_order?: number | null;
  question_translations?: Record<string, string> | null;
  options_translations?: Record<string, Record<string, string>> | null;
  difficulty?: string | null;
  question_pool_movies: RushMovieShape | RushMovieShape[] | null;
};

type RushSessionMetadataRow = {
  metadata?: unknown;
};

type RushSelectionHistory = {
  recentMovieIds: Set<string>;
  recentGenres: Set<string>;
};

type RushMovieCandidate<T extends RushSelectableQuestion> = {
  movieId: string;
  genreKey: string;
  decadeKey: string;
  question: T;
};

const normalizeText = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const resolveQuestionMovie = (question: RushSelectableQuestion): RushMovieShape | null => {
  const movie = question.question_pool_movies;
  if (Array.isArray(movie)) {
    return (movie[0] || null) as RushMovieShape | null;
  }
  return movie || null;
};

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
  }
  return result;
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];

const resolveGenreKey = (value: unknown): string => {
  const firstGenre = String(value || '')
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean)[0] || '';
  return normalizeText(firstGenre) || 'unknown';
};

const resolveDecadeKey = (value: unknown): string => {
  const year = Number(value);
  if (!Number.isFinite(year) || year <= 0) return 'unknown';
  return `${Math.floor(year / 10) * 10}s`;
};

const createCandidate = <T extends RushSelectableQuestion>(question: T): RushMovieCandidate<T> => ({
  movieId: String(resolveQuestionMovie(question)?.id || '').trim(),
  genreKey: resolveGenreKey(resolveQuestionMovie(question)?.genre),
  decadeKey: resolveDecadeKey(resolveQuestionMovie(question)?.release_year),
  question,
});

const scoreCandidate = <T extends RushSelectableQuestion>(
  candidate: RushMovieCandidate<T>,
  selectedGenres: string[],
  genreCounts: Map<string, number>,
  decadeCounts: Map<string, number>,
  recentGenres: Set<string>,
): number => {
  const { genreKey, decadeKey } = candidate;
  let score = Math.random() * 0.75;
  const sameAsPrevious = selectedGenres[selectedGenres.length - 1] === genreKey;
  const lastTwoMatch =
    selectedGenres.length >= 2 &&
    selectedGenres[selectedGenres.length - 1] === genreKey &&
    selectedGenres[selectedGenres.length - 2] === genreKey;

  if (lastTwoMatch) score -= 100;
  else if (sameAsPrevious) score -= 3.5;

  score -= (genreCounts.get(genreKey) || 0) * 2.4;
  score -= (decadeCounts.get(decadeKey) || 0) * 1.15;

  if (!(genreCounts.get(genreKey) || 0)) score += 1.6;
  if (!(decadeCounts.get(decadeKey) || 0)) score += 0.7;
  if (recentGenres.has(genreKey)) score -= 0.9;
  if (genreKey === 'unknown') score -= 0.4;
  if (decadeKey === 'unknown') score -= 0.2;

  return score;
};

export const readRushSelectionHistory = (
  sessions: RushSessionMetadataRow[],
): RushSelectionHistory => {
  const recentMovieIds = new Set<string>();
  const recentGenres = new Set<string>();

  for (const session of sessions) {
    const metadata =
      session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
        ? (session.metadata as Record<string, unknown>)
        : {};
    for (const movieId of readStringArray(metadata.questionMovieIds)) {
      recentMovieIds.add(movieId);
    }
    for (const genre of readStringArray(metadata.questionGenres)) {
      recentGenres.add(resolveGenreKey(genre));
    }
  }

  return { recentMovieIds, recentGenres };
};

export const buildRushSessionMetadata = <T extends RushSelectableQuestion>(questions: T[]) => {
  const questionMovieIds = Array.from(
    new Set(
      questions
        .map((question) => String(resolveQuestionMovie(question)?.id || '').trim())
        .filter(Boolean),
    ),
  );
  const questionGenres = Array.from(
    new Set(
      questions
        .map((question) => resolveGenreKey(resolveQuestionMovie(question)?.genre))
        .filter((genre) => genre && genre !== 'unknown'),
    ),
  );

  return {
    selectionVersion: 'balanced_v1',
    questionMovieIds,
    questionGenres,
  };
};

export const selectBalancedRushQuestions = <T extends RushSelectableQuestion>(
  rows: T[],
  count: number,
  history: RushSelectionHistory,
): T[] => {
  const grouped = new Map<string, T[]>();
  for (const row of shuffle(rows)) {
    const movieId = String(resolveQuestionMovie(row)?.id || '').trim();
    if (!movieId) continue;
    const current = grouped.get(movieId) || [];
    current.push(row);
    grouped.set(movieId, current);
  }

  const allCandidates = shuffle(
    Array.from(grouped.values()).map((group) => createCandidate(group[Math.floor(Math.random() * group.length)])),
  );

  const filteredCandidates = allCandidates.filter((candidate) => !history.recentMovieIds.has(candidate.movieId));
  const candidatePool =
    filteredCandidates.length >= Math.min(count, Math.max(8, Math.floor(allCandidates.length * 0.35)))
      ? filteredCandidates
      : allCandidates;

  const pool = [...candidatePool];
  const selected: T[] = [];
  const selectedGenres: string[] = [];
  const genreCounts = new Map<string, number>();
  const decadeCounts = new Map<string, number>();

  while (selected.length < count && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      const score = scoreCandidate(
        candidate,
        selectedGenres,
        genreCounts,
        decadeCounts,
        history.recentGenres,
      );
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [picked] = pool.splice(bestIndex, 1);
    if (!picked) continue;
    selected.push(picked.question);
    selectedGenres.push(picked.genreKey);
    genreCounts.set(picked.genreKey, (genreCounts.get(picked.genreKey) || 0) + 1);
    decadeCounts.set(picked.decadeKey, (decadeCounts.get(picked.decadeKey) || 0) + 1);
  }

  if (selected.length >= count) return selected;

  const selectedQuestionIds = new Set(selected.map((question) => question.id));
  const selectedMovieIds = new Set(
    selected.map((question) => String(resolveQuestionMovie(question)?.id || '').trim()).filter(Boolean),
  );
  const extraRows = shuffle(
    rows.filter(
      (row) =>
        !selectedQuestionIds.has(row.id) &&
        !selectedMovieIds.has(String(resolveQuestionMovie(row)?.id || '').trim()),
    ),
  );

  for (const row of extraRows) {
    if (selected.length >= count) break;
    const movieId = String(resolveQuestionMovie(row)?.id || '').trim();
    if (selectedQuestionIds.has(row.id) || (movieId && selectedMovieIds.has(movieId))) continue;
    selected.push(row);
    selectedQuestionIds.add(row.id);
    if (movieId) selectedMovieIds.add(movieId);
  }

  if (selected.length >= count) return selected;

  const fallbackRows = shuffle(rows.filter((row) => !selectedQuestionIds.has(row.id)));
  for (const row of fallbackRows) {
    if (selected.length >= count) break;
    if (selectedQuestionIds.has(row.id)) continue;
    selected.push(row);
    selectedQuestionIds.add(row.id);
  }

  return selected.slice(0, count);
};
