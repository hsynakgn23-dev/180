import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MAJOR_MARKS } from '../data/marksData';
import { TMDB_SEEDS } from '../data/tmdbSeeds';
import { supabase, isSupabaseLive } from '../lib/supabase';
import { moderateComment } from '../lib/commentModeration';
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
    fullName: string;
    username: string;
    gender: RegistrationGender | '';
    birthDate: string; // YYYY-MM-DD
    bio: string; // Max 180 chars
    avatarId: string; // e.g. 'geo_1', 'geo_2'
    avatarUrl?: string; // Custom uploaded image (Data URL)
    lastShareRewardDate: string | null;
}

interface AuthResult {
    ok: boolean;
    message?: string;
}

type ShareRewardTrigger = 'comment' | 'streak';

interface SessionUser {
    id?: string;
    email: string;
    name: string;
    fullName?: string;
    username?: string;
    gender?: RegistrationGender | '';
    birthDate?: string;
}

export interface LeagueInfo {
    name: string;
    color: string;
    description: string;
}

export interface StreakCelebrationEvent {
    day: number;
    isMilestone: boolean;
}

export type RegistrationGender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

export interface RegistrationProfileInput {
    fullName: string;
    username: string;
    gender: RegistrationGender;
    birthDate: string; // YYYY-MM-DD
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
    streakCelebrationEvent: StreakCelebrationEvent | null;
    closeStreakCelebration: () => void;
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
    fullName: string;
    username: string;
    gender: RegistrationGender | '';
    birthDate: string;
    bio: string;
    avatarId: string;
    updateIdentity: (bio: string, avatarId: string) => void;
    updatePersonalInfo: (profile: RegistrationProfileInput) => Promise<AuthResult>;
    toggleFollowUser: (username: string) => void;
    awardShareXP: (platform: 'instagram' | 'tiktok' | 'x', trigger: ShareRewardTrigger) => AuthResult;
    submitRitual: (movieId: number, text: string, rating: number, genre: string, title?: string, posterPath?: string) => AuthResult;
    deleteRitual: (ritualId: string) => void;
    echoRitual: (ritualId: string) => void;
    receiveEcho: (movieTitle?: string) => void;
    debugAddXP: (amount: number) => void;
    debugUnlockMark: (markId: string) => void;
    user: SessionUser | null;
    authMode: 'supabase' | 'local';
    isPasswordRecoveryMode: boolean;
    login: (email: string, password: string, isRegistering?: boolean, registrationProfile?: RegistrationProfileInput) => Promise<AuthResult>;
    requestPasswordReset: (email: string) => Promise<AuthResult>;
    completePasswordReset: (newPassword: string) => Promise<AuthResult>;
    loginWithGoogle: () => Promise<AuthResult>;
    logout: () => Promise<void>;
    avatarUrl?: string; // Custom uploaded avatar
    updateAvatar: (url: string) => void;
}


const MAX_DAILY_DWELL_XP = 20;
const LEVEL_THRESHOLD = 500;
const LONG_FORM_RITUAL_THRESHOLD = 160;
const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_MILESTONES = new Set([5, 7, 10, 20, 40, 50, 100, 200, 250, 300, 350]);
const REGISTRATION_GENDERS: RegistrationGender[] = ['female', 'male', 'non_binary', 'prefer_not_to_say'];
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const SHARE_REWARD_XP = 18;
export const LEAGUE_NAMES = Object.keys(LEAGUES_DATA);
type PendingRegistrationProfile = RegistrationProfileInput & { email: string };
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

const getLocalDateKey = (value = new Date()): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateKeyToDayIndex = (dateKey: string): number | null => {
    const parts = dateKey.split('-').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
    const [year, month, day] = parts;
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.floor(parsed.getTime() / DAY_MS);
};

const isSupabaseCapabilityError = (
    error: { code?: string | null; message?: string | null } | null | undefined
): boolean => {
    if (!error) return false;
    const code = (error.code || '').toUpperCase();
    const message = (error.message || '').toLowerCase();
    if (code === 'PGRST205' || code === '42P01' || code === '42501') return true;
    return (
        message.includes('relation "') ||
        message.includes('does not exist') ||
        message.includes('schema cache') ||
        message.includes('permission') ||
        message.includes('policy') ||
        message.includes('jwt') ||
        message.includes('forbidden')
    );
};

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
    fullName: '',
    username: '',
    gender: '',
    birthDate: '',
    bio,
    avatarId: "geo_1",
    lastShareRewardDate: null
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
        fullName: input.fullName || '',
        username: input.username || '',
        gender: (input.gender as RegistrationGender) || '',
        birthDate: input.birthDate || '',
        bio: input.bio || fallback.bio,
        avatarId: input.avatarId || fallback.avatarId,
        lastShareRewardDate: input.lastShareRewardDate || null
    };
};

