import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MAJOR_MARKS } from '../data/marksData';
import { TMDB_SEEDS } from '../data/tmdbSeeds';
import { supabase, isSupabaseLive } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

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

interface AuthResult {
    ok: boolean;
    message?: string;
}

interface SessionUser {
    id?: string;
    email: string;
    name: string;
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
    deleteRitual: (ritualId: string) => void;
    echoRitual: (ritualId: string) => void;
    receiveEcho: (movieTitle?: string) => void;
    debugAddXP: (amount: number) => void;
    debugUnlockMark: (markId: string) => void;
    user: SessionUser | null;
    authMode: 'supabase' | 'local';
    login: (email: string, password: string, isRegistering?: boolean) => Promise<AuthResult>;
    loginWithGoogle: () => Promise<AuthResult>;
    logout: () => Promise<void>;
    avatarUrl?: string; // Custom uploaded avatar
    updateAvatar: (url: string) => void;
}


const MAX_DAILY_DWELL_XP = 20;
const LEVEL_THRESHOLD = 500;
export const LEAGUE_NAMES = Object.keys(LEAGUES_DATA);
const getLeagueIndexFromXp = (xp: number): number =>
    Math.min(Math.floor(xp / LEVEL_THRESHOLD), LEAGUE_NAMES.length - 1);
const KNOWN_MOVIES_BY_ID = new Map(
    TMDB_SEEDS.map((movie) => [
        movie.id,
        {
            title: movie.title,
            posterPath: movie.posterPath,
            year: movie.year,
            voteAverage: movie.voteAverage ?? null
        }
    ])
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

const buildInitialXPState = (bio = "A silent observer."): XPState => ({
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
    bio,
    avatarId: "geo_1"
});

const normalizeXPState = (input: Partial<XPState> | null | undefined): XPState => {
    const fallback = buildInitialXPState();
    if (!input) return fallback;

    return {
        ...fallback,
        ...input,
        dailyRituals: Array.isArray(input.dailyRituals)
            ? input.dailyRituals.map((ritual: RitualLog) => normalizeRitualLog(ritual))
            : [],
        marks: Array.isArray(input.marks) ? input.marks : [],
        featuredMarks: Array.isArray(input.featuredMarks) ? input.featuredMarks : [],
        activeDays: Array.isArray(input.activeDays) ? input.activeDays : [],
        uniqueGenres: Array.isArray(input.uniqueGenres) ? input.uniqueGenres : [],
        echoHistory: Array.isArray(input.echoHistory) ? input.echoHistory : [],
        following: Array.isArray(input.following) ? input.following : [],
        streak: input.streak || 0,
        lastStreakDate: input.lastStreakDate || null,
        echoesReceived: input.echoesReceived || 0,
        echoesGiven: input.echoesGiven || 0,
        followers: input.followers || 0,
        nonConsecutiveCount: input.nonConsecutiveCount || 0,
        bio: input.bio || fallback.bio,
        avatarId: input.avatarId || fallback.avatarId
    };
};

const getLegacyStoredUser = (): SessionUser | null => {
    const stored = localStorage.getItem('180_user_session');
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored) as Partial<SessionUser>;
        if (!parsed.email || typeof parsed.email !== 'string') return null;
        const fallbackName = parsed.email.split('@')[0] || 'observer';
        return {
            id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : undefined,
            email: parsed.email,
            name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : fallbackName
        };
    } catch {
        return null;
    }
};

const normalizeAuthError = (message: string): string => {
    const lowered = message.toLowerCase();
    if (lowered.includes('invalid login credentials')) return 'Email veya sifre hatali.';
    if (lowered.includes('email not confirmed')) return 'E-posta onayi gerekli.';
    if (lowered.includes('user already registered')) return 'Bu e-posta zaten kayitli.';
    if (lowered.includes('email rate limit exceeded') || lowered.includes('rate limit')) {
        return 'Cok fazla deneme yapildi. Biraz bekleyip tekrar dene.';
    }
    return message;
};

