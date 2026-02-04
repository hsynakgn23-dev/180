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
            // 1. Check Local Storage for Today's Selection
            const todayKey = new Date().toISOString().split('T')[0];
            const cachedData = localStorage.getItem('DAILY_SELECTION_V9');

            if (cachedData) {
                const { date, movies: cachedMovies } = JSON.parse(cachedData);
                if (date === todayKey && cachedMovies.length === 5) {
                    setMovies(cachedMovies);
                    setLoading(false);
                    return;
                }
            }

            // 2. SKIP API - Use Seeds Directly (CORS issues with TMDB from browser)
            // API calls from browser cause CORS errors, so we use curated seeds
            console.log('Using Curated TMDB Seeds (API disabled to avoid CORS)');
            const fallbackMovies = TMDB_SEEDS.slice(0, 5).map((m, i) => ({
                ...m,
                slotLabel: SLOTS[i].label,
                color: FALLBACK_GRADIENTS[i]
            }));

            // Cache the result
            localStorage.setItem('DAILY_SELECTION_V9', JSON.stringify({ date: todayKey, movies: fallbackMovies }));
            setMovies(fallbackMovies);
            setLoading(false);
        };

        fetchDaily5();
    }, []);

    return { movies, loading };
};