const getLegacyStoredUser = (): SessionUser | null => {
    const stored = localStorage.getItem('180_user_session');
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored) as Partial<SessionUser>;
        if (!parsed.email || typeof parsed.email !== 'string') return null;
        const fallbackName = parsed.email.split('@')[0] || 'observer';
        const rawGender = typeof parsed.gender === 'string' ? parsed.gender : '';
        const normalizedGender = REGISTRATION_GENDERS.includes(rawGender as RegistrationGender)
            ? (rawGender as RegistrationGender)
            : '';
        return {
            id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : undefined,
            email: parsed.email,
            name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : fallbackName,
            fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
            username: typeof parsed.username === 'string' ? parsed.username : '',
            gender: normalizedGender,
            birthDate: typeof parsed.birthDate === 'string' ? parsed.birthDate : ''
        };
    } catch {
        return null;
    }
};

const isPasswordRecoveryUrl = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return hash.includes('type=recovery') || search.includes('type=recovery');
};

const buildAuthRedirectTo = (): string => {
    const envRedirect = import.meta.env.VITE_AUTH_REDIRECT_TO;
    if (typeof envRedirect === 'string' && envRedirect.trim()) {
        return envRedirect.trim();
    }
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/`;
    }
    return '/';
};

const clearRecoveryUrlState = () => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '';
    currentUrl.searchParams.delete('type');
    currentUrl.searchParams.delete('access_token');
    currentUrl.searchParams.delete('refresh_token');
    currentUrl.searchParams.delete('expires_in');
    currentUrl.searchParams.delete('token_type');
    currentUrl.searchParams.delete('provider_token');
    currentUrl.searchParams.delete('provider_refresh_token');
    window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}`);
};