const toSessionUser = (authUser: SupabaseUser | null): SessionUser | null => {
    if (!authUser?.email) return null;
    const metadataName = typeof authUser.user_metadata?.full_name === 'string'
        ? authUser.user_metadata.full_name
        : typeof authUser.user_metadata?.name === 'string'
            ? authUser.user_metadata.name
            : '';
    const fallbackName = authUser.email.split('@')[0] || 'observer';
    return {
        id: authUser.id,
        email: authUser.email,
        name: metadataName.trim() || fallbackName
    };
};

const XPContext = createContext<XPContextType | undefined>(undefined);

export const XPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<SessionUser | null>(() => getLegacyStoredUser());

    const [state, setState] = useState<XPState>(buildInitialXPState());
    const [whisper, setWhisper] = useState<string | null>(null);
    const [levelUpEvent, setLevelUpEvent] = useState<LeagueInfo | null>(null);
    const [levelUpQueue, setLevelUpQueue] = useState<LeagueInfo[]>([]);
    const previousLeagueIndexRef = useRef(getLeagueIndexFromXp(state.totalXP));
    const pendingWelcomeWhisperRef = useRef(false);
    const [isXpHydrated, setIsXpHydrated] = useState(false);
    const authMode: 'supabase' | 'local' = isSupabaseLive() && supabase ? 'supabase' : 'local';

    const setSessionUser = (nextUser: SessionUser | null) => {
        setUser(nextUser);
        if (nextUser) {
            localStorage.setItem('180_user_session', JSON.stringify(nextUser));
        } else {
            localStorage.removeItem('180_user_session');
        }
    };

    useEffect(() => {
        if (!isSupabaseLive() || !supabase) {
            return;
        }

        let active = true;
        const applyAuthUser = (authUser: SupabaseUser | null) => {
            if (!active) return;
            const mapped = toSessionUser(authUser);
            setSessionUser(mapped);
        };

        void supabase.auth.getSession().then(({ data }) => {
            applyAuthUser(data.session?.user ?? null);
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            applyAuthUser(session?.user ?? null);
        });

        return () => {
            active = false;
            data.subscription.unsubscribe();
        };
    }, []);

    // Load data when user changes
    useEffect(() => {
        setIsXpHydrated(false);
        setLevelUpEvent(null);
        setLevelUpQueue([]);

        if (!user) {
            setState(buildInitialXPState("Orbiting nearby..."));
            setIsXpHydrated(true);
            previousLeagueIndexRef.current = getLeagueIndexFromXp(0);
            return;
        }

        setState(buildInitialXPState());
        const userKey = `180_xp_data_${user.email}`;
        let active = true;

        const hydrateState = async () => {
            let resolvedState: XPState | null = null;

            if (isSupabaseLive() && supabase && user.id) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('xp_state')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!error && data?.xp_state && typeof data.xp_state === 'object') {
                    resolvedState = normalizeXPState(data.xp_state as Partial<XPState>);
                } else if (
                    error &&
                    !error.message.toLowerCase().includes('relation "profiles"') &&
                    !error.message.toLowerCase().includes('does not exist')
                ) {
                    console.error('[XP] failed to read profile state', error);
                }
            }

            if (!resolvedState) {
                const stored = localStorage.getItem(userKey);
                if (stored) {
                    try {
                        resolvedState = normalizeXPState(JSON.parse(stored) as Partial<XPState>);
                    } catch {
                        resolvedState = null;
                    }
                }
            }

            if (!resolvedState) {
                resolvedState = buildInitialXPState();
            }

            if (!active) return;

            setState(resolvedState);
            previousLeagueIndexRef.current = getLeagueIndexFromXp(resolvedState.totalXP || 0);
            localStorage.setItem(userKey, JSON.stringify(resolvedState));
            setIsXpHydrated(true);
        };

        void hydrateState();

        return () => {
            active = false;
        };
    }, [user?.email, user?.id]);

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

    const login = async (email: string, password: string, isRegistering = false): Promise<AuthResult> => {
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail.includes('@')) {
            return { ok: false, message: 'Gecerli bir e-posta gir.' };
        }
        if ((password || '').length < 6) {
            return { ok: false, message: 'Sifre en az 6 karakter olmali.' };
        }

        if (!isSupabaseLive() || !supabase) {
            const fallbackUser = {
                email: normalizedEmail,
                name: normalizedEmail.split('@')[0] || 'observer'
            };
            setSessionUser(fallbackUser);
            triggerWhisper("Welcome to the Ritual.");
            return { ok: true, message: 'Supabase kapali oldugu icin local session acildi.' };
        }

        try {
            if (isRegistering) {
                const { data, error } = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password
                });

                if (error) return { ok: false, message: normalizeAuthError(error.message) };
                const mapped = toSessionUser(data.user ?? data.session?.user ?? null);
                if (mapped) {
                    setSessionUser(mapped);
                }
                triggerWhisper("Account created.");
                return {
                    ok: true,
                    message: data.session
                        ? 'Kayit tamamlandi. Oturum acildi.'
                        : 'Kayit tamamlandi. Onay maili gerekebilir.'
                };
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password
            });

            if (error) return { ok: false, message: normalizeAuthError(error.message) };
            const mapped = toSessionUser(data.user ?? data.session?.user ?? null);
            if (mapped) {
                setSessionUser(mapped);
            }
            triggerWhisper("Welcome to the Ritual.");
            return { ok: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed.';
            return { ok: false, message: normalizeAuthError(message) };
        }
    };

    const loginWithGoogle = async (): Promise<AuthResult> => {
        if (!isSupabaseLive() || !supabase) {
            return { ok: false, message: 'Google login icin Supabase gerekli.' };
        }

        try {
            const redirectTo = import.meta.env.VITE_AUTH_REDIRECT_TO || `${window.location.origin}/`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo }
            });

            if (error) return { ok: false, message: normalizeAuthError(error.message) };
            return { ok: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Google login failed.';
            return { ok: false, message: normalizeAuthError(message) };
        }
    };

    const logout = async () => {
        if (isSupabaseLive() && supabase) {
            await supabase.auth.signOut();
        }
        setSessionUser(null);
        setState(buildInitialXPState("Orbiting nearby..."));
    };

    const updateAvatar = (url: string) => {
        updateState({ avatarUrl: url });
        triggerWhisper("Visage captured.");
    };

    // Shadow Follow Logic
    const toggleFollowUser = (username: string) => {
        let currentFollowing = [...(state.following || [])];
        let currentMarks = [...(state.marks || [])];
        if (currentFollowing.includes(username)) {
            currentFollowing = currentFollowing.filter(u => u !== username);
            triggerWhisper(`Unfollowed ${username}.`);
        } else {
            currentFollowing.push(username);
            triggerWhisper(`Shadowing ${username}.`);
            if (currentFollowing.length >= 5) currentMarks = tryUnlockMark('quiet_following', currentMarks);
        }
        updateState({ following: currentFollowing, marks: currentMarks });
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
    // Collect all crossed leagues in a queue so transitions are not skipped.
    useEffect(() => {
        if (!isXpHydrated) return;

        const currentLeagueIndex = getLeagueIndexFromXp(state.totalXP);
        const previousLeagueIndex = previousLeagueIndexRef.current;

        if (currentLeagueIndex > previousLeagueIndex) {
            const crossed: LeagueInfo[] = [];
            for (let i = previousLeagueIndex + 1; i <= currentLeagueIndex; i += 1) {
                const leagueName = LEAGUE_NAMES[i];
                crossed.push(LEAGUES_DATA[leagueName]);
            }
            setLevelUpQueue((prev) => [...prev, ...crossed]);
            triggerWhisper("The orbit is changing.");
        }

        previousLeagueIndexRef.current = currentLeagueIndex;
    }, [isXpHydrated, state.totalXP]);

    // Display one queued transition at a time.
    useEffect(() => {
        if (levelUpEvent || levelUpQueue.length === 0) return;
        const [next, ...rest] = levelUpQueue;
        setLevelUpEvent(next);
        setLevelUpQueue(rest);
    }, [levelUpEvent, levelUpQueue]);

    // 1. Daily Login & Persistence
    useEffect(() => {
        if (!user || !isXpHydrated) return;

        const today = getToday();

        setState((prev) => {
            let newActiveDays = prev.activeDays || [];
            if (!newActiveDays.includes(today)) {
                newActiveDays = [...newActiveDays, today];
            }

            let currentMarks = [...(prev.marks || [])];
            let newStreak = prev.streak;

            // Mark: Eternal
            const leagueIndex = getLeagueIndexFromXp(prev.totalXP);
            const currentLeague = LEAGUE_NAMES[leagueIndex];
            if (currentLeague === 'Eternal') currentMarks = tryUnlockMark('eternal_mark', currentMarks);
            if (newActiveDays.length >= 14) currentMarks = tryUnlockMark('daybreaker', currentMarks);
            if (newActiveDays.length >= 30) currentMarks = tryUnlockMark('legacy', currentMarks);

            // Streak Maintenance
            if (prev.lastLoginDate !== today && prev.lastLoginDate) {
                const gap = checkStreakMaintenance(prev.lastLoginDate, today);
                if (gap === 0) newStreak = 0;
            }

            let updated = prev;
            if (prev.lastLoginDate !== today) {
                pendingWelcomeWhisperRef.current = true;
                updated = {
                    ...prev,
                    totalXP: prev.totalXP + 5,
                    lastLoginDate: today,
                    dailyDwellXP: 0,
                    lastDwellDate: today,
                    activeDays: newActiveDays,
                    marks: currentMarks,
                    streak: newStreak
                };
            } else if (JSON.stringify(currentMarks) !== JSON.stringify(prev.marks)) {
                updated = { ...prev, marks: currentMarks };
            }

            localStorage.setItem(`180_xp_data_${user.email}`, JSON.stringify(updated));
            return updated;
        });
    }, [isXpHydrated, user?.email]);

    useEffect(() => {
        if (!pendingWelcomeWhisperRef.current) return;
        pendingWelcomeWhisperRef.current = false;
        triggerWhisper("Welcome back.");
    }, [state.lastLoginDate]);

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
        const newUniqueGenres = [...(state.uniqueGenres || [])];

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
        const knownMovie = KNOWN_MOVIES_BY_ID.get(movieId);

        if (!newUniqueGenres.includes(genre)) {
            newUniqueGenres.push(genre);
            if (newUniqueGenres.length >= 10) currentMarks = tryUnlockMark('wide_lens', currentMarks);
            if (newUniqueGenres.length >= 3) currentMarks = tryUnlockMark('genre_discovery', currentMarks);
        }

        // Check for 'One Genre Devotion' (20 in one genre)
        const allRituals = [newRitual, ...(state.dailyRituals || [])];
        if (allRituals.length >= 20) currentMarks = tryUnlockMark('ritual_marathon', currentMarks);
        if (allRituals.length >= 50) currentMarks = tryUnlockMark('archive_keeper', currentMarks);

        const exact180Count = allRituals.filter((ritual) => ritual.text.length === 180).length;
        if (exact180Count >= 3) currentMarks = tryUnlockMark('precision_loop', currentMarks);

        const genreCount = allRituals.filter(r => r.genre === genre).length;
        if (genreCount >= 20) currentMarks = tryUnlockMark('one_genre_devotion', currentMarks);

        const latestFiveGenres = allRituals
            .slice(0, 5)
            .map((ritual) => ritual.genre?.trim().toLowerCase())
            .filter((value): value is string => Boolean(value));
        if (latestFiveGenres.length === 5 && new Set(latestFiveGenres).size === 5) {
            currentMarks = tryUnlockMark('genre_nomad', currentMarks);
        }

        if (knownMovie?.year && knownMovie.year < 1990) currentMarks = tryUnlockMark('classic_soul', currentMarks);
        if (typeof knownMovie?.voteAverage === 'number' && knownMovie.voteAverage <= 7.9) {
            currentMarks = tryUnlockMark('hidden_gem', currentMarks);
        }

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

        if (isSupabaseLive() && supabase && user?.id) {
            const leagueForInsert = LEAGUE_NAMES[getLeagueIndexFromXp(newTotalXP)];
            void supabase
                .from('rituals')
                .insert([
                    {
                        user_id: user.id,
                        author: user.name || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        timestamp: new Date().toISOString(),
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    }
                ])
                .then(({ error }) => {
                    if (error) {
                        console.error('[Ritual] Failed to sync ritual:', error);
                        triggerWhisper("Ritual kaydedildi ama cloud senkronu basarisiz oldu.");
                    }
                });
        }
    };

    const deleteRitual = (ritualId: string) => {
        if (!ritualId) return;
        const normalizedId = String(ritualId);
        const exists = (state.dailyRituals || []).some((ritual) => String(ritual.id) === normalizedId);
        if (!exists) return;

        setState((prev) => {
            const currentRituals = prev.dailyRituals || [];
            const remaining = currentRituals.filter((ritual) => String(ritual.id) !== normalizedId);
            const updated = { ...prev, dailyRituals: remaining };
            if (user) {
                localStorage.setItem(`180_xp_data_${user.email}`, JSON.stringify(updated));
            }
            return updated;
        });
        triggerWhisper("Ritual erased.");
    };

    // 4. Social
    const echoRitual = (ritualId: string) => {
        void ritualId;
        const newXP = state.totalXP + 1;
        const newGiven = (state.echoesGiven || 0) + 1;
        let currentMarks = [...(state.marks || [])];
        if (state.echoesGiven === 0) currentMarks = tryUnlockMark('echo_initiate', currentMarks);
        if (newGiven >= 10) currentMarks = tryUnlockMark('echo_chamber', currentMarks);
        updateState({ totalXP: newXP, marks: currentMarks, echoesGiven: newGiven });
    };

    const receiveEcho = (movieTitle = "Unknown Ritual") => {
        const newXP = state.totalXP + 3;
        const newReceived = (state.echoesReceived || 0) + 1;
        let currentMarks = [...(state.marks || [])];

        if (newReceived >= 1) currentMarks = tryUnlockMark('first_echo', currentMarks);
        if (newReceived >= 1) currentMarks = tryUnlockMark('echo_receiver', currentMarks);
        if (newReceived >= 5) currentMarks = tryUnlockMark('influencer', currentMarks);
        if (newReceived >= 5) currentMarks = tryUnlockMark('resonator', currentMarks);

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
        setState(prev => {
            const updated = { ...prev, totalXP: prev.totalXP + amount };
            if (user) {
                localStorage.setItem(`180_xp_data_${user.email}`, JSON.stringify(updated));
            }
            return updated;
        });
    };

    useEffect(() => {
        if (!user || !isXpHydrated) return;

        const userKey = `180_xp_data_${user.email}`;
        localStorage.setItem(userKey, JSON.stringify(state));

        if (!isSupabaseLive() || !supabase || !user.id) return;

        void supabase
            .from('profiles')
            .upsert(
                {
                    user_id: user.id,
                    email: user.email,
                    display_name: user.name,
                    xp_state: state,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            )
            .then(({ error }) => {
                if (error) {
                    const msg = error.message.toLowerCase();
                    if (!msg.includes('relation "profiles"') && !msg.includes('does not exist')) {
                        console.error('[XP] failed to upsert profile state', error);
                    }
                }
            });
    }, [isXpHydrated, state, user]);

    const debugUnlockMark = (markId: string) => {
        const updated = tryUnlockMark(markId, state.marks);
        updateState({ marks: updated });
    };

    const updateIdentity = (bio: string, avatarId: string) => {
        updateState({ bio, avatarId });
        triggerWhisper("Identity shifted.");
    };

    const leagueIndex = getLeagueIndexFromXp(state.totalXP);
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
            deleteRitual,
            echoRitual,
            receiveEcho,
            debugAddXP,
            debugUnlockMark,
            user,
            authMode,
            login,
            loginWithGoogle,
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
