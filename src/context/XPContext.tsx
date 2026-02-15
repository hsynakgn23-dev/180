import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MAJOR_MARKS } from '../data/marksData';
import { TMDB_SEEDS } from '../data/tmdbSeeds';
import { supabase, isSupabaseLive } from '../lib/supabase';
import { moderateComment } from '../lib/commentModeration';
import { trackEvent } from '../lib/analytics';
import { claimInviteCodeViaApi, ensureInviteCodeViaApi, getReferralDeviceKey } from '../lib/referralApi';
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
    inviteCode: string;
    invitedByCode: string | null;
    inviteClaimsCount: number;
    inviteRewardsEarned: number;
    inviteClaimedAt: string | null;
    referralAcceptedKeys: string[];
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

export interface SharePromptEvent {
    id: string;
    preferredGoal: ShareRewardTrigger;
    commentPreview: string;
    streak: number;
    date: string;
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
    sharePromptEvent: SharePromptEvent | null;
    dismissSharePrompt: () => void;
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
    isFollowingUser: (targetUserId?: string | null, username?: string) => boolean;
    fullName: string;
    username: string;
    gender: RegistrationGender | '';
    birthDate: string;
    bio: string;
    avatarId: string;
    updateIdentity: (bio: string, avatarId: string) => void;
    updatePersonalInfo: (profile: RegistrationProfileInput) => Promise<AuthResult>;
    toggleFollowUser: (target: { userId?: string | null; username: string }) => Promise<AuthResult>;
    awardShareXP: (platform: 'instagram' | 'tiktok' | 'x', trigger: ShareRewardTrigger) => AuthResult;
    inviteCode: string;
    inviteLink: string;
    invitedByCode: string | null;
    inviteClaimsCount: number;
    inviteRewardsEarned: number;
    inviteRewardConfig: {
        inviterXp: number;
        inviteeXp: number;
    };
    claimInviteCode: (code: string) => Promise<AuthResult>;
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
const USER_XP_STORAGE_KEY_PREFIX = '180_xp_data_';
const USER_RITUAL_BACKUP_KEY_PREFIX = '180_ritual_backup_';
const MAX_PERSISTED_AVATAR_URL_LENGTH = 180_000;
const STORAGE_RECOVERY_KEYS = ['DAILY_CANDIDATE_POOL_V2', 'DAILY_SELECTION_V18'] as const;
const INVITE_CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const INVITE_CODE_LENGTH = 8;
const INVITER_REWARD_XP = 40;
const INVITEE_REWARD_XP = 24;
const MAX_DAILY_DEVICE_INVITE_CLAIMS = 3;
const MAX_REFERRAL_ACCEPTED_KEYS = 200;
const INVITE_REGISTRY_STORAGE_KEY = '180_invite_registry_v1';
const PENDING_INVITE_CODE_STORAGE_KEY = '180_pending_invite_code_v1';
const INVITE_DEVICE_GUARD_STORAGE_KEY = '180_invite_device_guard_v1';
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
const KNOWN_MOVIE_ID_BY_TITLE = new Map(
    TMDB_SEEDS.map((movie) => [movie.title.trim().toLowerCase(), movie.id] as const)
);

type InviteRegistryEntry = {
    ownerEmail: string;
    ownerUserId: string | null;
    createdAt: string;
    claimCount: number;
    lastClaimAt: string | null;
};

type InviteRegistry = Record<string, InviteRegistryEntry>;

type InviteDeviceGuard = {
    date: string;
    count: number;
    claimedCodes: string[];
};

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
    lastShareRewardDate: null,
    inviteCode: '',
    invitedByCode: null,
    inviteClaimsCount: 0,
    inviteRewardsEarned: 0,
    inviteClaimedAt: null,
    referralAcceptedKeys: []
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
        lastShareRewardDate: input.lastShareRewardDate || null,
        inviteCode: isValidInviteCode(String(input.inviteCode || '')) ? normalizeInviteCode(String(input.inviteCode)) : '',
        invitedByCode: isValidInviteCode(String(input.invitedByCode || ''))
            ? normalizeInviteCode(String(input.invitedByCode))
            : null,
        inviteClaimsCount: input.inviteClaimsCount || 0,
        inviteRewardsEarned: input.inviteRewardsEarned || 0,
        inviteClaimedAt: input.inviteClaimedAt || null,
        referralAcceptedKeys: Array.isArray(input.referralAcceptedKeys)
            ? input.referralAcceptedKeys
                .map((value) => String(value || '').trim())
                .filter((value) => Boolean(value))
                .slice(-MAX_REFERRAL_ACCEPTED_KEYS)
            : []
    };
};

const normalizeInviteCode = (value: string | null | undefined): string => {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
};

const isValidInviteCode = (value: string): boolean => INVITE_CODE_REGEX.test(normalizeInviteCode(value));

