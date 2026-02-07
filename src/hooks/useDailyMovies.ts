import { useEffect, useMemo, useState } from 'react';
import { TMDB_SEEDS } from '../data/tmdbSeeds';
import { DAILY_SLOTS, FALLBACK_GRADIENTS } from '../data/dailyConfig';
import type { Movie } from '../data/mockMovies';
import { supabase, isSupabaseLive } from '../lib/supabase';

type LooseMovie = Partial<Movie> & {
    poster_path?: string;
    posterURL?: string;
    poster_url?: string;
};

interface UseDailyMoviesOptions {
    excludedMovieIds?: number[];
    personalizationSeed?: string;
}

const DAILY_CACHE_KEY = 'DAILY_SELECTION_V16';
const DAILY_MOVIE_COUNT = 5;
const DAILY_MIN_UNIQUE_GENRES = 4;
const CLASSIC_YEAR_THRESHOLD = 2000;
const MODERN_YEAR_THRESHOLD = 2010;
const DAILY_MAX_MOVIES_PER_DIRECTOR = 1;

const getLocalDateKey = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const hashString = (value: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const createSeededRandom = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

const normalizeGenre = (movie: Movie): string => {
    return (movie.genre || '').split('/')[0].trim().toLowerCase();
};

const countUniqueGenres = (movies: Movie[]): number => {
    return new Set(movies.map((movie) => normalizeGenre(movie))).size;
};

const countByGenre = (movies: Movie[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const movie of movies) {
        const genre = normalizeGenre(movie);
        counts.set(genre, (counts.get(genre) || 0) + 1);
    }
    return counts;
};

const applySlotStyles = (movies: Movie[]): Movie[] => {
    return movies.map((movie, index) => ({
        ...movie,
        slotLabel: DAILY_SLOTS[index]?.label,
        color: FALLBACK_GRADIENTS[index] || movie.color
    }));
};

const pickWithDirectorLimit = (pool: Movie[]): Movie[] => {
    const selected: Movie[] = [];
    const directorCounts = new Map<string, number>();

    for (const movie of pool) {
        const directorKey = (movie.director || '').trim().toLowerCase();
        const count = directorCounts.get(directorKey) || 0;
        if (directorKey && count >= DAILY_MAX_MOVIES_PER_DIRECTOR) {
            continue;
        }
        selected.push(movie);
        if (directorKey) {
            directorCounts.set(directorKey, count + 1);
        }
        if (selected.length >= DAILY_MOVIE_COUNT) break;
    }

    if (selected.length < DAILY_MOVIE_COUNT) {
        for (const movie of pool) {
            if (selected.some((selectedMovie) => selectedMovie.id === movie.id)) continue;
            selected.push(movie);
            if (selected.length >= DAILY_MOVIE_COUNT) break;
        }
    }

    return selected.slice(0, DAILY_MOVIE_COUNT);
};

const replaceMovie = (
    selected: Movie[],
    pool: Movie[],
    predicate: (movie: Movie) => boolean,
    canReplace: (movie: Movie, snapshot: Movie[]) => boolean
): Movie[] => {
    if (selected.some(predicate)) return selected;
    const candidate = pool.find((movie) => predicate(movie) && !selected.some((s) => s.id === movie.id));
    if (!candidate) return selected;

    for (let index = selected.length - 1; index >= 0; index -= 1) {
        if (!canReplace(selected[index], selected)) continue;
        const next = [...selected];
        next[index] = candidate;
        return next;
    }

    return selected;
};

const enforceGenreDiversity = (selected: Movie[], pool: Movie[]): Movie[] => {
    const next = [...selected];
    let attempts = 0;

    while (countUniqueGenres(next) < DAILY_MIN_UNIQUE_GENRES && attempts < 10) {
        const currentGenres = new Set(next.map((movie) => normalizeGenre(movie)));
        const candidate = pool.find(
            (movie) =>
                !next.some((selectedMovie) => selectedMovie.id === movie.id) &&
                !currentGenres.has(normalizeGenre(movie))
        );
        if (!candidate) break;

        const genreCounts = countByGenre(next);
        const classics = next.filter((movie) => movie.year < CLASSIC_YEAR_THRESHOLD).length;
        const moderns = next.filter((movie) => movie.year >= MODERN_YEAR_THRESHOLD).length;

        let replaceIndex = -1;
        for (let i = next.length - 1; i >= 0; i -= 1) {
            const movie = next[i];
            const genre = normalizeGenre(movie);
            const canDropGenre = (genreCounts.get(genre) || 0) > 1;
            if (!canDropGenre) continue;
            if (movie.year < CLASSIC_YEAR_THRESHOLD && classics <= 1) continue;
            if (movie.year >= MODERN_YEAR_THRESHOLD && moderns <= 1) continue;
            replaceIndex = i;
            break;
        }

        if (replaceIndex < 0) break;
        next[replaceIndex] = candidate;
        attempts += 1;
    }

    return next;
};

const buildDailySeedMovies = (dateKey: string): Movie[] => {
    const pool = Array.from(
        new Map(TMDB_SEEDS.map((movie) => [movie.id, movie])).values()
    );
    if (pool.length === 0) return [];

    const random = createSeededRandom(hashString(`daily:${dateKey}`));
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let selected = pickWithDirectorLimit(pool);
    selected = replaceMovie(
        selected,
        pool,
        (movie) => movie.year < CLASSIC_YEAR_THRESHOLD,
        (movie) => movie.year >= CLASSIC_YEAR_THRESHOLD
    );
    selected = replaceMovie(
        selected,
        pool,
        (movie) => movie.year >= MODERN_YEAR_THRESHOLD,
        (movie, snapshot) => {
            if (movie.year >= CLASSIC_YEAR_THRESHOLD) return true;
            return snapshot.filter((item) => item.year < CLASSIC_YEAR_THRESHOLD).length > 1;
        }
    );
    selected = enforceGenreDiversity(selected, pool);

    return applySlotStyles(selected);
};

const normalizeMovie = (input: unknown): Movie => {
    if (!input || typeof input !== 'object') {
        return input as Movie;
    }
    const movie = input as LooseMovie;
    const posterPath = movie.posterPath ?? movie.poster_path ?? movie.posterURL ?? movie.poster_url;
    return { ...(movie as Movie), posterPath };
};

const normalizeMovieIds = (movieIds: number[] = []): number[] => {
    return Array.from(
        new Set(
            movieIds
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );
};

const buildPersonalizedDailyMovies = (
    baseMovies: Movie[],
    excludedMovieIds: number[],
    dateKey: string,
    personalizationSeed: string
): Movie[] => {
    const base = baseMovies.slice(0, DAILY_MOVIE_COUNT);
    if (base.length === 0) return [];

    const excludedSet = new Set(normalizeMovieIds(excludedMovieIds));
    if (excludedSet.size === 0) return applySlotStyles(base);

    const replacementPool = Array.from(
        new Map(TMDB_SEEDS.map((movie) => [movie.id, movie])).values()
    );
    const baseMovieIds = new Set(base.map((movie) => movie.id));
    const random = createSeededRandom(hashString(`daily-user:${dateKey}:${personalizationSeed}`));

    for (let i = replacementPool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [replacementPool[i], replacementPool[j]] = [replacementPool[j], replacementPool[i]];
    }

    const usedMovieIds = new Set<number>();
    const availableReplacements = replacementPool.filter(
        (movie) => !excludedSet.has(movie.id) && !baseMovieIds.has(movie.id)
    );

    const personalized = base.map((movie) => {
        if (!excludedSet.has(movie.id) && !usedMovieIds.has(movie.id)) {
            usedMovieIds.add(movie.id);
            return movie;
        }

        const replacement = availableReplacements.find((candidate) => !usedMovieIds.has(candidate.id));
        if (!replacement) {
            usedMovieIds.add(movie.id);
            return movie;
        }

        usedMovieIds.add(replacement.id);
        return replacement;
    });

    return applySlotStyles(personalized);
};

export const useDailyMovies = ({ excludedMovieIds = [], personalizationSeed = 'guest' }: UseDailyMoviesOptions = {}) => {
    const [baseMovies, setBaseMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateKey, setDateKey] = useState<string>(getLocalDateKey);

    useEffect(() => {
        let midnightTimer: number | null = null;

        const syncDateKey = () => {
            const nextDateKey = getLocalDateKey();
            setDateKey((prev) => (prev === nextDateKey ? prev : nextDateKey));
        };

        const scheduleMidnightTick = () => {
            const now = new Date();
            const nextMidnight = new Date(now);
            nextMidnight.setHours(24, 0, 0, 120);
            const waitMs = Math.max(100, nextMidnight.getTime() - now.getTime());
            midnightTimer = window.setTimeout(() => {
                syncDateKey();
                scheduleMidnightTick();
            }, waitMs);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                syncDateKey();
            }
        };

        syncDateKey();
        scheduleMidnightTick();
        window.addEventListener('focus', syncDateKey);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (midnightTimer !== null) {
                window.clearTimeout(midnightTimer);
            }
            window.removeEventListener('focus', syncDateKey);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    useEffect(() => {
        const fetchDaily5 = async () => {
            setLoading(true);
            const todayKey = dateKey;
            const isDev = import.meta.env.DEV;
            // Client write path is restricted to local/dev. Production write source should be cron/service role.
            const allowClientDailyWrite =
                isDev && import.meta.env.VITE_ALLOW_CLIENT_DAILY_WRITE === '1';

            // 1. SUPABASE STRATEGY (The Absolute Source)
            if (isSupabaseLive() && supabase) {
                if (isDev) {
                    console.log('[Daily5] Checking Supabase for global sync...');
                }

                try {
                    // a) READ from DB
                    const { data, error } = await supabase
                        .from('daily_showcase')
                        .select('*')
                        .eq('date', todayKey)
                        .single();

                    if (data && data.movies) {
                        if (isDev) {
                            console.log('[Daily5] Sync successful. Using global daily selection.');
                        }
                        const fromDb = Array.isArray(data.movies) ? (data.movies as unknown[]) : [];
                        const normalized = fromDb.map((m: unknown) => normalizeMovie(m));
                        setBaseMovies(normalized);
                        setLoading(false);
                        return;
                    }

                    if (error && error.code !== 'PGRST116') { // PGRST116 is 'Row not found', which is expected first time
                        console.warn('[Daily5] Supabase Error:', error);
                    }

                    // b) WRITE to DB (First user of the day)
                    // If we are here, DB is empty for today. We must generate the list using our existing logic.
                    if (isDev) {
                        console.log('[Daily5] No entry for today. Generating Global Daily 5...');
                    }
                } catch (err) {
                    console.error('[Daily5] DB Connection failed, falling back to local.', err);
                }
            }

            // --- EXISTING LOGIC STARTS HERE (As Fallback or Generator) ---

            // 2. Check Local Cache (Fallback for offline/no-db)
            const cachedData = localStorage.getItem(DAILY_CACHE_KEY);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData) as { date?: string; movies?: unknown[] };
                    const date = parsed?.date;
                    const cachedMovies = Array.isArray(parsed?.movies) ? parsed.movies : [];
                    if (date === todayKey && cachedMovies.length === DAILY_MOVIE_COUNT) {
                        const normalized = cachedMovies.map((m) => normalizeMovie(m));
                        setBaseMovies(normalized);
                        setLoading(false);
                        return;
                    }
                } catch {
                    localStorage.removeItem(DAILY_CACHE_KEY);
                }
            }

            const apiKey = import.meta.env.VITE_TMDB_API_KEY;

            // IMPORTANT: In "Generator Mode" (writing to DB), we PREFER live API data over seeds if possible,
            // but we must VALIDATE it.
            // For now, to ensure stability, we will stick to the working SEED logic or existing API logic, 
            // but if we had the DB, we would save the result there.

            // For this phase, we keep FORCE_SEEDS = true to ensure the "Generator" produces good data.
            // Once the DB is live, we can relax this to allow API generation.
            const FORCE_SEEDS = true;

            let finalMovies: Movie[] = [];

            if (FORCE_SEEDS) {
                finalMovies = buildDailySeedMovies(todayKey);
            } else if (apiKey && apiKey !== 'YOUR_TMDB_API_KEY') {
                // ... (Original API logic would go here if we disabled force seeds) ...
                // Keeping it short for now as per instructions to rely on seeds.
                finalMovies = buildDailySeedMovies(todayKey);
            } else {
                finalMovies = buildDailySeedMovies(todayKey);
            }

            // c) SAVE TO DB (Only when explicitly enabled; cron should be the default writer)
            if (allowClientDailyWrite && isSupabaseLive() && supabase && finalMovies.length === 5) {
                if (isDev) {
                    console.log('[Daily5] Writing generated list to Supabase...');
                }
                const { error: insertError } = await supabase
                    .from('daily_showcase')
                    .upsert([{ date: todayKey, movies: finalMovies }], {
                        onConflict: 'date',
                        ignoreDuplicates: true
                    });

                if (insertError) console.error('[Daily5] Failed to write to DB:', insertError);
            }

            // Local Cache & Set State
            localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ date: todayKey, movies: finalMovies }));
            setBaseMovies(finalMovies);
            setLoading(false);
        };

        fetchDaily5();
    }, [dateKey]);

    const exclusionKey = normalizeMovieIds(excludedMovieIds).sort((a, b) => a - b).join(',');

    const movies = useMemo(() => {
        return buildPersonalizedDailyMovies(baseMovies, excludedMovieIds, dateKey, personalizationSeed);
    }, [baseMovies, dateKey, exclusionKey, excludedMovieIds, personalizationSeed]);

    return { movies, loading, dateKey };
};
