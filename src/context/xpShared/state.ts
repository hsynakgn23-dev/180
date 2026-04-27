import { TMDB_SEEDS } from '../../data/tmdbSeeds';
import { normalizeAvatarUrl } from '../../lib/avatarUpload';
import type { EchoLog, LeagueInfo, RegistrationGender, RitualLog, XPState } from './types';

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

export const LEAGUE_NAMES = Object.keys(LEAGUES_DATA);

export const MAX_DAILY_DWELL_XP = 20;
export const LEVEL_THRESHOLD = 500;
export const LONG_FORM_RITUAL_THRESHOLD = 160;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const REGISTRATION_GENDERS: RegistrationGender[] = ['female', 'male', 'non_binary', 'prefer_not_to_say'];
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
export const SHARE_REWARD_XP = 18;
export const STORAGE_RECOVERY_KEYS = ['DAILY_CANDIDATE_POOL_V2', 'DAILY_SELECTION_V18'] as const;
export const INVITER_REWARD_XP = 40;
export const INVITEE_REWARD_XP = 24;

export const getLeagueIndexFromXp = (xp: number): number =>
    Math.min(Math.floor(xp / LEVEL_THRESHOLD), LEAGUE_NAMES.length - 1);

export const applyXPDelta = (
    prev: XPState,
    amount: number,
    _source: string
): Partial<XPState> => ({
    totalXP: Math.floor(prev.totalXP + amount),
});

export const KNOWN_MOVIES_BY_ID = new Map(
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

export const KNOWN_MOVIE_ID_BY_TITLE = new Map(
    TMDB_SEEDS.map((movie) => [movie.title.trim().toLowerCase(), movie.id] as const)
);

export const getLocalDateKey = (value = new Date()): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const parseDateKeyToDayIndex = (dateKey: string): number | null => {
    const parts = dateKey.split('-').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
    const [year, month, day] = parts;
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.floor(parsed.getTime() / DAY_MS);
};

export const isSupabaseCapabilityError = (
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

export const normalizeRitualLog = (ritual: RitualLog): RitualLog => {
    const knownMovie = KNOWN_MOVIES_BY_ID.get(ritual.movieId);
    const invalidTitle = !ritual.movieTitle || ritual.movieTitle === 'Unknown Title';
    return {
        ...ritual,
        movieTitle: invalidTitle ? knownMovie?.title || ritual.movieTitle || `Film #${ritual.movieId}` : ritual.movieTitle,
        posterPath: ritual.posterPath || knownMovie?.posterPath
    };
};

export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateReferralCode = (): string => {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
        const bytes = new Uint8Array(8);
        cryptoApi.getRandomValues(bytes);
        return Array.from(bytes, (value) => REFERRAL_CODE_ALPHABET[value % REFERRAL_CODE_ALPHABET.length]).join('');
    }

    return Array.from({ length: 8 }, () => {
        const index = Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length);
        return REFERRAL_CODE_ALPHABET[index];
    }).join('');
};

export const buildInitialXPState = (bio = "A silent observer."): XPState => ({
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
    referralCode: generateReferralCode(),
    referralCount: 0,
    invitedBy: undefined
});

export const normalizeXPState = (input: Partial<XPState> | null | undefined): XPState => {
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
        avatarUrl: normalizeAvatarUrl(input.avatarUrl),
        lastShareRewardDate: input.lastShareRewardDate || null,
        referralCode: input.referralCode || fallback.referralCode,
        referralCount: input.referralCount || 0,
        invitedBy: input.invitedBy
    };
};

export const normalizeFollowKey = (value: string | null | undefined): string =>
    (value || '').trim().toLowerCase();

export const buildFollowUserIdKey = (userId: string | null | undefined): string | null => {
    const normalized = normalizeFollowKey(userId);
    if (!normalized) return null;
    return `id:${normalized}`;
};

export const buildInviteLink = (inviteCode: string): string => {
    const normalized = String(inviteCode || '').trim().toUpperCase();
    const baseOrigin =
        typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'https://180absolutecinema.com';
    const url = new URL('/', baseOrigin);

    if (!normalized) {
        return url.toString();
    }

    url.searchParams.set('invite', normalized);
    url.searchParams.set('utm_source', 'invite');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', 'user_invite');
    return url.toString();
};

export const fallbackMovieIdFromTitle = (title: string): number => {
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

export const normalizeRitualDateKey = (input: string | null | undefined): string => {
    const raw = (input || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
    return getLocalDateKey();
};

export const maxDateKey = (values: Array<string | null | undefined>): string | null => {
    const valid = values.filter((value): value is string => Boolean(value && value.trim()));
    if (valid.length === 0) return null;
    return valid.reduce((latest, current) => (current > latest ? current : latest), valid[0]);
};

export const mergeStringLists = (...lists: string[][]): string[] => {
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

export const ritualFingerprint = (ritual: RitualLog): string => {
    const date = normalizeRitualDateKey(ritual.date);
    const movieTitle = (ritual.movieTitle || '').trim().toLowerCase();
    const text = (ritual.text || '').trim().toLowerCase();
    const movieIdentity = movieTitle || String(ritual.movieId || 0);
    return `${date}|${movieIdentity}|${text}`;
};

export const mergeRitualLogs = (...lists: RitualLog[][]): RitualLog[] => {
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

export const mergeEchoHistory = (...lists: EchoLog[][]): EchoLog[] => {
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

export const mergeXPStates = (states: Array<XPState | null | undefined>): XPState | null => {
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
    const stableReferralCode = priority.find(s => s.referralCode)?.referralCode || merged.referralCode;

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
    merged.referralCode = stableReferralCode;
    merged.referralCount = Math.max(...normalizedStates.map((state) => state.referralCount || 0));
    merged.invitedBy = priority.find(s => s.invitedBy)?.invitedBy;

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
    merged.avatarUrl = normalizeAvatarUrl(
        priority.find((state) => typeof state.avatarUrl === 'string' && state.avatarUrl.trim())
            ?.avatarUrl
    ) || undefined;

    return normalizeXPState(merged);
};
