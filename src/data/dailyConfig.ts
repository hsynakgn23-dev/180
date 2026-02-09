export const DAILY_SLOTS = [
    { label: "The Legend", params: "&vote_average.gte=8.4&vote_count.gte=3000&sort_by=vote_average.desc" },
    { label: "The Hidden Gem", params: "&vote_average.gte=7.5&vote_count.gte=50&vote_count.lte=1000&sort_by=popularity.desc" },
    { label: "DNA Flip", params: "&with_genres=99,36,10752&sort_by=popularity.desc" },
    { label: "The Modern", params: "&primary_release_date.gte=2024-01-01&vote_average.gte=7.0&sort_by=popularity.desc" },
    { label: "The Mystery", params: "&vote_average.gte=7.8&with_original_language=ja|ko|fr&sort_by=popularity.desc" }
];

export const FALLBACK_GRADIENTS = [
    "from-red-900 to-red-800",
    "from-orange-400 to-orange-600",
    "from-blue-800 to-blue-900",
    "from-pink-300 to-purple-400",
    "from-green-700 to-green-900"
];