const readInviteRegistry = (): InviteRegistry => {
    try {
        const raw = localStorage.getItem(INVITE_REGISTRY_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as InviteRegistry;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch {
        return {};
    }
};

const writeInviteRegistry = (registry: InviteRegistry) => {
    try {
        localStorage.setItem(INVITE_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
    } catch {
        // no-op
    }
};

const persistPendingInviteCode = (rawCode: string) => {
    const normalized = normalizeInviteCode(rawCode);
    if (!isValidInviteCode(normalized)) return;
    try {
        localStorage.setItem(PENDING_INVITE_CODE_STORAGE_KEY, normalized);
    } catch {
        // no-op
    }
};

const readPendingInviteCode = (): string | null => {
    try {
        const raw = localStorage.getItem(PENDING_INVITE_CODE_STORAGE_KEY);
        const normalized = normalizeInviteCode(raw);
        return isValidInviteCode(normalized) ? normalized : null;
    } catch {
        return null;
    }
};

const clearPendingInviteCode = () => {
    try {
        localStorage.removeItem(PENDING_INVITE_CODE_STORAGE_KEY);
    } catch {
        // no-op
    }
};

const readInviteDeviceGuard = (): InviteDeviceGuard => {
    try {
        const raw = localStorage.getItem(INVITE_DEVICE_GUARD_STORAGE_KEY);
        if (!raw) return { date: '', count: 0, claimedCodes: [] };
        const parsed = JSON.parse(raw) as Partial<InviteDeviceGuard>;
        return {
            date: typeof parsed.date === 'string' ? parsed.date : '',
            count: Number.isFinite(parsed.count) ? Number(parsed.count) : 0,
            claimedCodes: Array.isArray(parsed.claimedCodes)
                ? parsed.claimedCodes.map((code) => normalizeInviteCode(String(code))).filter((code) => isValidInviteCode(code))
                : []
        };
    } catch {
        return { date: '', count: 0, claimedCodes: [] };
    }
};

const writeInviteDeviceGuard = (guard: InviteDeviceGuard) => {
    try {
        localStorage.setItem(INVITE_DEVICE_GUARD_STORAGE_KEY, JSON.stringify(guard));
    } catch {
        // no-op
    }
};

const buildInviteLink = (inviteCode: string): string => {
    const normalized = normalizeInviteCode(inviteCode);
    const baseOrigin =
        typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'https://180absolutecinema.com';
    const url = new URL('/', baseOrigin);

    if (!isValidInviteCode(normalized)) {
        return url.toString();
    }

    url.searchParams.set('invite', normalized);
    url.searchParams.set('utm_source', 'invite');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', 'user_invite');
    return url.toString();
};

const buildInviteCodeCandidate = (seed: string): string => {
    const normalizedSeed = String(seed || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4)
        .padEnd(4, 'X');
    const randomPart = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, '0');
    return `${normalizedSeed}${randomPart}`.slice(0, INVITE_CODE_LENGTH);
};

const ensureInviteCodeForOwner = (
    currentCode: string,
    ownerEmail: string,
    ownerUserId?: string
): string => {
    const normalizedEmail = String(ownerEmail || '').trim().toLowerCase();
    const normalizedUserId = String(ownerUserId || '').trim() || null;
    const registry = readInviteRegistry();
    const preferredCode = normalizeInviteCode(currentCode);
    if (isValidInviteCode(preferredCode)) {
        const existing = registry[preferredCode];
        if (!existing || existing.ownerEmail === normalizedEmail) {
            registry[preferredCode] = {
                ownerEmail: normalizedEmail,
                ownerUserId: normalizedUserId,
                createdAt: existing?.createdAt || new Date().toISOString(),
                claimCount: existing?.claimCount || 0,
                lastClaimAt: existing?.lastClaimAt || null
            };
            writeInviteRegistry(registry);
            return preferredCode;
        }
    }

    const seed = normalizedEmail.split('@')[0] || normalizedUserId || 'cine';
    for (let index = 0; index < 20; index += 1) {
        const candidate = buildInviteCodeCandidate(seed);
        const existing = registry[candidate];
        if (existing && existing.ownerEmail !== normalizedEmail) {
            continue;
        }
        registry[candidate] = {
            ownerEmail: normalizedEmail,
            ownerUserId: normalizedUserId,
            createdAt: existing?.createdAt || new Date().toISOString(),
            claimCount: existing?.claimCount || 0,
            lastClaimAt: existing?.lastClaimAt || null
        };
        writeInviteRegistry(registry);
        return candidate;
    }

    const fallback = `${Date.now().toString(36)}0000`.toUpperCase().slice(0, INVITE_CODE_LENGTH);
    registry[fallback] = {
        ownerEmail: normalizedEmail,
        ownerUserId: normalizedUserId,
        createdAt: new Date().toISOString(),
        claimCount: 0,
        lastClaimAt: null
    };
    writeInviteRegistry(registry);
    return fallback;
};

const normalizeFollowKey = (value: string | null | undefined): string => (value || '').trim().toLowerCase();
const buildFollowUserIdKey = (userId: string | null | undefined): string | null => {
    const normalized = normalizeFollowKey(userId);
    if (!normalized) return null;
    return `id:${normalized}`;
};

const getUserXpStorageKey = (email: string): string =>
    `${USER_XP_STORAGE_KEY_PREFIX}${(email || '').trim().toLowerCase()}`;

const getLegacyUserXpStorageKey = (email: string): string =>
    `${USER_XP_STORAGE_KEY_PREFIX}${email}`;

const compactStateForPersistence = (state: XPState): XPState => {
    if (!state.avatarUrl || state.avatarUrl.length <= MAX_PERSISTED_AVATAR_URL_LENGTH) {
        return state;
    }
    return {
        ...state,
        avatarUrl: undefined
    };
};

const persistUserXpStateToLocal = (email: string, state: XPState) => {
    if (!email) return;
    persistUserRitualBackupToLocal(email, state.dailyRituals || []);

    const primaryKey = getUserXpStorageKey(email);
    const legacyKey = getLegacyUserXpStorageKey(email);

    const writePayload = (payloadState: XPState, options?: { dropLegacyBeforeWrite?: boolean }): boolean => {
        try {
            if (options?.dropLegacyBeforeWrite && legacyKey !== primaryKey) {
                localStorage.removeItem(legacyKey);
            }
            localStorage.setItem(primaryKey, JSON.stringify(payloadState));
            if (legacyKey !== primaryKey) {
                localStorage.removeItem(legacyKey);
            }
            return true;
        } catch {
            return false;
        }
    };

    if (writePayload(state)) return;
    if (writePayload(state, { dropLegacyBeforeWrite: true })) return;

    const compactState = compactStateForPersistence(state);
    if (compactState !== state && writePayload(compactState, { dropLegacyBeforeWrite: true })) {
        console.warn('[XP] local persistence compacted by removing oversized avatar payload.');
        return;
    }

    // Recovery path for quota pressure: drop heavy cache keys and retry compact payload.
    for (const key of STORAGE_RECOVERY_KEYS) {
        try {
            localStorage.removeItem(key);
        } catch {
            // ignore
        }
    }

    try {
        localStorage.removeItem(primaryKey);
    } catch {
        // ignore
    }
    if (legacyKey !== primaryKey) {
        try {
            localStorage.removeItem(legacyKey);
        } catch {
            // ignore
        }
    }

    if (writePayload(compactState, { dropLegacyBeforeWrite: true })) {
        console.warn('[XP] local persistence recovered after cache cleanup.');
        return;
    }

    console.warn('[XP] local persistence failed; state could not be written.');
};

const readUserXpStateFromLocal = (email: string): XPState | null => {
    if (!email) return null;
    const primaryKey = getUserXpStorageKey(email);
    const legacyKey = getLegacyUserXpStorageKey(email);
    const keys = legacyKey === primaryKey ? [primaryKey] : [primaryKey, legacyKey];

    for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        try {
            const parsed = JSON.parse(stored) as Partial<XPState>;
            const normalized = normalizeXPState(parsed);
            if (key !== primaryKey) {
                persistUserXpStateToLocal(email, normalized);
            }
            return normalized;
        } catch {
            localStorage.removeItem(key);
        }
    }

    return null;
};

const getUserRitualBackupKey = (email: string): string =>
    `${USER_RITUAL_BACKUP_KEY_PREFIX}${(email || '').trim().toLowerCase()}`;

const fallbackMovieIdFromTitle = (title: string): number => {
    const normalized = (title || '').trim().toLowerCase();
    if (!normalized) return 0;
    const known = KNOWN_MOVIE_ID_BY_TITLE.get(normalized);
    if (known) return known;

    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return 100000000 + ((hash >>> 0) % 900000000);
};

const normalizeRitualDateKey = (input: string | null | undefined): string => {
    const raw = (input || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
    return getLocalDateKey();
};

const persistUserRitualBackupToLocal = (email: string, rituals: RitualLog[]) => {
    if (!email) return;
    const key = getUserRitualBackupKey(email);
    const normalized = mergeRitualLogs(rituals).slice(0, 800);

    const attempt = (limit: number): boolean => {
        try {
            localStorage.setItem(key, JSON.stringify(normalized.slice(0, limit)));
            return true;
        } catch {
            return false;
        }
    };

    if (attempt(800)) return;
    if (attempt(400)) return;
    if (attempt(200)) return;

    console.warn('[XP] ritual backup persistence failed.');
};

const readUserRitualBackupFromLocal = (email: string): RitualLog[] => {
    if (!email) return [];
    const key = getUserRitualBackupKey(email);
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as RitualLog[];
        if (!Array.isArray(parsed)) return [];
        return mergeRitualLogs(parsed.map((ritual) => normalizeRitualLog(ritual)));
    } catch {
        localStorage.removeItem(key);
        return [];
    }
};

type RitualBackupRow = {
    id: string | null;
    movie_title: string | null;
    poster_path?: string | null;
    text: string | null;
    timestamp?: string | null;
};

type UserFollowRow = {
    followed_user_id: string | null;
};

const RITUAL_READ_VARIANTS = [
    {
        select: 'id, movie_title, poster_path, text, timestamp',
        orderBy: 'timestamp'
    },
    {
        select: 'id, movie_title, poster_path, text, timestamp:created_at',
        orderBy: 'created_at'
    },
    {
        select: 'id, movie_title, text, timestamp',
        orderBy: 'timestamp'
    },
    {
        select: 'id, movie_title, text, timestamp:created_at',
        orderBy: 'created_at'
    }
] as const;

const readUserRitualsFromCloud = async (userId: string): Promise<RitualLog[]> => {
    if (!userId || !isSupabaseLive() || !supabase) return [];

    let rows: RitualBackupRow[] = [];
    let queryError: { code?: string | null; message?: string | null } | null = null;

    for (const variant of RITUAL_READ_VARIANTS) {
        const { data, error } = await supabase
            .from('rituals')
            .select(variant.select)
            .eq('user_id', userId)
            .order(variant.orderBy, { ascending: false })
            .limit(500);

        if (error) {
            queryError = error;
            if (isSupabaseCapabilityError(error)) {
                continue;
            }
            console.error('[XP] failed to read ritual backups', error);
            return [];
        }

        rows = Array.isArray(data) ? (data as unknown as RitualBackupRow[]) : [];
        queryError = null;
        break;
    }

    if (queryError) {
        return [];
    }

    const mapped: RitualLog[] = rows
        .map((row, index) => {
            const text = (row.text || '').trim();
            const movieTitle = (row.movie_title || '').trim();
            if (!text || !movieTitle) return null;

            const date = normalizeRitualDateKey(row.timestamp);
            const movieId = fallbackMovieIdFromTitle(movieTitle);
            const stableId = (row.id || '').trim() || `cloud-${date}-${movieId}-${index}`;

            return normalizeRitualLog({
                id: stableId,
                date,
                movieId,
                movieTitle,
                text,
                posterPath: row.poster_path || undefined
            });
        })
        .filter((item): item is RitualLog => Boolean(item));

    return mergeRitualLogs(mapped);
};

const maxDateKey = (values: Array<string | null | undefined>): string | null => {
    const valid = values.filter((value): value is string => Boolean(value && value.trim()));
    if (valid.length === 0) return null;
    return valid.reduce((latest, current) => (current > latest ? current : latest), valid[0]);
};

const mergeStringLists = (...lists: string[][]): string[] => {
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const list of lists) {
        for (const item of list || []) {
            const normalized = String(item || '').trim();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            merged.push(normalized);
        }
    }
    return merged;
};

