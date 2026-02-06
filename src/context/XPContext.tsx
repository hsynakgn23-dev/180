import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MAJOR_MARKS } from '../data/marksData';
import { TMDB_SEEDS } from '../data/tmdbSeeds';

// Types
interface EchoLog {
    id: string;
    movieTitle: string; // Simplified for now
    date: string;
}

// Enhanced Ritual Log
interface RitualLog {
    id: string;
    date: string;
    movieId: number;
    movieTitle: string;
    text: string;
    genre?: string;
    rating?: number;
    posterPath?: string;
}

interface XPState {
    totalXP: number;
    lastLoginDate: string | null;
    dailyDwellXP: number; // Max 20
    lastDwellDate: string | null;
    dailyRituals: RitualLog[]; // Updated to store full logs
    marks: string[];
    featuredMarks: string[]; // Max 3
    activeDays: string[];
    uniqueGenres: string[];
    streak: number;
    lastStreakDate: string | null;
    echoesReceived: number;
    echoesGiven: number;
    echoHistory: EchoLog[];
    followers: number;
    following: string[]; // List of usernames
    nonConsecutiveCount: number; // For "No Rush"
    bio: string; // Max 180 chars
    avatarId: string; // e.g. 'geo_1', 'geo_2'
    avatarUrl?: string; // Custom uploaded image (Data URL)
}

export interface LeagueInfo {
    name: string;
    color: string;
    description: string;
}

export const LEAGUES_DATA: Record<string, LeagueInfo> = {
    'Bronze': { name: 'Figüran', color: '#CD7F32', description: 'Sahneye ilk adım.' },
    'Silver': { name: 'İzleyici', color: '#C0C0C0', description: 'Gözlemlemeye başladın.' },
    'Gold': { name: 'Yorumcu', color: '#FFD700', description: 'Sesin duyuluyor.' },
    'Platinum': { name: 'Eleştirmen', color: '#E5E4E2', description: 'Analizlerin derinleşiyor.' },
    'Emerald': { name: 'Sinema Gurmesi', color: '#50C878', description: 'Zevklerin inceliyor.' },
    'Sapphire': { name: 'Sinefil', color: '#0F52BA', description: 'Tutkun bir yaşam biçimi.' },
    'Ruby': { name: 'Vizyoner', color: '#E0115F', description: 'Geleceği görüyorsun.' },
    'Diamond': { name: 'Yönetmen', color: '#B9F2FF', description: 'Kendi sahnelerini kur.' },
    'Master': { name: 'Auteur', color: '#9400D3', description: 'İmzanı at.' },
    'Grandmaster': { name: 'Efsane', color: '#FF0000', description: 'Tarihe geçtin.' },
    'Absolute': { name: 'Absolute', color: '#000000', description: 'The Void' },
    'Eternal': { name: 'Eternal', color: '#FFFFFF', description: 'The Light' }
};

interface XPContextType {
    xp: number;
    league: string;
    leagueInfo: LeagueInfo;
    levelUpEvent: LeagueInfo | null;
    closeLevelUp: () => void;
    progressPercentage: number;
    nextLevelXP: number;
    whisper: string | null;
    dailyRituals: RitualLog[];
    dailyRitualsCount: number;
    marks: string[];
    featuredMarks: string[];
    toggleFeaturedMark: (markId: string) => void;
    daysPresent: number;
    streak: number;
    echoHistory: EchoLog[];
    following: string[];
    bio: string;
    avatarId: string;
    updateIdentity: (bio: string, avatarId: string) => void;
    toggleFollowUser: (username: string) => void;
    submitRitual: (movieId: number, text: string, rating: number, genre: string, title?: string, posterPath?: string) => void;
    echoRitual: (ritualId: string) => void;
    receiveEcho: (movieTitle?: string) => void;
    debugAddXP: (amount: number) => void;
    debugUnlockMark: (markId: string) => void;
    user: { email: string; name: string } | null;
    login: (email: string) => void;
    logout: () => void;
    avatarUrl?: string; // Custom uploaded avatar
    updateAvatar: (url: string) => void;
}


const MAX_DAILY_DWELL_XP = 20;
const LEVEL_THRESHOLD = 500;
export const LEAGUE_NAMES = Object.keys(LEAGUES_DATA);
const KNOWN_MOVIES_BY_ID = new Map(
    TMDB_SEEDS.map((movie) => [movie.id, { title: movie.title, posterPath: movie.posterPath }])
);

