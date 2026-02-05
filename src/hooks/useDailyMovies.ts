import { useState, useEffect } from 'react';
import { TMDB_SEEDS } from '../data/tmdbSeeds';
import { DAILY_SLOTS, FALLBACK_GRADIENTS } from '../data/dailyConfig';
import type { Movie } from '../data/mockMovies';

const normalizeMovie = (movie: any): Movie => {
    if (!movie) return movie;
    const posterPath = movie.posterPath ?? movie.poster_path ?? movie.posterURL ?? movie.poster_url;
    return { ...movie, posterPath };
};

export const useDailyMovies = () => {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDaily5 = async () => {
            const todayKey = new Date().toISOString().split('T')[0];
            const { supabase, isSupabaseLive } = await import('../lib/supabase');

            // 1. SUPABASE STRATEGY (The Absolute Source)
            if (isSupabaseLive() && supabase) {
                console.log('[Daily5] Checking Supabase for global sync...');

                try {
                    // a) READ from DB
                    const { data, error } = await supabase
                        .from('daily_showcase')
                        .select('*')
                        .eq('date', todayKey)
                        .single();

                    if (data && data.movies) {
                        console.log('[Daily5] Sync successful. Using global daily selection.');
                        const normalized = data.movies.map((m: any) => normalizeMovie(m));
                        setMovies(normalized);
                        setLoading(false);
                        return;
                    }

                    if (error && error.code !== 'PGRST116') { // PGRST116 is 'Row not found', which is expected first time
                        console.warn('[Daily5] Supabase Error:', error);
                    }

                    // b) WRITE to DB (First user of the day)
                    // If we are here, DB is empty for today. We must generate the list using our existing logic.
                    console.log('[Daily5] No entry for today. Generating Global Daily 5...');
                } catch (err) {
                    console.error('[Daily5] DB Connection failed, falling back to local.', err);
                }
            }

            // --- EXISTING LOGIC STARTS HERE (As Fallback or Generator) ---

            // 2. Check Local Cache (Fallback for offline/no-db)
            const cachedData = localStorage.getItem('DAILY_SELECTION_V14');
            if (cachedData) {
                const { date, movies: cachedMovies } = JSON.parse(cachedData);
                if (date === todayKey && cachedMovies.length === 5) {
                    const normalized = cachedMovies.map((m: any) => normalizeMovie(m));
                    setMovies(normalized);
                    setLoading(false);
                    return;
                }
            }

            const apiKey = import.meta.env.VITE_TMDB_API_KEY;

            // IMPORTANT: In "Generator Mode" (writing to DB), we PREFER live API data over seeds if possible,
            // but we must VALIDATE it.
            // For now, to ensure stability, we will stick to the working SEED logic or existing API logic, 
            // but if we had the DB, we would save the result there.

            // Helper to get raw movie list
            const getSeeds = () => TMDB_SEEDS.slice(0, 5).map((m, i) => ({
                ...m,
                slotLabel: DAILY_SLOTS[i].label,
                color: FALLBACK_GRADIENTS[i]
            }));

            // For this phase, we keep FORCE_SEEDS = true to ensure the "Generator" produces good data.
            // Once the DB is live, we can relax this to allow API generation.
            const FORCE_SEEDS = true;

            let finalMovies: Movie[] = [];

            if (FORCE_SEEDS) {
                finalMovies = getSeeds();
            } else if (apiKey && apiKey !== 'YOUR_TMDB_API_KEY') {
                // ... (Original API logic would go here if we disabled force seeds) ...
                // Keeping it short for now as per instructions to rely on seeds.
                finalMovies = getSeeds();
            } else {
                finalMovies = getSeeds();
            }

            // c) SAVE TO DB (If we are the generator)
            if (isSupabaseLive() && supabase && finalMovies.length === 5) {
                console.log('[Daily5] Writing generated list to Supabase...');
                const { error: insertError } = await supabase
                    .from('daily_showcase')
                    .insert([{ date: todayKey, movies: finalMovies }]);

                if (insertError) console.error('[Daily5] Failed to write to DB:', insertError);
            }

            // Local Cache & Set State
            localStorage.setItem('DAILY_SELECTION_V14', JSON.stringify({ date: todayKey, movies: finalMovies }));
            setMovies(finalMovies);
            setLoading(false);
        };

        fetchDaily5();
    }, []);

    return { movies, loading };
};