const ritualMergeKey = (ritual: RitualLog): string => {
    const id = String(ritual.id || '').trim();
    if (id) return `id:${id}`;
    return `fallback:${ritual.date}|${ritual.movieId}|${ritual.text.trim()}`;
};

const ritualFingerprint = (ritual: RitualLog): string => {
    const date = normalizeRitualDateKey(ritual.date);
    const movieTitle = (ritual.movieTitle || '').trim().toLowerCase();
    const text = (ritual.text || '').trim().toLowerCase();
    const movieIdentity = movieTitle || String(ritual.movieId || 0);
    return `${date}|${movieIdentity}|${text}`;
};

const mergeRitualLogs = (...lists: RitualLog[][]): RitualLog[] => {
    const map = new Map<string, RitualLog>();
    const semanticToKey = new Map<string, string>();
    for (const list of lists) {
        for (const ritual of list || []) {
            const normalized = normalizeRitualLog(ritual);
            const keyById = ritualMergeKey(normalized);
            const semanticKey = ritualFingerprint(normalized);
            const key = semanticToKey.get(semanticKey) || keyById;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, normalized);
                semanticToKey.set(semanticKey, key);
                continue;
            }
            map.set(key, {
                ...existing,
                ...normalized,
                movieTitle:
                    normalized.movieTitle && normalized.movieTitle !== 'Unknown Title'
                        ? normalized.movieTitle
                        : existing.movieTitle,
                posterPath: normalized.posterPath || existing.posterPath,
                text: normalized.text.length >= existing.text.length ? normalized.text : existing.text,
                id: String(existing.id || '').trim() || String(normalized.id || '').trim()
            });
            semanticToKey.set(semanticKey, key);
        }
    }
    return Array.from(map.values()).sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return String(b.id).localeCompare(String(a.id));
    });
};

const echoHistoryMergeKey = (entry: EchoLog): string => {
    const id = String(entry.id || '').trim();
    if (id) return `id:${id}`;
    return `fallback:${entry.movieTitle}|${entry.date}`;
};

const mergeEchoHistory = (...lists: EchoLog[][]): EchoLog[] => {
    const map = new Map<string, EchoLog>();
    for (const list of lists) {
        for (const entry of list || []) {
            const normalized: EchoLog = {
                id: String(entry.id || '').trim() || `${entry.movieTitle}-${entry.date}`,
                movieTitle: entry.movieTitle || 'Unknown Ritual',
                date: entry.date || ''
            };
            const key = echoHistoryMergeKey(normalized);
            if (!map.has(key)) {
                map.set(key, normalized);
            }
        }
    }
    return Array.from(map.values()).slice(0, 30);
};