const normalizeRitualLog = (ritual: RitualLog): RitualLog => {
    const knownMovie = KNOWN_MOVIES_BY_ID.get(ritual.movieId);
    const invalidTitle = !ritual.movieTitle || ritual.movieTitle === 'Unknown Title';
    return {
        ...ritual,
        movieTitle: invalidTitle ? knownMovie?.title || ritual.movieTitle || `Film #${ritual.movieId}` : ritual.movieTitle,
        posterPath: ritual.posterPath || knownMovie?.posterPath
    };
};

const XPContext = createContext<XPContextType | undefined>(undefined);

export const XPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<{ email: string; name: string } | null>(() => {
        const storedUser = localStorage.getItem('180_user_session');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const [state, setState] = useState<XPState>({
        totalXP: 0,
        lastLoginDate: null,
        dailyDwellXP: 0,
        lastDwellDate: null,
        dailyRituals: [],
        marks: [],
        featuredMarks: [],
        activeDays: [],
        uniqueGenres: [],
        streak: 0,
        lastStreakDate: null,
        echoesReceived: 0,
        echoesGiven: 0,
        echoHistory: [],
        followers: 0,
        following: [],
        nonConsecutiveCount: 0,
        bio: "A silent observer.",
        avatarId: "geo_1"
    });

    // Load data when user changes
    useEffect(() => {
        if (user) {
            const userKey = `180_xp_data_${user.email}`;
            const stored = localStorage.getItem(userKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                setState({
                    ...parsed,
                    dailyRituals: Array.isArray(parsed.dailyRituals)
                        ? parsed.dailyRituals.map((ritual: RitualLog) => normalizeRitualLog(ritual))
                        : [],
                    marks: parsed.marks || [],
                    featuredMarks: parsed.featuredMarks || [],
                    activeDays: parsed.activeDays || [],
                    uniqueGenres: parsed.uniqueGenres || [],
                    streak: parsed.streak || 0,
                    lastStreakDate: parsed.lastStreakDate || null,
                    echoesReceived: parsed.echoesReceived || 0,
                    echoesGiven: parsed.echoesGiven || 0,
                    echoHistory: parsed.echoHistory || [],
                    followers: parsed.followers || 0,
                    nonConsecutiveCount: parsed.nonConsecutiveCount || 0,
                    bio: parsed.bio || "A silent observer.",
                    avatarId: parsed.avatarId || "geo_1"
                });
            } else {
                // New user default state
                const defaultState: XPState = {
                    totalXP: 0,
                    lastLoginDate: null,
                    dailyDwellXP: 0,
                    lastDwellDate: null,
                    dailyRituals: [],
                    marks: [],
                    featuredMarks: [],
                    activeDays: [],
                    uniqueGenres: [],
                    streak: 0,
                    lastStreakDate: null,
                    echoesReceived: 0,
                    echoesGiven: 0,
                    echoHistory: [],
                    followers: 0,
                    following: [],
                    nonConsecutiveCount: 0,
                    bio: "A silent observer.",
                    avatarId: "geo_1"
                };
                setState(defaultState);
                localStorage.setItem(userKey, JSON.stringify(defaultState));
            }
        }
    }, [user]);

    const [whisper, setWhisper] = useState<string | null>(null);
    const [levelUpEvent, setLevelUpEvent] = useState<LeagueInfo | null>(null);
    const previousLeagueIndexRef = useRef(0);
    const didHydrateLeagueRef = useRef(false);

    const getToday = () => new Date().toISOString().split('T')[0];

    // Check streak maintenance logic
    const checkStreakMaintenance = (lastDate: string | null, today: string) => {
        if (!lastDate) return 1;
        const d1 = new Date(lastDate);
        const d2 = new Date(today);
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return undefined; // Maintained
        if (diffDays > 1) return 0; // Broken
        return undefined; // Same day (0)
    };

    const updateState = (newState: Partial<XPState>) => {
        setState(prev => {
            const updated = { ...prev, ...newState };
            if (user) {
                localStorage.setItem(`180_xp_data_${user.email}`, JSON.stringify(updated));
            }
            return updated;
        });
    };

    const login = (email: string) => {
        const newUser = { email, name: email.split('@')[0] };
        setUser(newUser);
        localStorage.setItem('180_user_session', JSON.stringify(newUser));
        triggerWhisper("Welcome to the Ritual.");
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('180_user_session');
        setState({ // Reset to empty/guest state
            totalXP: 0,
            lastLoginDate: null,
            dailyDwellXP: 0,
            lastDwellDate: null,
            dailyRituals: [],
            marks: [],
            featuredMarks: [],
            activeDays: [],
            uniqueGenres: [],
            streak: 0,
            lastStreakDate: null,
            echoesReceived: 0,
            echoesGiven: 0,
            echoHistory: [],
            followers: 0,
            following: [],
            nonConsecutiveCount: 0,
            bio: "Orbiting nearby...",
            avatarId: "geo_1"
        });
    };

    const updateAvatar = (url: string) => {
        updateState({ avatarUrl: url });
        triggerWhisper("Visage captured.");
    };

    // Shadow Follow Logic
    const toggleFollowUser = (username: string) => {
        let currentFollowing = [...(state.following || [])];
        if (currentFollowing.includes(username)) {
            currentFollowing = currentFollowing.filter(u => u !== username);
            triggerWhisper(`Unfollowed ${username}.`);
        } else {
            currentFollowing.push(username);
            triggerWhisper(`Shadowing ${username}.`);
        }
        updateState({ following: currentFollowing });
    };

    // Trigger Whisper
    const triggerWhisper = (message: string) => {
        setWhisper(message);
        setTimeout(() => setWhisper(null), 4000);
    };

    // Unlock Logic
    const tryUnlockMark = (markId: string, currentMarks: string[]): string[] => {
        if (!currentMarks.includes(markId)) {
            const markDef = MAJOR_MARKS.find(m => m.id === markId);
            const msg = markDef?.whisper || "Mark unlocked.";
            triggerWhisper(msg);
            return [...currentMarks, markId];
        }
        return currentMarks;
    };

    // --- EFFECT: Global Level Up Detection ---
    // Triggers transition for every XP source: login, dwell, ritual, social, debug.
    useEffect(() => {
        const currentLeagueIndex = Math.min(
            Math.floor(state.totalXP / LEVEL_THRESHOLD),
            LEAGUE_NAMES.length - 1
        );

        if (!didHydrateLeagueRef.current) {
            previousLeagueIndexRef.current = currentLeagueIndex;
            didHydrateLeagueRef.current = true;
            return;
        }

        if (currentLeagueIndex > previousLeagueIndexRef.current) {
            const leagueName = LEAGUE_NAMES[currentLeagueIndex];
            setLevelUpEvent(LEAGUES_DATA[leagueName]);
            triggerWhisper("The orbit is changing.");
        }

        previousLeagueIndexRef.current = currentLeagueIndex;
    }, [state.totalXP]);

    useEffect(() => {
        didHydrateLeagueRef.current = false;
    }, [user?.email]);

    // 1. Daily Login & Persistence
    useEffect(() => {
        const today = getToday();

        let newActiveDays = state.activeDays || [];
        if (!newActiveDays.includes(today)) {
            newActiveDays = [...newActiveDays, today];
        }

        let currentMarks = [...(state.marks || [])];
        let newStreak = state.streak;

        // Mark: Eternal
        const leagueIndex = Math.min(Math.floor(state.totalXP / LEVEL_THRESHOLD), LEAGUE_NAMES.length - 1);
        const currentLeague = LEAGUE_NAMES[leagueIndex];
        if (currentLeague === 'Eternal') currentMarks = tryUnlockMark('eternal_mark', currentMarks);

        // Streak Maintenance
        if (state.lastLoginDate !== today && state.lastLoginDate) {
            const gap = checkStreakMaintenance(state.lastLoginDate, today);
            if (gap === 0) newStreak = 0;
        }

        // Check updates
        if (state.lastLoginDate !== today) {
            updateState({
                totalXP: state.totalXP + 5,
                lastLoginDate: today,
                dailyDwellXP: 0,
                lastDwellDate: today,
                activeDays: newActiveDays,
                marks: currentMarks,
                streak: newStreak
            });
            triggerWhisper("Welcome back.");
        } else if (JSON.stringify(currentMarks) !== JSON.stringify(state.marks)) {
            updateState({ marks: currentMarks });
        }
    }, []);

    // 2. Dwell Time
    useEffect(() => {
        const interval = setInterval(() => {
            const today = getToday();
            if (state.lastDwellDate !== today) {
                updateState({ dailyDwellXP: 0, lastDwellDate: today });
                return;
            }
            if (state.dailyDwellXP < MAX_DAILY_DWELL_XP) {
                updateState({
                    totalXP: state.totalXP + 2,
                    dailyDwellXP: state.dailyDwellXP + 2
                });
            }
        }, 120000);
        return () => clearInterval(interval);
    }, [state.dailyDwellXP, state.lastDwellDate]);

    // 3. Ritual Submission
    const submitRitual = (movieId: number, text: string, _rating: number, genre: string, title?: string, posterPath?: string) => {
        const today = getToday();
        if (state.dailyRituals.some(r => r.date === today && r.movieId === movieId)) {
            triggerWhisper("Memory stored.");
            return;
        }

        const length = text.length;
        let earnedXP = 15;
        if (length === 180) earnedXP = 50;

        // Streak Logic
        let newStreak = state.streak;
        let nonConsecutive = state.nonConsecutiveCount;

        const hasdoneRitualToday = state.dailyRituals.some(r => r.date === today);
        if (!hasdoneRitualToday) {
            if (state.lastStreakDate) {
                const gap = checkStreakMaintenance(state.lastStreakDate, today);
                if (gap === undefined) newStreak += 1;
                else {
                    newStreak = 1;
                    nonConsecutive += 1;
                }
            } else {
                newStreak = 1;
                nonConsecutive += 1;
            }
        }

        if (newStreak >= 7) earnedXP *= 1.5;

        let currentMarks = [...(state.marks || [])];
        let newUniqueGenres = [...(state.uniqueGenres || [])];

        // --- MARK CHECKS ---
        if (state.dailyRituals.length === 0) currentMarks = tryUnlockMark('first_mark', currentMarks);
        if (length === 180) currentMarks = tryUnlockMark('180_exact', currentMarks);
        if (length < 40) currentMarks = tryUnlockMark('minimalist', currentMarks);
        if (length > 200) currentMarks = tryUnlockMark('deep_diver', currentMarks);

        if (nonConsecutive >= 10) currentMarks = tryUnlockMark('no_rush', currentMarks);
        if (newStreak >= 3) currentMarks = tryUnlockMark('daily_regular', currentMarks);
        if (newStreak >= 5) currentMarks = tryUnlockMark('held_for_five', currentMarks);
        if (newStreak >= 7) currentMarks = tryUnlockMark('seven_quiet_days', currentMarks);

        // Define newRitual early for use in checks
        const newRitual: RitualLog = {
            id: Date.now().toString(),
            date: today,
            movieId,
            movieTitle: title || KNOWN_MOVIES_BY_ID.get(movieId)?.title || 'Unknown Title',
            text,
            genre,
            rating: _rating,
            posterPath: posterPath || KNOWN_MOVIES_BY_ID.get(movieId)?.posterPath
        };

        if (!newUniqueGenres.includes(genre)) {
            newUniqueGenres.push(genre);
            if (newUniqueGenres.length >= 10) currentMarks = tryUnlockMark('wide_lens', currentMarks);
            if (newUniqueGenres.length >= 3) currentMarks = tryUnlockMark('genre_discovery', currentMarks);
        }

        // Check for 'One Genre Devotion' (20 in one genre)
        const allRituals = [newRitual, ...(state.dailyRituals || [])];
        const genreCount = allRituals.filter(r => r.genre === genre).length;
        if (genreCount >= 20) currentMarks = tryUnlockMark('one_genre_devotion', currentMarks);

        const hour = new Date().getHours();
        if (hour >= 0 && hour < 1) currentMarks = tryUnlockMark('midnight_ritual', currentMarks);
        if (hour >= 5 && hour < 7) currentMarks = tryUnlockMark('watched_on_time', currentMarks);

        if (state.dailyRituals.length === 0) currentMarks = tryUnlockMark('mystery_solver', currentMarks);

        const newTotalXP = Math.floor(state.totalXP + earnedXP);

        updateState({
            totalXP: newTotalXP,
            dailyRituals: allRituals,
            marks: currentMarks,
            uniqueGenres: newUniqueGenres,
            streak: newStreak,
            lastStreakDate: today,
            nonConsecutiveCount: nonConsecutive
        });
    };

    // 4. Social
    const echoRitual = (_ritualId: string) => {
        const newXP = state.totalXP + 1;
        let currentMarks = [...(state.marks || [])];
        if (state.echoesGiven === 0) currentMarks = tryUnlockMark('echo_initiate', currentMarks);
        updateState({ totalXP: newXP, marks: currentMarks, echoesGiven: state.echoesGiven + 1 });
    };

    const receiveEcho = (movieTitle = "Unknown Ritual") => {
        const newXP = state.totalXP + 3;
        const newReceived = (state.echoesReceived || 0) + 1;
        let currentMarks = [...(state.marks || [])];

        if (newReceived >= 1) currentMarks = tryUnlockMark('first_echo', currentMarks);
        if (newReceived >= 5) currentMarks = tryUnlockMark('influencer', currentMarks);

        // Add to history
        const newLog: EchoLog = {
            id: Date.now().toString(),
            movieTitle,
            date: new Date().toLocaleDateString()
        };

        updateState({
            totalXP: newXP,
            marks: currentMarks,
            echoesReceived: newReceived,
            echoHistory: [newLog, ...(state.echoHistory || [])].slice(0, 10) // Keep last 10
        });

        // Debug whisper?
        // triggerWhisper("Your voice echoed. +3 XP");
    };

    // Featured Marks Logic
    const toggleFeaturedMark = (markId: string) => {
        let current = [...(state.featuredMarks || [])];
        if (current.includes(markId)) {
            current = current.filter(id => id !== markId);
        } else {
            if (current.length < 3) {
                current.push(markId);
            } else {
                // Optional: Replace first? or block.
                // Let's block for now or maybe just behave as toggle if full requires uncheck.
                // Or simplistic: pop first and push new.
                current.shift();
                current.push(markId);
            }
        }
        updateState({ featuredMarks: current });
    };

    // Debug Tools
    const debugAddXP = (amount: number) => {
        updateState({ totalXP: state.totalXP + amount });
    };

    const debugUnlockMark = (markId: string) => {
        const updated = tryUnlockMark(markId, state.marks);
        updateState({ marks: updated });
    };

    const updateIdentity = (bio: string, avatarId: string) => {
        updateState({ bio, avatarId });
        triggerWhisper("Identity shifted.");
    };

    const leagueIndex = Math.min(Math.floor(state.totalXP / LEVEL_THRESHOLD), LEAGUE_NAMES.length - 1);
    const leagueName = LEAGUE_NAMES[leagueIndex];
    const leagueInfo = LEAGUES_DATA[leagueName];
    const currentLevelStart = leagueIndex * LEVEL_THRESHOLD;
    const progressPercentage = Math.min(100, Math.max(0, ((state.totalXP - currentLevelStart) / LEVEL_THRESHOLD) * 100));
    const nextLevelXP = currentLevelStart + LEVEL_THRESHOLD;

    return (
        <XPContext.Provider value={{
            xp: state.totalXP,
            league: leagueName,
            leagueInfo,
            levelUpEvent,
            closeLevelUp: () => setLevelUpEvent(null),
            progressPercentage,
            nextLevelXP,
            whisper,
            dailyRituals: state.dailyRituals || [],
            dailyRitualsCount: state.dailyRituals ? state.dailyRituals.length : 0,
            marks: state.marks || [],
            featuredMarks: state.featuredMarks || [],
            toggleFeaturedMark,
            daysPresent: state.activeDays ? state.activeDays.length : 0,
            streak: state.streak || 0,
            echoHistory: state.echoHistory || [],
            following: state.following || [],
            bio: state.bio,
            avatarId: state.avatarId,
            updateIdentity,
            toggleFollowUser,
            submitRitual,
            echoRitual,
            receiveEcho,
            debugAddXP,
            debugUnlockMark,
            user,
            login,
            logout,
            avatarUrl: state.avatarUrl,
            updateAvatar
        }}>
            {children}
        </XPContext.Provider>
    );
};

export const useXP = () => {
    const context = useContext(XPContext);
    if (!context) {
        throw new Error('useXP must be used within an XPProvider');
    }
    return context;
};
