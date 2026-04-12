import AsyncStorage from '@react-native-async-storage/async-storage';

const BLUR_VARIETY_STORAGE_KEY = 'mobile.blurQuizVariety.v1';
const MAX_RECENT_MOVIE_IDS = 10;
const MAX_RECENT_GENRES = 3;

export type BlurQuizVarietyHistory = {
  recentMovieIds: string[];
  recentGenres: string[];
};

const EMPTY_HISTORY: BlurQuizVarietyHistory = {
  recentMovieIds: [],
  recentGenres: [],
};

const normalizeText = (value: unknown, maxLength = 120): string => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

export const normalizeBlurGenreKey = (value: unknown): string => {
  const primaryGenre = String(value || '')
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean)[0] || '';
  return normalizeText(primaryGenre, 80);
};

const dedupe = (items: string[], limit: number): string[] => {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
    if (unique.length >= limit) break;
  }
  return unique;
};

export const readBlurQuizVarietyHistory = async (): Promise<BlurQuizVarietyHistory> => {
  try {
    const raw = await AsyncStorage.getItem(BLUR_VARIETY_STORAGE_KEY);
    if (!raw) return EMPTY_HISTORY;
    const parsed = JSON.parse(raw) as Partial<BlurQuizVarietyHistory>;
    return {
      recentMovieIds: dedupe(Array.isArray(parsed.recentMovieIds) ? parsed.recentMovieIds : [], MAX_RECENT_MOVIE_IDS),
      recentGenres: dedupe(Array.isArray(parsed.recentGenres) ? parsed.recentGenres : [], MAX_RECENT_GENRES),
    };
  } catch {
    return EMPTY_HISTORY;
  }
};

export const rememberBlurQuizPick = async (input: {
  movieId: string;
  genre: string;
}): Promise<BlurQuizVarietyHistory> => {
  const current = await readBlurQuizVarietyHistory();
  const next: BlurQuizVarietyHistory = {
    recentMovieIds: dedupe([input.movieId, ...current.recentMovieIds], MAX_RECENT_MOVIE_IDS),
    recentGenres: dedupe([input.genre, ...current.recentGenres], MAX_RECENT_GENRES),
  };

  try {
    await AsyncStorage.setItem(BLUR_VARIETY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
};
