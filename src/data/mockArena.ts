import type { ComponentType } from 'react';

export interface Ritual {
    id: string;
    movieId: number;
    movieTitle: string;
    year?: number;
    posterPath?: string;
    author: string;
    text: string;
    echoes: number;
    isEchoedByMe: boolean;
    timestamp: string;
    league: string;
    createdAt?: number;
    isCustom?: boolean;
    featuredMarks?: ComponentType<{ color?: string; size?: number; className?: string; opacity?: number }>[]; // Array of Icon components
    replies?: {
        id: string;
        author: string;
        text: string;
        timestamp: string;
    }[];
}

import { CircleMark } from '../components/icons/CircleMark';
import { HexagonMark } from '../components/icons/HexagonMark';
import { TriangleMark } from '../components/icons/TriangleMark';

export const MOCK_ARENA_RITUALS: Ritual[] = [
    {
        id: '1',
        movieId: 157336,
        movieTitle: 'Interstellar',
        year: 2014,
        posterPath: 'https://image.tmdb.org/t/p/w200/gEU2QniL6C8zYEfe4NCJw46LCDp.jpg',
        author: 'User_4421',
        text: 'The docking scene... I held my breath for the entire sequence. Hans Zimmer is a god.',
        echoes: 12,
        isEchoedByMe: false,
        timestamp: '2h ago',
        league: 'Gold',
        featuredMarks: [HexagonMark, TriangleMark],
        replies: [
            { id: 'r1', author: 'Cineast_Pro', text: 'Zimmer transcends sound. It\'s physical.', timestamp: '1h ago' }
        ]
    },
    {
        id: '2',
        movieId: 843,
        movieTitle: 'In the Mood for Love',
        year: 2000,
        posterPath: 'https://image.tmdb.org/t/p/w200/iYcy3qnD53Xwd4l68k5pQ5e1O2n.jpg',
        author: 'Silent_Walker',
        text: 'The colors, the music, the longing. It hurts in the most beautiful way.',
        echoes: 4,
        isEchoedByMe: false,
        timestamp: '4h ago',
        league: 'Silver',
        featuredMarks: [CircleMark]
    },
    {
        id: '3',
        movieId: 155,
        movieTitle: 'The Dark Knight',
        year: 2008,
        posterPath: 'https://image.tmdb.org/t/p/w200/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        author: 'Cineast_Pro',
        text: 'Ledger performed a ritual of his own. We are just witnessing the aftermath.',
        echoes: 23,
        isEchoedByMe: true,
        timestamp: '5h ago',
        league: 'Platinum'
    },
    {
        id: '4',
        movieId: 157336,
        movieTitle: 'Interstellar',
        year: 2014,
        posterPath: 'https://image.tmdb.org/t/p/w200/gEU2QniL6C8zYEfe4NCJw46LCDp.jpg',
        author: 'Novice_Watcher',
        text: 'I didn\'t understand the ending, but I felt it.',
        echoes: 1,
        isEchoedByMe: false,
        timestamp: '6h ago',
        league: 'Bronze'
    },
    {
        id: '5',
        movieId: 129,
        movieTitle: 'Spirited Away',
        year: 2001,
        posterPath: 'https://image.tmdb.org/t/p/w200/39wmItIWsg5sZMyRUKGkh661Ykd.jpg',
        author: 'Ghibli_Stan',
        text: 'The train scene is the most peaceful moment in cinema history.',
        echoes: 8,
        isEchoedByMe: false,
        timestamp: '1d ago',
        league: 'Gold'
    }
];