const mergeXPStates = (states: Array<XPState | null | undefined>): XPState | null => {
    const normalizedStates = states
        .filter((state): state is XPState => Boolean(state))
        .map((state) => normalizeXPState(state));

    if (normalizedStates.length === 0) return null;

    // Priority: local source last in input should win for textual fields.
    const priority = [...normalizedStates].reverse();
    const merged = buildInitialXPState();

    const latestLoginDate = maxDateKey(normalizedStates.map((state) => state.lastLoginDate));
    const latestStreakDate = maxDateKey(normalizedStates.map((state) => state.lastStreakDate));
    const latestDwellDate = maxDateKey(normalizedStates.map((state) => state.lastDwellDate));
    const latestShareRewardDate = maxDateKey(normalizedStates.map((state) => state.lastShareRewardDate));
    const latestInviteClaimedAt = maxDateKey(normalizedStates.map((state) => state.inviteClaimedAt));

    const mergedRituals = mergeRitualLogs(...priority.map((state) => state.dailyRituals || []));
    const mergedMarks = mergeStringLists(...priority.map((state) => state.marks || []));
    const mergedFeaturedMarks = mergeStringLists(...priority.map((state) => state.featuredMarks || []))
        .filter((markId) => mergedMarks.includes(markId))
        .slice(0, 3);

    const dwellCandidates = normalizedStates.filter((state) => state.lastDwellDate === latestDwellDate);
    const streakCandidates = normalizedStates.filter((state) => state.lastStreakDate === latestStreakDate);

    merged.totalXP = Math.max(...normalizedStates.map((state) => state.totalXP || 0));
    merged.lastLoginDate = latestLoginDate;
    merged.dailyDwellXP = dwellCandidates.length
        ? Math.max(...dwellCandidates.map((state) => state.dailyDwellXP || 0))
        : Math.max(...normalizedStates.map((state) => state.dailyDwellXP || 0));
    merged.lastDwellDate = latestDwellDate;
    merged.dailyRituals = mergedRituals;
    merged.marks = mergedMarks;
    merged.featuredMarks = mergedFeaturedMarks;
    merged.activeDays = mergeStringLists(...priority.map((state) => state.activeDays || [])).sort((a, b) =>
        a.localeCompare(b)
    );
    merged.uniqueGenres = mergeStringLists(...priority.map((state) => state.uniqueGenres || []));
    merged.streak = streakCandidates.length
        ? Math.max(...streakCandidates.map((state) => state.streak || 0))
        : Math.max(...normalizedStates.map((state) => state.streak || 0));
    merged.lastStreakDate = latestStreakDate;
    merged.echoesReceived = Math.max(...normalizedStates.map((state) => state.echoesReceived || 0));
    merged.echoesGiven = Math.max(...normalizedStates.map((state) => state.echoesGiven || 0));
    merged.echoHistory = mergeEchoHistory(...priority.map((state) => state.echoHistory || []));
    merged.followers = Math.max(...normalizedStates.map((state) => state.followers || 0));
    merged.following = mergeStringLists(...priority.map((state) => state.following || []));
    merged.nonConsecutiveCount = Math.max(...normalizedStates.map((state) => state.nonConsecutiveCount || 0));
    merged.lastShareRewardDate = latestShareRewardDate;
    merged.inviteClaimsCount = Math.max(...normalizedStates.map((state) => state.inviteClaimsCount || 0));
    merged.inviteRewardsEarned = Math.max(...normalizedStates.map((state) => state.inviteRewardsEarned || 0));
    merged.inviteClaimedAt = latestInviteClaimedAt;
    merged.referralAcceptedKeys = mergeStringLists(
        ...priority.map((state) => state.referralAcceptedKeys || [])
    ).slice(-MAX_REFERRAL_ACCEPTED_KEYS);

    const pickPreferredText = (selector: (state: XPState) => string): string => {
        for (const state of priority) {
            const value = selector(state).trim();
            if (value) return value;
        }
        return '';
    };

    merged.fullName = pickPreferredText((state) => state.fullName);
    merged.username = pickPreferredText((state) => state.username);
    const mergedGender = pickPreferredText((state) => state.gender);
    merged.gender = REGISTRATION_GENDERS.includes(mergedGender as RegistrationGender)
        ? (mergedGender as RegistrationGender)
        : '';
    merged.birthDate = pickPreferredText((state) => state.birthDate);
    merged.bio = pickPreferredText((state) => state.bio) || merged.bio;
    merged.avatarId = pickPreferredText((state) => state.avatarId) || merged.avatarId;
    const inviteCodeCandidate = pickPreferredText((state) => state.inviteCode);
    merged.inviteCode = isValidInviteCode(inviteCodeCandidate) ? normalizeInviteCode(inviteCodeCandidate) : '';
    const invitedByCodeCandidate = pickPreferredText((state) => state.invitedByCode || '');
    merged.invitedByCode = isValidInviteCode(invitedByCodeCandidate)
        ? normalizeInviteCode(invitedByCodeCandidate)
        : null;
    merged.avatarUrl = priority.find((state) => typeof state.avatarUrl === 'string' && state.avatarUrl.trim())
        ?.avatarUrl;

    return normalizeXPState(merged);
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
    const sessionUserRef = useRef<SessionUser | null>(getLegacyStoredUser());

    const [state, setState] = useState<XPState>(buildInitialXPState());
    const [whisper, setWhisper] = useState<string | null>(null);
    const [levelUpEvent, setLevelUpEvent] = useState<LeagueInfo | null>(null);
    const [levelUpQueue, setLevelUpQueue] = useState<LeagueInfo[]>([]);
    const [streakCelebrationEvent, setStreakCelebrationEvent] = useState<StreakCelebrationEvent | null>(null);
    const [sharePromptEvent, setSharePromptEvent] = useState<SharePromptEvent | null>(null);
    const previousLeagueIndexRef = useRef(getLeagueIndexFromXp(state.totalXP));
    const pendingWelcomeWhisperRef = useRef(false);
    const pendingRegistrationProfileRef = useRef<PendingRegistrationProfile | null>(null);
    const pendingInviteAttemptRef = useRef<string>('');
    const canReadProfileStateRef = useRef(true);
    const canWriteProfileStateRef = useRef(true);
    const canWriteRitualRef = useRef(true);
    const canReadFollowRef = useRef(true);
    const canWriteFollowRef = useRef(true);
    const [isXpHydrated, setIsXpHydrated] = useState(false);
    const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(() => isPasswordRecoveryUrl());
    const authMode: 'supabase' | 'local' = isSupabaseLive() && supabase ? 'supabase' : 'local';

    const setSessionUser = (nextUser: SessionUser | null) => {
        setUser(nextUser);
        sessionUserRef.current = nextUser;
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
            const sessionUser = data.session?.user ?? null;
            if (!sessionUser && sessionUserRef.current) {
                return;
            }
            applyAuthUser(sessionUser);
        });

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecoveryMode(true);
            }
            if (event === 'SIGNED_OUT') {
                setIsPasswordRecoveryMode(false);
                applyAuthUser(null);
                return;
            }

            const sessionUser = session?.user ?? null;
            if (!sessionUser && sessionUserRef.current) {
                return;
            }
            applyAuthUser(sessionUser);
        });

        return () => {
            active = false;
            data.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const inviteCode = normalizeInviteCode(params.get('invite') || params.get('ref'));
        if (!isValidInviteCode(inviteCode)) return;

        persistPendingInviteCode(inviteCode);
        const clickedSessionKey = `180_invite_clicked_${inviteCode}`;
        if (window.sessionStorage.getItem(clickedSessionKey) !== '1') {
            window.sessionStorage.setItem(clickedSessionKey, '1');
            trackEvent('invite_clicked', {
                inviteCode,
                source: 'url_query'
            });
        }
    }, []);

    // Load data when user changes
    useEffect(() => {
        setIsXpHydrated(false);
        setLevelUpEvent(null);
        setLevelUpQueue([]);
        setStreakCelebrationEvent(null);
        setSharePromptEvent(null);
        canReadProfileStateRef.current = true;
        canWriteProfileStateRef.current = true;
        canWriteRitualRef.current = true;
        canReadFollowRef.current = true;
        canWriteFollowRef.current = true;
        pendingInviteAttemptRef.current = '';

        if (!user) {
            setState(buildInitialXPState("Orbiting nearby..."));
            setIsXpHydrated(true);
            previousLeagueIndexRef.current = getLeagueIndexFromXp(0);
            return;
        }

        setState(buildInitialXPState());
        let active = true;

        const hydrateState = async () => {
            let remoteState: XPState | null = null;
            let localState: XPState | null = null;
            let cloudRituals: RitualLog[] = [];
            let localRitualBackup: RitualLog[] = [];
            let cloudFollowingKeys: string[] = [];

            if (isSupabaseLive() && supabase && user.id && canReadProfileStateRef.current) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('xp_state')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!error && data?.xp_state && typeof data.xp_state === 'object') {
                    remoteState = normalizeXPState(data.xp_state as Partial<XPState>);
                } else if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canReadProfileStateRef.current = false;
                    } else {
                        console.error('[XP] failed to read profile state', error);
                    }
                }

                cloudRituals = await readUserRitualsFromCloud(user.id);

                if (canReadFollowRef.current) {
                    const { data: followData, error: followError } = await supabase
                        .from('user_follows')
                        .select('followed_user_id')
                        .eq('follower_user_id', user.id)
                        .limit(1000);

                    if (!followError) {
                        const rows = Array.isArray(followData) ? (followData as UserFollowRow[]) : [];
                        cloudFollowingKeys = rows
                            .map((row) => buildFollowUserIdKey(row.followed_user_id))
                            .filter((value): value is string => Boolean(value));
                    } else if (isSupabaseCapabilityError(followError)) {
                        canReadFollowRef.current = false;
                    } else {
                        console.error('[XP] failed to read follow graph', followError);
                    }
                }
            }

            localState = readUserXpStateFromLocal(user.email);
            localRitualBackup = readUserRitualBackupFromLocal(user.email);

            let resolvedState = mergeXPStates([remoteState, localState]);
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

            const mergedRituals = mergeRitualLogs(
                resolvedState.dailyRituals || [],
                localRitualBackup,
                cloudRituals
            );
            const ritualGenres = mergedRituals
                .map((ritual) => (ritual.genre || '').trim())
                .filter((genre): genre is string => Boolean(genre));
            resolvedState = {
                ...resolvedState,
                dailyRituals: mergedRituals,
                activeDays: mergeStringLists(resolvedState.activeDays || [], mergedRituals.map((ritual) => ritual.date))
                    .sort((a, b) => a.localeCompare(b)),
                uniqueGenres: mergeStringLists(resolvedState.uniqueGenres || [], ritualGenres),
                following: mergeStringLists(resolvedState.following || [], cloudFollowingKeys)
            };

            const previousInviteCode = normalizeInviteCode(resolvedState.inviteCode);
            let ensuredInviteCode = previousInviteCode;
            let ensuredClaimCount = resolvedState.inviteClaimsCount || 0;
            let inviteCodeCreated = false;

            if (isSupabaseLive() && supabase && user.id) {
                const ensureResult = await ensureInviteCodeViaApi(
                    previousInviteCode || user.username || user.fullName || user.email
                );
                if (ensureResult.ok && ensureResult.data) {
                    ensuredInviteCode = normalizeInviteCode(ensureResult.data.code);
                    ensuredClaimCount = Math.max(
                        ensuredClaimCount,
                        Number(ensureResult.data.claimCount || 0)
                    );
                    inviteCodeCreated = Boolean(ensureResult.data.created);
                }
            }

            if (!isValidInviteCode(ensuredInviteCode)) {
                ensuredInviteCode = ensureInviteCodeForOwner(
                    previousInviteCode,
                    user.email,
                    user.id
                );
                inviteCodeCreated = ensuredInviteCode !== previousInviteCode;
            }

            resolvedState = {
                ...resolvedState,
                inviteCode: ensuredInviteCode,
                inviteClaimsCount: ensuredClaimCount,
                inviteRewardsEarned: Math.max(
                    resolvedState.inviteRewardsEarned || 0,
                    ensuredClaimCount * INVITER_REWARD_XP
                )
            };
            if (inviteCodeCreated && ensuredInviteCode) {
                trackEvent('invite_created', {
                    inviteCode: ensuredInviteCode,
                    source: 'auto_generate'
                }, {
                    userId: user.id || null
                });
            }

            if (!active) return;

            setState(resolvedState);
            previousLeagueIndexRef.current = getLeagueIndexFromXp(resolvedState.totalXP || 0);
            persistUserXpStateToLocal(user.email, resolvedState);
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
                persistUserXpStateToLocal(user.email, updated);
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

    const dismissSharePrompt = () => {
        setSharePromptEvent(null);
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
        const flow = isRegistering ? 'register' : 'login';

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
            trackEvent(isRegistering ? 'signup_success' : 'login_success', {
                flow,
                method: 'password',
                authMode: 'local'
            });
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

                if (error) {
                    const reason = normalizeAuthError(error.message);
                    trackEvent('auth_failure', { flow, method: 'password', reason });
                    return { ok: false, message: reason };
                }
                if (data.session?.user) {
                    const mapped = toSessionUser(data.session.user);
                    if (mapped) {
                        setSessionUser(mapped);
                    }
                    trackEvent('signup_success', {
                        flow,
                        method: 'password',
                        authMode: 'supabase'
                    }, {
                        userId: data.session.user.id
                    });
                    triggerWhisper("Account created.");
                    return { ok: true, message: 'Kayit tamamlandi. Oturum acildi.' };
                }

                setSessionUser(null);
                trackEvent('signup_pending_confirmation', {
                    flow,
                    method: 'password',
                    authMode: 'supabase'
                });
                return {
                    ok: true,
                    message: 'Kayit tamamlandi. E-posta onayi sonrasi giris yap.'
                };
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password
            });

            if (error) {
                const reason = normalizeAuthError(error.message);
                trackEvent('auth_failure', { flow, method: 'password', reason });
                return { ok: false, message: reason };
            }
            const mapped = toSessionUser(data.user ?? data.session?.user ?? null);
            if (mapped) {
                setSessionUser(mapped);
            }
            const resolvedUserId = data.user?.id || data.session?.user?.id || mapped?.id || null;
            trackEvent('login_success', {
                flow,
                method: 'password',
                authMode: 'supabase'
            }, {
                userId: resolvedUserId
            });
            triggerWhisper("Welcome to the Ritual.");
            return { ok: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed.';
            const reason = normalizeAuthError(message);
            trackEvent('auth_failure', { flow, method: 'password', reason });
            return { ok: false, message: reason };
        }
    };

    const loginWithGoogle = async (): Promise<AuthResult> => {
        if (!isSupabaseLive() || !supabase) {
            trackEvent('oauth_failure', {
                provider: 'google',
                reason: 'supabase_not_available'
            });
            return { ok: false, message: 'Google login icin Supabase gerekli.' };
        }

        try {
            const redirectTo = buildAuthRedirectTo();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo }
            });

            if (error) {
                const reason = normalizeAuthError(error.message);
                trackEvent('oauth_failure', { provider: 'google', reason });
                return { ok: false, message: reason };
            }
            trackEvent('oauth_redirect_started', {
                provider: 'google',
                authMode: 'supabase'
            });
            return { ok: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Google login failed.';
            const reason = normalizeAuthError(message);
            trackEvent('oauth_failure', { provider: 'google', reason });
            return { ok: false, message: reason };
        }
    };

    const requestPasswordReset = async (email: string): Promise<AuthResult> => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            trackEvent('auth_failure', {
                flow: 'forgot_password',
                method: 'email',
                reason: 'email_required'
            });
            return { ok: false, message: 'E-posta gerekli.' };
        }

        if (!isSupabaseLive() || !supabase) {
            trackEvent('auth_failure', {
                flow: 'forgot_password',
                method: 'email',
                reason: 'supabase_not_available'
            });
            return { ok: false, message: 'Sifre sifirlama icin Supabase gerekli.' };
        }

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: buildAuthRedirectTo()
            });
            if (error) {
                const reason = normalizeAuthError(error.message);
                trackEvent('auth_failure', {
                    flow: 'forgot_password',
                    method: 'email',
                    reason
                });
                return { ok: false, message: reason };
            }
            trackEvent('password_reset_requested', { method: 'email' });
            return { ok: true, message: 'Sifre yenileme baglantisi e-posta adresine gonderildi.' };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Password reset failed.';
            const reason = normalizeAuthError(message);
            trackEvent('auth_failure', {
                flow: 'forgot_password',
                method: 'email',
                reason
            });
            return { ok: false, message: reason };
        }
    };

    const completePasswordReset = async (newPassword: string): Promise<AuthResult> => {
        const normalizedPassword = newPassword.trim();
        if (normalizedPassword.length < 6) {
            trackEvent('auth_failure', {
                flow: 'reset_password',
                method: 'password',
                reason: 'password_too_short'
            });
            return { ok: false, message: 'Sifre en az 6 karakter olmali.' };
        }

        if (!isSupabaseLive() || !supabase) {
            trackEvent('auth_failure', {
                flow: 'reset_password',
                method: 'password',
                reason: 'supabase_not_available'
            });
            return { ok: false, message: 'Sifre guncelleme icin Supabase gerekli.' };
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: normalizedPassword });
            if (error) {
                const reason = normalizeAuthError(error.message);
                trackEvent('auth_failure', {
                    flow: 'reset_password',
                    method: 'password',
                    reason
                });
                return { ok: false, message: reason };
            }

            setIsPasswordRecoveryMode(false);
            clearRecoveryUrlState();
            trackEvent('password_reset_completed', { method: 'password' }, { userId: user?.id || null });
            triggerWhisper("Password updated.");
            return { ok: true, message: 'Sifre guncellendi.' };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Password update failed.';
            const reason = normalizeAuthError(message);
            trackEvent('auth_failure', {
                flow: 'reset_password',
                method: 'password',
                reason
            });
            return { ok: false, message: reason };
        }
    };

    const logout = async () => {
        if (isSupabaseLive() && supabase) {
            await supabase.auth.signOut();
        }
        setSessionUser(null);
        setIsPasswordRecoveryMode(false);
        setSharePromptEvent(null);
        setState(buildInitialXPState("Orbiting nearby..."));
    };

    const updateAvatar = (url: string) => {
        updateState({ avatarUrl: url });
        triggerWhisper("Visage captured.");
    };

    const isFollowingUser = (targetUserId?: string | null, username?: string): boolean => {
        const following = state.following || [];
        if (following.length === 0) return false;

        const userIdKey = buildFollowUserIdKey(targetUserId);
        const normalizedUsername = normalizeFollowKey(username);

        return following.some((entry) => {
            const normalizedEntry = normalizeFollowKey(entry);
            if (!normalizedEntry) return false;
            if (userIdKey && normalizedEntry === userIdKey) return true;
            if (!normalizedUsername) return false;
            return normalizedEntry === normalizedUsername;
        });
    };

    // Shadow Follow Logic
    const toggleFollowUser = async (target: { userId?: string | null; username: string }): Promise<AuthResult> => {
        const normalizedUsername = (target.username || '').trim();
        if (!normalizedUsername) {
            return { ok: false, message: 'Takip edilecek kullanici adi gecersiz.' };
        }

        const normalizedCurrentName = (user?.name || '').trim().toLowerCase();
        const normalizedTargetName = normalizedUsername.toLowerCase();
        if (target.userId && user?.id && target.userId === user.id) {
            return { ok: false, message: 'Kendini takip edemezsin.' };
        }
        if (!target.userId && normalizedCurrentName && normalizedCurrentName === normalizedTargetName) {
            return { ok: false, message: 'Kendini takip edemezsin.' };
        }

        const userIdKey = buildFollowUserIdKey(target.userId);
        let didFollow = false;

        setState((prev) => {
            const prevFollowing = [...(prev.following || [])];
            const nextMarks = [...(prev.marks || [])];
            const wasFollowing = prevFollowing.some((entry) => {
                const normalizedEntry = normalizeFollowKey(entry);
                if (!normalizedEntry) return false;
                if (userIdKey && normalizedEntry === userIdKey) return true;
                return normalizedEntry === normalizedTargetName;
            });

            if (wasFollowing) {
                didFollow = false;
                const updatedFollowing = prevFollowing.filter((entry) => {
                    const normalizedEntry = normalizeFollowKey(entry);
                    if (userIdKey && normalizedEntry === userIdKey) return false;
                    return normalizedEntry !== normalizedTargetName;
                });
                if (user) {
                    persistUserXpStateToLocal(user.email, { ...prev, following: updatedFollowing, marks: nextMarks });
                }
                return {
                    ...prev,
                    following: updatedFollowing,
                    marks: nextMarks
                };
            }

            didFollow = true;
            const followEntry = userIdKey || normalizedUsername;
            const updatedFollowing = [...prevFollowing, followEntry];
            const dedupedFollowing = Array.from(new Set(updatedFollowing.map((entry) => entry.trim()).filter(Boolean)));
            let unlockedMarks = nextMarks;
            if (dedupedFollowing.length >= 5) {
                unlockedMarks = tryUnlockMark('quiet_following', unlockedMarks);
            }
            if (user) {
                persistUserXpStateToLocal(user.email, { ...prev, following: dedupedFollowing, marks: unlockedMarks });
            }
            return {
                ...prev,
                following: dedupedFollowing,
                marks: unlockedMarks
            };
        });

        let syncWarning: string | null = null;
        if (isSupabaseLive() && supabase && user?.id && target.userId && canWriteFollowRef.current) {
            if (didFollow) {
                const { error } = await supabase
                    .from('user_follows')
                    .upsert(
                        [
                            {
                                follower_user_id: user.id,
                                followed_user_id: target.userId
                            }
                        ],
                        { onConflict: 'follower_user_id,followed_user_id', ignoreDuplicates: true }
                    );

                if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canWriteFollowRef.current = false;
                    } else {
                        console.error('[XP] failed to sync follow insert', error);
                        syncWarning = 'Takip kaydedildi, cloud senkronu basarisiz.';
                    }
                }
            } else {
                const { error } = await supabase
                    .from('user_follows')
                    .delete()
                    .eq('follower_user_id', user.id)
                    .eq('followed_user_id', target.userId);

                if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canWriteFollowRef.current = false;
                    } else {
                        console.error('[XP] failed to sync follow delete', error);
                        syncWarning = 'Takipten cikarma kaydedildi, cloud senkronu basarisiz.';
                    }
                }
            }
        }

        if (didFollow) {
            triggerWhisper(`Shadowing ${normalizedUsername}.`);
            return { ok: true, message: syncWarning || `${normalizedUsername} takip edildi.` };
        }

        triggerWhisper(`Unfollowed ${normalizedUsername}.`);
        return { ok: true, message: syncWarning || `${normalizedUsername} takipten cikarildi.` };
    };

    const awardShareXP = (platform: 'instagram' | 'tiktok' | 'x', trigger: ShareRewardTrigger): AuthResult => {
        const today = getToday();

        if (trigger === 'comment') {
            const hasCommentToday = state.dailyRituals.some((ritual) => ritual.date === today);
            if (!hasCommentToday) {
                trackEvent('share_reward_denied', {
                    platform,
                    trigger,
                    reason: 'comment_not_ready'
                }, {
                    userId: user?.id || null
                });
                return { ok: false, message: 'Yorum paylasim bonusu icin once bugun yorum yaz.' };
            }
        }

        if (trigger === 'streak') {
            const isStreakCompletedToday = state.streak > 0 && state.lastStreakDate === today;
            if (!isStreakCompletedToday) {
                trackEvent('share_reward_denied', {
                    platform,
                    trigger,
                    reason: 'streak_not_ready'
                }, {
                    userId: user?.id || null
                });
                return { ok: false, message: 'Streak paylasim bonusu icin once bugunku rituelini tamamla.' };
            }
        }

        if (state.lastShareRewardDate === today) {
            trackEvent('share_reward_denied', {
                platform,
                trigger,
                reason: 'already_claimed_today'
            }, {
                userId: user?.id || null
            });
            return { ok: false, message: 'Bugun paylasim bonusu zaten alindi.' };
        }

        const nextXP = state.totalXP + SHARE_REWARD_XP;
        updateState({
            totalXP: nextXP,
            lastShareRewardDate: today
        });
        trackEvent('share_reward_claimed', {
            platform,
            trigger,
            rewardXp: SHARE_REWARD_XP,
            resultingXp: nextXP
        }, {
            userId: user?.id || null
        });
        triggerWhisper(`Paylasim bonusi +${SHARE_REWARD_XP} XP`);

        const platformLabel = platform === 'x' ? 'X' : platform === 'tiktok' ? 'TikTok' : 'Instagram';
        const triggerLabel = trigger === 'streak' ? 'streak paylasimi' : 'yorum paylasimi';
        return {
            ok: true,
            message: `${platformLabel} ${triggerLabel} kaydedildi. +${SHARE_REWARD_XP} XP`
        };
    };

    const inviteLink = buildInviteLink(state.inviteCode);

    const claimInviteCode = async (rawCode: string): Promise<AuthResult> => {
        if (!user) {
            return { ok: false, message: 'Davet kodu kullanmak icin giris yap.' };
        }

        const inviteCode = normalizeInviteCode(rawCode);
        const today = getToday();
        const currentEmail = (user.email || '').trim().toLowerCase();

        if (!isValidInviteCode(inviteCode)) {
            trackEvent('invite_claim_failed', { reason: 'invalid_code_format', inviteCode });
            return { ok: false, message: 'Davet kodu gecersiz.' };
        }

        if (state.invitedByCode) {
            trackEvent('invite_claim_failed', {
                reason: 'already_claimed_on_account',
                inviteCode,
                invitedByCode: state.invitedByCode
            }, {
                userId: user.id || null
            });
            return { ok: false, message: 'Bu hesap zaten bir davet kodu kullandi.' };
        }

        if (inviteCode === state.inviteCode) {
            trackEvent('invite_claim_failed', { reason: 'self_invite_blocked', inviteCode }, { userId: user.id || null });
            return { ok: false, message: 'Kendi davet kodunu kullanamazsin.' };
        }

        if (isSupabaseLive() && supabase && user.id) {
            const deviceKey = getReferralDeviceKey();
            const apiResult = await claimInviteCodeViaApi(inviteCode, deviceKey);

            if (apiResult.ok && apiResult.data) {
                const inviteeRewardXp = Math.max(0, Number(apiResult.data.inviteeRewardXp || INVITEE_REWARD_XP));
                const inviterRewardXp = Math.max(0, Number(apiResult.data.inviterRewardXp || 0));
                const inviteeRewardedXp = state.totalXP + inviteeRewardXp;
                const inviterRewardGranted = inviterRewardXp > 0;

                updateState({
                    totalXP: inviteeRewardedXp,
                    invitedByCode: inviteCode,
                    inviteClaimedAt: today
                });
                clearPendingInviteCode();

                trackEvent('invite_accepted', {
                    inviteCode,
                    inviteeRewardXp,
                    inviterRewardGranted,
                    inviterRewardXp
                }, {
                    userId: user.id || null
                });

                trackEvent('invite_reward_granted', {
                    role: 'invitee',
                    inviteCode,
                    rewardXp: inviteeRewardXp
                }, {
                    userId: user.id || null
                });

                if (inviterRewardGranted) {
                    trackEvent('invite_reward_granted', {
                        role: 'inviter',
                        inviteCode,
                        rewardXp: inviterRewardXp,
                        inviterUserId: apiResult.data.inviterUserId || null
                    });
                }

                triggerWhisper(`Davet odulu +${inviteeRewardXp} XP`);
                return {
                    ok: true,
                    message: `Davet kodu uygulandi. +${inviteeRewardXp} XP kazandin.`
                };
            }

            if (apiResult.errorCode && apiResult.errorCode !== 'SERVER_ERROR') {
                const apiFailureReasonByCode: Record<string, string> = {
                    UNAUTHORIZED: 'api_unauthorized',
                    INVALID_CODE: 'invalid_code_format',
                    INVITE_NOT_FOUND: 'code_not_found',
                    SELF_INVITE: 'self_invite_blocked',
                    ALREADY_CLAIMED: 'already_claimed_on_account',
                    DEVICE_DAILY_LIMIT: 'device_daily_limit_reached',
                    DEVICE_CODE_REUSE: 'code_already_used_on_device'
                };
                const apiMessageByCode: Record<string, string> = {
                    UNAUTHORIZED: 'Oturum dogrulanamadi. Yeniden giris yap ve tekrar dene.',
                    INVALID_CODE: 'Davet kodu gecersiz.',
                    INVITE_NOT_FOUND: 'Davet kodu bulunamadi.',
                    SELF_INVITE: 'Kendi davet kodunu kullanamazsin.',
                    ALREADY_CLAIMED: 'Bu hesap zaten bir davet kodu kullandi.',
                    DEVICE_DAILY_LIMIT: 'Gunluk davet limiti doldu. Yarim gun sonra tekrar dene.',
                    DEVICE_CODE_REUSE: 'Bu cihazda bu davet kodu zaten kullanildi.'
                };
                const failureReason = apiFailureReasonByCode[apiResult.errorCode] || 'api_claim_rejected';
                trackEvent('invite_claim_failed', {
                    reason: failureReason,
                    inviteCode,
                    errorCode: apiResult.errorCode,
                    apiMessage: apiResult.message || null
                }, {
                    userId: user.id || null
                });
                return {
                    ok: false,
                    message: apiMessageByCode[apiResult.errorCode] || (apiResult.message || 'Davet kodu uygulanamadi.')
                };
            }

            trackEvent('invite_claim_failed', {
                reason: 'api_unavailable',
                inviteCode,
                errorCode: apiResult.errorCode || 'SERVER_ERROR',
                apiMessage: apiResult.message || null
            }, {
                userId: user.id || null
            });
        }

        const guard = readInviteDeviceGuard();
        const normalizedGuard: InviteDeviceGuard = guard.date === today
            ? guard
            : { date: today, count: 0, claimedCodes: [] };

        if (normalizedGuard.claimedCodes.includes(inviteCode)) {
            trackEvent('invite_claim_failed', {
                reason: 'code_already_used_on_device',
                inviteCode
            }, {
                userId: user.id || null
            });
            return { ok: false, message: 'Bu cihazda bu davet kodu zaten kullanildi.' };
        }

        if (normalizedGuard.count >= MAX_DAILY_DEVICE_INVITE_CLAIMS) {
            trackEvent('invite_claim_failed', {
                reason: 'device_daily_limit_reached',
                inviteCode,
                dailyLimit: MAX_DAILY_DEVICE_INVITE_CLAIMS
            }, {
                userId: user.id || null
            });
            return { ok: false, message: 'Gunluk davet limiti doldu. Yarim gun sonra tekrar dene.' };
        }

        const registry = readInviteRegistry();
        const registryEntry = registry[inviteCode];
        if (!registryEntry || !registryEntry.ownerEmail) {
            trackEvent('invite_claim_failed', { reason: 'code_not_found', inviteCode }, { userId: user.id || null });
            return { ok: false, message: 'Davet kodu bulunamadi.' };
        }

        const inviterEmail = registryEntry.ownerEmail.trim().toLowerCase();
        if (inviterEmail === currentEmail) {
            trackEvent('invite_claim_failed', { reason: 'self_invite_blocked', inviteCode }, { userId: user.id || null });
            return { ok: false, message: 'Kendi davet kodunu kullanamazsin.' };
        }

        const inviteeRewardedXp = state.totalXP + INVITEE_REWARD_XP;
        const claimantKey = user.id ? `id:${user.id}` : `email:${currentEmail}`;

        let inviterRewardGranted = false;
        const inviterState = readUserXpStateFromLocal(inviterEmail);
        if (inviterState) {
            const acceptedKeys = Array.isArray(inviterState.referralAcceptedKeys)
                ? inviterState.referralAcceptedKeys
                : [];
            if (!acceptedKeys.includes(claimantKey)) {
                const inviterUpdatedState = normalizeXPState({
                    ...inviterState,
                    totalXP: inviterState.totalXP + INVITER_REWARD_XP,
                    inviteClaimsCount: (inviterState.inviteClaimsCount || 0) + 1,
                    inviteRewardsEarned: (inviterState.inviteRewardsEarned || 0) + INVITER_REWARD_XP,
                    referralAcceptedKeys: [...acceptedKeys, claimantKey].slice(-MAX_REFERRAL_ACCEPTED_KEYS)
                });
                persistUserXpStateToLocal(inviterEmail, inviterUpdatedState);
                inviterRewardGranted = true;
            }
        }

        registry[inviteCode] = {
            ...registryEntry,
            claimCount: (registryEntry.claimCount || 0) + 1,
            lastClaimAt: new Date().toISOString()
        };
        writeInviteRegistry(registry);

        writeInviteDeviceGuard({
            date: today,
            count: normalizedGuard.count + 1,
            claimedCodes: [...normalizedGuard.claimedCodes, inviteCode].slice(-20)
        });

        updateState({
            totalXP: inviteeRewardedXp,
            invitedByCode: inviteCode,
            inviteClaimedAt: today
        });
        clearPendingInviteCode();

        trackEvent('invite_accepted', {
            inviteCode,
            inviteeRewardXp: INVITEE_REWARD_XP,
            inviterRewardGranted,
            inviterRewardXp: inviterRewardGranted ? INVITER_REWARD_XP : 0
        }, {
            userId: user.id || null
        });

        trackEvent('invite_reward_granted', {
            role: 'invitee',
            inviteCode,
            rewardXp: INVITEE_REWARD_XP
        }, {
            userId: user.id || null
        });

        if (inviterRewardGranted) {
            trackEvent('invite_reward_granted', {
                role: 'inviter',
                inviteCode,
                rewardXp: INVITER_REWARD_XP
            });
        }

        triggerWhisper(`Davet odulu +${INVITEE_REWARD_XP} XP`);
        return {
            ok: true,
            message: inviterRewardGranted
                ? `Davet kodu uygulandi. +${INVITEE_REWARD_XP} XP kazandin.`
                : `Davet kodu uygulandi. +${INVITEE_REWARD_XP} XP kazandin.`
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

            persistUserXpStateToLocal(user.email, updated);
            return updated;
        });
    }, [isXpHydrated, user?.email]);

    useEffect(() => {
        if (!pendingWelcomeWhisperRef.current) return;
        pendingWelcomeWhisperRef.current = false;
        triggerWhisper("Welcome back.");
    }, [state.lastLoginDate]);

    useEffect(() => {
        if (!user || !isXpHydrated) return;
        if (state.invitedByCode) return;

        const pendingCode = readPendingInviteCode();
        if (!pendingCode) return;

        const attemptKey = `${user.email}|${pendingCode}`;
        if (pendingInviteAttemptRef.current === attemptKey) return;
        pendingInviteAttemptRef.current = attemptKey;

        void claimInviteCode(pendingCode).then((claimResult) => {
            if (!claimResult.ok) {
                if (
                    claimResult.message?.includes('gecersiz') ||
                    claimResult.message?.includes('bulunamadi') ||
                    claimResult.message?.includes('zaten bir davet')
                ) {
                    clearPendingInviteCode();
                }
            }
        });
    }, [isXpHydrated, state.invitedByCode, user?.email, user?.id]);

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
            trackEvent('ritual_submit_failed', {
                reason: 'moderation_failed',
                movieId,
                message
            }, {
                userId: user?.id || null
            });
            triggerWhisper(message);
            return { ok: false, message };
        }

        const sanitizedText = text.trim();
        const today = getToday();
        if (state.dailyRituals.some(r => r.date === today && r.movieId === movieId)) {
            trackEvent('ritual_submit_failed', {
                reason: 'duplicate_for_movie_today',
                movieId
            }, {
                userId: user?.id || null
            });
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
        if (user?.email) {
            persistUserRitualBackupToLocal(user.email, allRituals);
        }
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

        const preferredGoal: ShareRewardTrigger =
            shouldIncreaseStreakToday && newStreak > 0 ? 'streak' : 'comment';
        setSharePromptEvent({
            id: `${today}-${movieId}-${Date.now()}`,
            preferredGoal,
            commentPreview: sanitizedText,
            streak: newStreak,
            date: today
        });
        trackEvent('ritual_submitted', {
            movieId,
            movieTitle: newRitual.movieTitle,
            genre,
            textLength: sanitizedText.length,
            earnedXp: earnedXP,
            resultingXp: newTotalXP,
            streak: newStreak,
            preferredShareGoal: preferredGoal
        }, {
            userId: user?.id || null
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

                const nowIso = new Date().toISOString();
                const ritualInsertPayloads: Array<Record<string, string | null>> = [
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        timestamp: nowIso,
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        timestamp: nowIso,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        timestamp: nowIso,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        timestamp: nowIso
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        created_at: nowIso,
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        created_at: nowIso,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        created_at: nowIso
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
                    } else if (lowered.includes('rate limit') || lowered.includes('too many')) {
                        triggerWhisper("Cok hizli gonderim algilandi. Biraz bekleyip tekrar dene.");
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
                persistUserXpStateToLocal(user.email, updated);
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
                persistUserXpStateToLocal(user.email, updated);
            }
            return updated;
        });
    };

    useEffect(() => {
        if (!user || !isXpHydrated) return;

        persistUserXpStateToLocal(user.email, state);

        const stateForCloud = compactStateForPersistence(state);

        if (!isSupabaseLive() || !supabase || !user.id || !canWriteProfileStateRef.current) return;

        void supabase
            .from('profiles')
            .upsert(
                {
                    user_id: user.id,
                    email: user.email,
                    display_name: state.username || state.fullName || user.name,
                    xp_state: stateForCloud,
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
            sharePromptEvent,
            dismissSharePrompt,
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
            isFollowingUser,
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
            inviteCode: state.inviteCode || '',
            inviteLink,
            invitedByCode: state.invitedByCode || null,
            inviteClaimsCount: state.inviteClaimsCount || 0,
            inviteRewardsEarned: state.inviteRewardsEarned || 0,
            inviteRewardConfig: {
                inviterXp: INVITER_REWARD_XP,
                inviteeXp: INVITEE_REWARD_XP
            },
            claimInviteCode,
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
