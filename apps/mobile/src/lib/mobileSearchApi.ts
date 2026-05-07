import { quizRequest } from './quizTransport';

export type MovieSearchResult = {
  id: string;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  director: string | null;
  vote_average: number | null;
};

export type UserSearchResult = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type SearchResults = {
  movies: MovieSearchResult[];
  users: UserSearchResult[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value: unknown, maxLength = 320): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toNullableString = (value: unknown): string | null => {
  const text = normalizeText(value, 400);
  return text || null;
};

const toNullableNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const searchAll = async (q: string): Promise<SearchResults> => {
  try {
    const params = new URLSearchParams({ q, type: 'all' });
    const response = await quizRequest(`/api/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      return { movies: [], users: [] };
    }

    const movies: MovieSearchResult[] = Array.isArray(payload.movies)
      ? payload.movies.filter(isRecord).map((m) => ({
          id: normalizeText(m.id, 120),
          title: normalizeText(m.title, 200),
          poster_path: toNullableString(m.poster_path),
          release_year: toNullableNumber(m.release_year),
          director: toNullableString(m.director),
          vote_average: toNullableNumber(m.vote_average),
        }))
      : [];

    const users: UserSearchResult[] = Array.isArray(payload.users)
      ? payload.users.filter(isRecord).map((u) => ({
          id: normalizeText(u.id, 120),
          username: toNullableString(u.username),
          full_name: toNullableString(u.full_name),
          avatar_url: toNullableString(u.avatar_url),
        }))
      : [];

    return { movies, users };
  } catch {
    return { movies: [], users: [] };
  }
};
