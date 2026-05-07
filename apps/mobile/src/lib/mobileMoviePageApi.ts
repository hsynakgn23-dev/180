import { buildQuizAuthHeaders, quizRequest } from './quizTransport';

export type MobileMovieCastMember = {
  name: string;
  character: string;
  profile_path: string | null;
};

export type MobileMoviePageData = {
  id: string;
  title: string;
  tagline: string | null;
  overview: string | null;
  release_year: number | null;
  runtime: number | null;
  director: string | null;
  genre: string | null;
  vote_average: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  cast_details: MobileMovieCastMember[];
};

export type MobileMovieRecommendation = {
  id: string;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  director: string | null;
};

export type MobileMoviePageResponse =
  | { ok: true; movie: MobileMoviePageData; recommendations: MobileMovieRecommendation[] }
  | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value: unknown, maxLength = 320): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

export const fetchMobileMoviePage = async (
  movieId: string
): Promise<MobileMoviePageResponse> => {
  try {
    const authHeaders = await buildQuizAuthHeaders();
    const response = await quizRequest(`/api/movie-page/${encodeURIComponent(movieId)}`, {
      headers: { Accept: 'application/json', ...authHeaders },
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const err = isRecord(payload) ? normalizeText(payload.error, 240) : '';
      return { ok: false, error: err || `HTTP ${response.status}` };
    }

    const rawMovie = isRecord(payload.movie) ? payload.movie : {};

    const castDetails: MobileMovieCastMember[] = Array.isArray(rawMovie.cast_details)
      ? rawMovie.cast_details.filter(isRecord).map((c) => ({
          name: normalizeText(c.name, 200),
          character: normalizeText(c.character, 200),
          profile_path: normalizeText(c.profile_path, 400) || null,
        }))
      : [];

    const movie: MobileMoviePageData = {
      id: normalizeText(rawMovie.id, 120),
      title: normalizeText(rawMovie.title, 200),
      tagline: normalizeText(rawMovie.tagline, 300) || null,
      overview: normalizeText(rawMovie.overview, 1000) || null,
      release_year: Number(rawMovie.release_year) || null,
      runtime: Number(rawMovie.runtime) || null,
      director: normalizeText(rawMovie.director, 200) || null,
      genre: normalizeText(rawMovie.genre, 200) || null,
      vote_average: Number(rawMovie.vote_average) || null,
      poster_path: normalizeText(rawMovie.poster_path, 400) || null,
      backdrop_path: normalizeText(rawMovie.backdrop_path, 400) || null,
      cast_details: castDetails,
    };

    const recommendations: MobileMovieRecommendation[] = Array.isArray(payload.recommendations)
      ? payload.recommendations.filter(isRecord).map((r) => ({
          id: normalizeText(r.id, 120),
          title: normalizeText(r.title, 200),
          poster_path: normalizeText(r.poster_path, 400) || null,
          release_year: Number(r.release_year) || null,
          director: normalizeText(r.director, 200) || null,
        }))
      : [];

    return { ok: true, movie, recommendations };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Film bilgileri yuklenemedi.',
    };
  }
};
