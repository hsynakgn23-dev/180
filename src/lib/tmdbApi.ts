let tmdbApiBlocked = false;

export const searchPosterPath = async (title: string, apiKey: string): Promise<string | null> => {
    if (!apiKey || apiKey === 'YOUR_TMDB_API_KEY') return null;
    if (import.meta.env.VITE_TMDB_API_DISABLED === '1') return null;
    if (tmdbApiBlocked) return null;

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}`);
        if (!res.ok) {
            tmdbApiBlocked = true;
            return null;
        }
        const data = await res.json();
        return data.results?.[0]?.poster_path ?? null;
    } catch {
        tmdbApiBlocked = true;
        return null;
    }
};
