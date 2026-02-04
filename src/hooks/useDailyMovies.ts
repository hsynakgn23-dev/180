import { useState, useEffect } from 'react';
import { TMDB_SEEDS } from '../data/tmdbSeeds';
import type { Movie } from '../data/mockMovies';

// Slot Definitions for labeling
const SLOTS = [
    { label: "The Legend", params: "&vote_average.gte=8.4&vote_count.gte=3000&sort_by=vote_average.desc" },
    { label: "The Hidden Gem", params: "&vote_average.gte=7.5&vote_count.gte=50&vote_count.lte=1000&sort_by=popularity.desc" },
    { label: "DNA Flip", params: "&with_genres=99,36,10752&sort_by=popularity.desc" },
    { label: "The Modern", params: `&primary_release_date.gte=${new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split('T')[0]}&vote_average.gte=7.0&sort_by=popularity.desc` },
    { label: "The Mystery", params: "&vote_average.gte=7.8&with_original_language=ja|ko|fr&sort_by=popularity.desc" }
];

// Fallback gradients if poster fails or loading
const FALLBACK_GRADIENTS = [
    "from-red-900 to-red-800",
    "from-orange-400 to-orange-600",
    "from-blue-800 to-blue-900",
    "from-pink-300 to-purple-400",
    "from-green-700 to-green-900"
];

export const useDailyMovies = () => {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDaily5 = async () => {
            // 0. HARD CACHE CLEAR (Fixes stuck V11/V12/V13 states)
            ['DAILY_SELECTION_V11', 'DAILY_SELECTION_V12', 'DAILY_SELECTION_V13'].forEach(key => localStorage.removeItem(key));

            // 1. Check Local Storage for V14
            const todayKey = new Date().toISOString().split('T')[0];
            const cachedData = localStorage.getItem('DAILY_SELECTION_V14');

            if (cachedData) {
                const { date, movies: cachedMovies } = JSON.parse(cachedData);
                if (date === todayKey && cachedMovies.length === 5) {
                    setMovies(cachedMovies);
                    setLoading(false);
                    return;
                }
            }

            const apiKey = import.meta.env.VITE_TMDB_API_KEY;
            console.log('API Status:', !!apiKey, apiKey ? 'Defined' : 'Undefined');

            // FORCE SEED POLICY: Ensure production uses same seeds as local.
            const FORCE_SEEDS = true;

            // Helper to get raw movie list
            const getSeeds = () => TMDB_SEEDS.slice(0, 5).map((m, i) => ({
                ...m,
                slotLabel: SLOTS[i].label,
                color: FALLBACK_GRADIENTS[i]
            }));

            // 1.5 FORCE MODE: Return immediately if forcing seeds
            if (FORCE_SEEDS) {
                console.log('FORCE_SEEDS Active: Using Curated List');
                const seedMovies = getSeeds();
                localStorage.setItem('DAILY_SELECTION_V14', JSON.stringify({ date: todayKey, movies: seedMovies }));
                setMovies(seedMovies);
                setLoading(false);
                return;
            }

            // 2. Try Fetching from API if Key Exists (AND NOT FORCED)
            if (apiKey && apiKey !== 'YOUR_TMDB_API_KEY') {
                try {
                    console.log('Fetching fresh Daily 5 from TMDB...');
                    const promises = SLOTS.map(async (slot, index) => {
                        const response = await fetch(
                            `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&include_adult=false&include_video=false&page=1${slot.params}`
                        );
                        if (!response.ok) throw new Error(`TMDB Error: ${response.status}`);
                        const data = await response.json();
                        const result = data.results[0]; // Take top result

                        // Map to our Movie interface
                        return {
                            id: result.id,
                            title: result.title,
                            director: "Unknown", // API doesn't return director in list view usually, but strictly speaking we might need a 2nd call. For now, keep it simple or placeholder. 
                            // Actually, let's keep it robust. If we want director we need /movie/{id}/credits. 
                            // Optimization: Just use "TBA" or fetch details if critical. For MVP speed, "Unknown" or better fetching.
                            // Let's assume user just wants the posters/titles for now to prove connection.
                            year: parseInt(result.release_date?.split('-')[0]) || 2024,
                            genre: "Cinema", // We'd need genre mapping. 
                            tagline: result.overview ? result.overview.slice(0, 50) + "..." : "Discover this masterpiece.",
                            color: FALLBACK_GRADIENTS[index],
                            posterPath: result.poster_path, // IMPORTANT: /path.jpg
                            voteAverage: result.vote_average,
                            overview: result.overview,
                            slotLabel: slot.label
                        } as Movie;
                    });

                    const liveMovies = await Promise.all(promises);

                    // Cache Live Data
                    localStorage.setItem('DAILY_SELECTION_V14', JSON.stringify({ date: todayKey, movies: liveMovies }));
                    setMovies(liveMovies);
                    setLoading(false);
                    return;

                } catch (error) {
                    console.error("API Fetch Failed (CORS or Key), falling back to seeds:", error);
                    // Fall through to seeds
                }
            }

            // 3. Fallback: Use Seeds Directly (CORS issues or No Key)
            console.log('Using Curated TMDB Seeds (Fallback)');
            const fallbackMovies = getSeeds();

            // Cache the result
            localStorage.setItem('DAILY_SELECTION_V14', JSON.stringify({ date: todayKey, movies: fallbackMovies }));
            setMovies(fallbackMovies);
            setLoading(false);
        };

        fetchDaily5();
    }, []);

    return { movies, loading };
};