const normalizeAuthError = (message: string): string => {
    const lowered = message.toLowerCase();
    if (lowered.includes('invalid login credentials')) return 'Email veya sifre hatali.';
    if (lowered.includes('email not confirmed')) return 'E-posta onayi gerekli.';
    if (lowered.includes('user already registered')) return 'Bu e-posta zaten kayitli.';
    if (lowered.includes('unsupported provider') || lowered.includes('provider is not enabled')) {
        return 'Google girisi aktif degil. Supabase Dashboard > Authentication > Providers > Google bolumunden etkinlestir.';
    }
    if (lowered.includes('redirect_to is not allowed') || lowered.includes('redirect url')) {
        return 'Google yonlendirme adresi hatali. Supabase ve Google Console ayarlarina mevcut site adresini ekle.';
    }
    if (lowered.includes('email rate limit exceeded') || lowered.includes('rate limit')) {
        return 'Cok fazla deneme yapildi. Biraz bekleyip tekrar dene.';
    }
    if (lowered.includes('same password')) {
        return 'Yeni sifre mevcut sifreden farkli olmali.';
    }
    if (lowered.includes('auth session missing')) {
        return 'Sifre yenileme oturumu bulunamadi. E-postadaki baglantiyi yeniden ac.';
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
    const metadataUsername = typeof authUser.user_metadata?.username === 'string'
        ? authUser.user_metadata.username
        : '';
    const metadataGenderRaw = typeof authUser.user_metadata?.gender === 'string'
        ? authUser.user_metadata.gender
        : '';
    const metadataGender = REGISTRATION_GENDERS.includes(metadataGenderRaw as RegistrationGender)
        ? (metadataGenderRaw as RegistrationGender)
        : '';
    const metadataBirthDate = typeof authUser.user_metadata?.birth_date === 'string'
        ? authUser.user_metadata.birth_date
        : '';
    const fallbackName = authUser.email.split('@')[0] || 'observer';
    const resolvedName = metadataName.trim() || metadataUsername.trim() || fallbackName;
    return {
        id: authUser.id,
        email: authUser.email,
        name: resolvedName,
        fullName: metadataName.trim(),
        username: metadataUsername.trim(),
        gender: metadataGender,
        birthDate: metadataBirthDate
    };
};

const XPContext = createContext<XPContextType | undefined>(undefined);

export const XPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<SessionUser | null>(() => getLegacyStoredUser());

    const [state, setState] = useState<XPState>(buildInitialXPState());
    const [whisper, setWhisper] = useState<string | null>(null);
    const [levelUpEvent, setLevelUpEvent] = useState<LeagueInfo | null>(null);
    const [levelUpQueue, setLevelUpQueue] = useState<LeagueInfo[]>([]);
    const [streakCelebrationEvent, setStreakCelebrationEvent] = useState<StreakCelebrationEvent | null>(null);
    const previousLeagueIndexRef = useRef(getLeagueIndexFromXp(state.totalXP));
    const pendingWelcomeWhisperRef = useRef(false);
    const pendingRegistrationProfileRef = useRef<PendingRegistrationProfile | null>(null);
    const canReadProfileStateRef = useRef(true);
    const canWriteProfileStateRef = useRef(true);
    const canWriteRitualRef = useRef(true);
    const [isXpHydrated, setIsXpHydrated] = useState(false);
    const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(() => isPasswordRecoveryUrl());
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

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecoveryMode(true);
            }
            if (event === 'SIGNED_OUT') {
                setIsPasswordRecoveryMode(false);
            }
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
        setStreakCelebrationEvent(null);
        canReadProfileStateRef.current = true;
        canWriteProfileStateRef.current = true;
        canWriteRitualRef.current = true;

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

            if (isSupabaseLive() && supabase && user.id && canReadProfileStateRef.current) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('xp_state')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!error && data?.xp_state && typeof data.xp_state === 'object') {
                    resolvedState = normalizeXPState(data.xp_state as Partial<XPState>);
                } else if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canReadProfileStateRef.current = false;
                    } else {
                        console.error('[XP] failed to read profile state', error);
                    }
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

            const pendingRegistration = pendingRegistrationProfileRef.current;
            if (pendingRegistration && pendingRegistration.email === user.email) {
                resolvedState = {
                    ...resolvedState,
                    fullName: pendingRegistration.fullName,
                    username: pendingRegistration.username,
                    gender: pendingRegistration.gender,
                    birthDate: pendingRegistration.birthDate
                };
                pendingRegistrationProfileRef.current = null;
            }

            resolvedState = {
                ...resolvedState,
                fullName: resolvedState.fullName || user.fullName || '',
                username: resolvedState.username || user.username || '',
                gender: resolvedState.gender || user.gender || '',
                birthDate: resolvedState.birthDate || user.birthDate || ''
            };

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

    const getToday = () => getLocalDateKey();

    // Check streak maintenance logic
    const checkStreakMaintenance = (lastDate: string | null, today: string) => {
        if (!lastDate) return 1;
        const lastDayIndex = parseDateKeyToDayIndex(lastDate);
        const todayDayIndex = parseDateKeyToDayIndex(today);
        if (lastDayIndex === null || todayDayIndex === null) return undefined;
        const diffDays = todayDayIndex - lastDayIndex;
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

    const triggerStreakCelebration = (day: number) => {
        if (!Number.isFinite(day) || day <= 0) return;
        setStreakCelebrationEvent({
            day,
            isMilestone: STREAK_MILESTONES.has(day)
        });
    };

    const login = async (
        email: string,
        password: string,
        isRegistering = false,
        registrationProfile?: RegistrationProfileInput
    ): Promise<AuthResult> => {
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail.includes('@')) {
            return { ok: false, message: 'Gecerli bir e-posta gir.' };
        }
        if ((password || '').length < 6) {
            return { ok: false, message: 'Sifre en az 6 karakter olmali.' };
        }

        const normalizedRegistration: RegistrationProfileInput | null = isRegistering
            ? {
                fullName: (registrationProfile?.fullName || '').trim(),
                username: (registrationProfile?.username || '').trim(),
                gender: registrationProfile?.gender || 'prefer_not_to_say',
                birthDate: (registrationProfile?.birthDate || '').trim()
            }
            : null;

        if (isRegistering) {
            if (!normalizedRegistration?.fullName || normalizedRegistration.fullName.length < 2) {
                return { ok: false, message: 'Isim en az 2 karakter olmali.' };
            }
            if (!USERNAME_REGEX.test(normalizedRegistration.username)) {
                return { ok: false, message: 'Kullanici adi 3-20 karakter olmali (harf, rakam, _).' };
            }
            if (!REGISTRATION_GENDERS.includes(normalizedRegistration.gender)) {
                return { ok: false, message: 'Cinsiyet secimi gecersiz.' };
            }
            if (!normalizedRegistration.birthDate) {
                return { ok: false, message: 'Dogum tarihi gerekli.' };
            }

            const birthDate = new Date(`${normalizedRegistration.birthDate}T00:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
                return { ok: false, message: 'Dogum tarihi gecersiz.' };
            }
        }

        if (!isSupabaseLive() || !supabase) {
            if (normalizedRegistration) {
                pendingRegistrationProfileRef.current = {
                    email: normalizedEmail,
                    ...normalizedRegistration
                };
            }

            const fallbackUser: SessionUser = {
                email: normalizedEmail,
                name: normalizedRegistration?.fullName || normalizedEmail.split('@')[0] || 'observer',
                fullName: normalizedRegistration?.fullName || '',
                username: normalizedRegistration?.username || '',
                gender: normalizedRegistration ? normalizedRegistration.gender : '',
                birthDate: normalizedRegistration?.birthDate || ''
            };
            setSessionUser(fallbackUser);
            triggerWhisper("Welcome to the Ritual.");
            return { ok: true, message: 'Supabase kapali oldugu icin local session acildi.' };
        }

        try {
            if (isRegistering) {
                if (!normalizedRegistration) {
                    return { ok: false, message: 'Kayit bilgileri eksik.' };
                }

                pendingRegistrationProfileRef.current = {
                    email: normalizedEmail,
                    ...normalizedRegistration
                };

                const { data, error } = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        data: {
                            full_name: normalizedRegistration.fullName,
                            name: normalizedRegistration.fullName,
                            username: normalizedRegistration.username,
                            gender: normalizedRegistration.gender,
                            birth_date: normalizedRegistration.birthDate
                        }
                    }
                });

                if (error) return { ok: false, message: normalizeAuthError(error.message) };
                if (data.session?.user) {
                    const mapped = toSessionUser(data.session.user);
                    if (mapped) {
                        setSessionUser(mapped);
                    }
                    triggerWhisper("Account created.");
                    return { ok: true, message: 'Kayit tamamlandi. Oturum acildi.' };
                }

                setSessionUser(null);
                return {
                    ok: true,
                    message: 'Kayit tamamlandi. E-posta onayi sonrasi giris yap.'
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
            const redirectTo = buildAuthRedirectTo();
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

    const requestPasswordReset = async (email: string): Promise<AuthResult> => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            return { ok: false, message: 'E-posta gerekli.' };
        }

        if (!isSupabaseLive() || !supabase) {
            return { ok: false, message: 'Sifre sifirlama icin Supabase gerekli.' };
        }

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: buildAuthRedirectTo()
            });
            if (error) return { ok: false, message: normalizeAuthError(error.message) };
            return { ok: true, message: 'Sifre yenileme baglantisi e-posta adresine gonderildi.' };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Password reset failed.';
            return { ok: false, message: normalizeAuthError(message) };
        }
    };

    const completePasswordReset = async (newPassword: string): Promise<AuthResult> => {
        const normalizedPassword = newPassword.trim();
        if (normalizedPassword.length < 6) {
            return { ok: false, message: 'Sifre en az 6 karakter olmali.' };
        }

        if (!isSupabaseLive() || !supabase) {
            return { ok: false, message: 'Sifre guncelleme icin Supabase gerekli.' };
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: normalizedPassword });
            if (error) return { ok: false, message: normalizeAuthError(error.message) };

            setIsPasswordRecoveryMode(false);
            clearRecoveryUrlState();
            triggerWhisper("Password updated.");
            return { ok: true, message: 'Sifre guncellendi.' };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Password update failed.';
            return { ok: false, message: normalizeAuthError(message) };
        }
    };

    const logout = async () => {
        if (isSupabaseLive() && supabase) {
            await supabase.auth.signOut();
        }
        setSessionUser(null);
        setIsPasswordRecoveryMode(false);
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

    const awardShareXP = (platform: 'instagram' | 'tiktok' | 'x', trigger: ShareRewardTrigger): AuthResult => {
        const today = getToday();

        if (trigger === 'comment') {
            const hasCommentToday = state.dailyRituals.some((ritual) => ritual.date === today);
            if (!hasCommentToday) {
                return { ok: false, message: 'Yorum paylasim bonusu icin once bugun yorum yaz.' };
            }
        }

        if (trigger === 'streak') {
            const isStreakCompletedToday = state.streak > 0 && state.lastStreakDate === today;
            if (!isStreakCompletedToday) {
                return { ok: false, message: 'Streak paylasim bonusu icin once bugunku rituelini tamamla.' };
            }
        }

        if (state.lastShareRewardDate === today) {
            return { ok: false, message: 'Bugun paylasim bonusu zaten alindi.' };
        }

        const nextXP = state.totalXP + SHARE_REWARD_XP;
        updateState({
            totalXP: nextXP,
            lastShareRewardDate: today
        });
        triggerWhisper(`Paylasim bonusi +${SHARE_REWARD_XP} XP`);

        const platformLabel = platform === 'x' ? 'X' : platform === 'tiktok' ? 'TikTok' : 'Instagram';
        const triggerLabel = trigger === 'streak' ? 'streak paylasimi' : 'yorum paylasimi';
        return {
            ok: true,
            message: `${platformLabel} ${triggerLabel} kaydedildi. +${SHARE_REWARD_XP} XP`
        };
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
    const submitRitual = (
        movieId: number,
        text: string,
        _rating: number,
        genre: string,
        title?: string,
        posterPath?: string
    ): AuthResult => {
        const moderation = moderateComment(text, { maxChars: 180, maxEmojiCount: 6, maxEmojiRatio: 0.2 });
        if (!moderation.ok) {
            const message = moderation.message || 'Yorum gonderilemedi.';
            triggerWhisper(message);
            return { ok: false, message };
        }

        const sanitizedText = text.trim();
        const today = getToday();
        if (state.dailyRituals.some(r => r.date === today && r.movieId === movieId)) {
            triggerWhisper("Memory stored.");
            return { ok: false, message: 'Bu filme bugun zaten yorum yazildi.' };
        }

        const length = sanitizedText.length;
        let earnedXP = 15;
        if (length === 180) earnedXP = 50;

        // Streak Logic
        let newStreak = state.streak;
        let nonConsecutive = state.nonConsecutiveCount;

        const hasdoneRitualToday = state.dailyRituals.some(r => r.date === today);
        // Streak is day-based, not comment-count based: only first ritual of the day can increase streak.
        const shouldIncreaseStreakToday = !hasdoneRitualToday;
        if (shouldIncreaseStreakToday) {
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
            triggerStreakCelebration(newStreak);
        }

        if (newStreak >= 7) earnedXP *= 1.5;

        let currentMarks = [...(state.marks || [])];
        const newUniqueGenres = [...(state.uniqueGenres || [])];

        // --- MARK CHECKS ---
        if (state.dailyRituals.length === 0) currentMarks = tryUnlockMark('first_mark', currentMarks);
        if (length === 180) currentMarks = tryUnlockMark('180_exact', currentMarks);
        if (length < 40) currentMarks = tryUnlockMark('minimalist', currentMarks);
        if (length >= LONG_FORM_RITUAL_THRESHOLD) currentMarks = tryUnlockMark('deep_diver', currentMarks);

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
            text: sanitizedText,
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

        if (isSupabaseLive() && supabase && user?.id && canWriteRitualRef.current) {
            const leagueForInsert = LEAGUE_NAMES[getLeagueIndexFromXp(newTotalXP)];
            void (async () => {
                const { data: sessionData } = await supabase.auth.getSession();
                const sessionUser = sessionData.session?.user;

                if (!sessionUser?.id) {
                    triggerWhisper("Ritual yerelde kaydedildi. Cloud icin tekrar giris yap.");
                    return;
                }

                const ritualInsertPayloads: Array<Record<string, string | null>> = [
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        timestamp: new Date().toISOString(),
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        timestamp: new Date().toISOString(),
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        timestamp: new Date().toISOString(),
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        timestamp: new Date().toISOString()
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text
                    }
                ];

                let insertError: { code?: string | null; message?: string | null } | null = null;

                for (const payload of ritualInsertPayloads) {
                    const { error } = await supabase
                        .from('rituals')
                        .insert([payload]);
                    if (!error) {
                        insertError = null;
                        break;
                    }
                    insertError = error;
                    if (!isSupabaseCapabilityError(error)) {
                        break;
                    }
                }

                if (insertError) {
                    if (isSupabaseCapabilityError(insertError)) {
                        canWriteRitualRef.current = false;
                        triggerWhisper("Cloud ritual sync devre disi. Yerel kayitla devam ediliyor.");
                        return;
                    }
                    console.error('[Ritual] Failed to sync ritual:', insertError);
                    const lowered = (insertError.message || '').toLowerCase();
                    if (lowered.includes('permission') || lowered.includes('policy') || lowered.includes('jwt')) {
                        triggerWhisper("Cloud izni reddedildi. Cikis-giris yapip tekrar dene.");
                    } else {
                        triggerWhisper("Ritual kaydedildi ama cloud senkronu basarisiz oldu.");
                    }
                }
            })();
        }

        return { ok: true, message: 'Yorum kaydedildi.' };
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

        if (!isSupabaseLive() || !supabase || !user.id || !canWriteProfileStateRef.current) return;

        void supabase
            .from('profiles')
            .upsert(
                {
                    user_id: user.id,
                    email: user.email,
                    display_name: state.username || state.fullName || user.name,
                    xp_state: state,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            )
            .then(({ error }) => {
                if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canWriteProfileStateRef.current = false;
                    } else {
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

    const updatePersonalInfo = async (profile: RegistrationProfileInput): Promise<AuthResult> => {
        if (!user) {
            return { ok: false, message: 'Oturum bulunamadi.' };
        }

        const normalizedProfile: RegistrationProfileInput = {
            fullName: (profile.fullName || '').trim(),
            username: (profile.username || '').trim(),
            gender: profile.gender,
            birthDate: (profile.birthDate || '').trim()
        };

        if (!normalizedProfile.fullName || normalizedProfile.fullName.length < 2) {
            return { ok: false, message: 'Isim en az 2 karakter olmali.' };
        }
        if (!USERNAME_REGEX.test(normalizedProfile.username)) {
            return { ok: false, message: 'Kullanici adi 3-20 karakter olmali (harf, rakam, _).' };
        }
        if (!REGISTRATION_GENDERS.includes(normalizedProfile.gender)) {
            return { ok: false, message: 'Cinsiyet secimi gecersiz.' };
        }
        if (!normalizedProfile.birthDate) {
            return { ok: false, message: 'Dogum tarihi gerekli.' };
        }

        const birthDate = new Date(`${normalizedProfile.birthDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
            return { ok: false, message: 'Dogum tarihi gecersiz.' };
        }

        updateState({
            fullName: normalizedProfile.fullName,
            username: normalizedProfile.username,
            gender: normalizedProfile.gender,
            birthDate: normalizedProfile.birthDate
        });

        const displayName = normalizedProfile.fullName || normalizedProfile.username || user.name;
        setSessionUser({
            ...user,
            name: displayName,
            fullName: normalizedProfile.fullName,
            username: normalizedProfile.username,
            gender: normalizedProfile.gender,
            birthDate: normalizedProfile.birthDate
        });

        if (isSupabaseLive() && supabase) {
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: normalizedProfile.fullName,
                    name: normalizedProfile.fullName,
                    username: normalizedProfile.username,
                    gender: normalizedProfile.gender,
                    birth_date: normalizedProfile.birthDate
                }
            });

            if (error) {
                return {
                    ok: true,
                    message: `Profil guncellendi fakat cloud metadata senkronu basarisiz: ${normalizeAuthError(error.message)}`
                };
            }
        }

        triggerWhisper("Identity shifted.");
        return { ok: true, message: 'Profil bilgileri guncellendi.' };
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
            streakCelebrationEvent,
            closeStreakCelebration: () => setStreakCelebrationEvent(null),
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
            fullName: state.fullName || '',
            username: state.username || '',
            gender: state.gender || '',
            birthDate: state.birthDate || '',
            bio: state.bio,
            avatarId: state.avatarId,
            updateIdentity,
            updatePersonalInfo,
            toggleFollowUser,
            awardShareXP,
            submitRitual,
            deleteRitual,
            echoRitual,
            receiveEcho,
            debugAddXP,
            debugUnlockMark,
            user,
            authMode,
            isPasswordRecoveryMode,
            login,
            requestPasswordReset,
            completePasswordReset,
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
