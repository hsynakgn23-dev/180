export interface Movie {
    id: number;
    title: string;
    director: string;
    year: number;
    genre: string;
    tagline: string;
    color: string; // Fallback gradient color
    posterPath?: string;
    overview?: string;
    voteAverage?: number;
    cast?: string[];
    originalLanguage?: string;
    slotLabel?: string;
}

export const TODAYS_SELECTION: Movie[] = [
    {
        id: 1,
        title: "In the Mood for Love",
        director: "Wong Kar-wai",
        year: 2000,
        genre: "Romance/Drama",
        tagline: "Feelings keep lingering...",
        color: "from-red-900 to-red-800",
        posterPath: "https://upload.wikimedia.org/wikipedia/en/4/45/In_the_Mood_for_Love_movie.jpg"
    },
    {
        id: 2,
        title: "Blade Runner 2049",
        director: "Denis Villeneuve",
        year: 2017,
        genre: "Sci-Fi/Noir",
        tagline: "More human than human is our motto.",
        color: "from-orange-400 to-orange-600",
        posterPath: "https://upload.wikimedia.org/wikipedia/en/9/9b/Blade_Runner_2049_poster.png"
    },
    {
        id: 3,
        title: "Portrait of a Lady on Fire",
        director: "Céline Sciamma",
        year: 2019,
        genre: "Period Drama",
        tagline: "Do not regret. Remember.",
        color: "from-blue-800 to-blue-900",
        posterPath: "https://upload.wikimedia.org/wikipedia/en/d/da/Portrait_of_a_Lady_on_Fire_poster.jpeg"
    },
    {
        id: 4,
        title: "The Grand Budapest Hotel",
        director: "Wes Anderson",
        year: 2014,
        genre: "Comedy/Adventure",
        tagline: "A murder case of the Madame D.",
        color: "from-pink-300 to-purple-400",
        posterPath: "https://upload.wikimedia.org/wikipedia/en/a/a6/The_Grand_Budapest_Hotel_poster.jpg"
    },
    {
        id: 5,
        title: "Perfect Days",
        director: "Wim Wenders",
        year: 2023,
        genre: "Drama",
        tagline: "Just another perfect day.",
        color: "from-green-700 to-green-900",
        posterPath: "https://upload.wikimedia.org/wikipedia/en/0/05/Perfect_Days_poster.jpg"
    }
];
