import { buildApiUrl } from './apiBase';
import { fetchWithAuth } from './fetchWithAuth';

export interface MovieSearchResult {
  id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  genre: string | null;
  director: string | null;
  vote_average: number | null;
}

export interface UserSearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_id: string | null;
  avatar_url: string | null;
}

export interface SearchResults {
  movies: MovieSearchResult[];
  users: UserSearchResult[];
}

export interface CastMember {
  name: string;
  character: string;
  profile_path: string | null;
}

export interface MoviePageData {
  id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: number | null;
  genre: string | null;
  director: string | null;
  vote_average: number | null;
  runtime: number | null;
  tagline: string | null;
  overview: string | null;
  cast_details: CastMember[] | null;
  keywords: { id: number; name: string }[] | null;
}

export interface MoviePageResponse {
  movie: MoviePageData;
  recommendations: MovieSearchResult[];
  isFirstVisit: boolean;
  xpAwarded: number;
}

export interface MovieRitualResponse {
  ritual: {
    id: string;
    text: string;
    rating: number | null;
    created_at: string;
    movie_title: string;
    poster_path: string | null;
  };
  xpAwarded: number;
  movieRitualsWrittenIncrement: number;
}

export async function searchAll(q: string, type: 'movies' | 'users' | 'all' = 'all'): Promise<SearchResults> {
  const url = buildApiUrl(`/api/search?q=${encodeURIComponent(q)}&type=${type}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<SearchResults>;
}

export async function fetchMoviePage(movieId: string): Promise<MoviePageResponse> {
  const url = buildApiUrl(`/api/movie-page?movie_id=${encodeURIComponent(movieId)}`);
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error('Movie not found');
  return res.json() as Promise<MoviePageResponse>;
}

export async function submitMovieRitual(
  poolMovieId: string,
  text: string,
  rating?: number
): Promise<MovieRitualResponse> {
  const url = buildApiUrl('/api/movie-ritual');
  const res = await fetchWithAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pool_movie_id: poolMovieId, text, rating }),
    isWrite: true,
  });
  if (!res.ok) {
    const data = await res.json() as { error?: string };
    throw new Error(data.error || 'Failed to submit ritual');
  }
  return res.json() as Promise<MovieRitualResponse>;
}
