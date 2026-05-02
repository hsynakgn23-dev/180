import {
    buildFollowUserIdKey,
    fallbackMovieIdFromTitle,
    isSupabaseCapabilityError,
    mergeRitualLogs,
    normalizeRitualDateKey,
    normalizeRitualLog,
    normalizeXPState,
} from '../../context/xpShared/state.js';
import type { RitualLog, XPState } from '../../context/xpShared/types.js';
import { isSupabaseLive, supabase } from '../supabase.js';

type UserFollowRow = {
    followed_user_id: string | null;
};

type RitualBackupRow = {
    id: string | null;
    movie_title: string | null;
    poster_path?: string | null;
    text: string | null;
    timestamp?: string | null;
};

type SupabaseDomainError = {
    code?: string | null;
    message?: string | null;
};

type LoadUserProgressionOptions = {
    canReadProfileState?: boolean;
    canReadFollow?: boolean;
};

export type CloudRitualReadResult = {
    rituals: RitualLog[];
    didRead: boolean;
};

export type UserProgressionHydration = {
    remoteState: XPState | null;
    cloudRituals: RitualLog[];
    didReadCloudRituals: boolean;
    cloudFollowingKeys: string[];
    didReadCloudFollowing: boolean;
    canReadProfileState: boolean;
    canReadFollow: boolean;
};

export type SupabaseMutationResult = {
    ok: boolean;
    capabilityBlocked: boolean;
    missingSession: boolean;
    error: SupabaseDomainError | null;
};

export type MutateXPInput = {
    userId: string;
    email: string;
    displayName: string;
    xpState: XPState;
    updatedAt?: string;
};

export type MutateRitualInput = {
    author: string;
    movieTitle: string;
    posterPath?: string | null;
    text: string;
    league?: string | null;
    year?: string | null;
};

export type MutateFollowInput = {
    followerUserId: string;
    followedUserId: string;
    shouldFollow: boolean;
};

const RITUAL_READ_VARIANTS = [
    {
        select: 'id, movie_title, poster_path, text, timestamp',
        orderBy: 'timestamp',
    },
    {
        select: 'id, movie_title, poster_path, text, timestamp:created_at',
        orderBy: 'created_at',
    },
    {
        select: 'id, movie_title, text, timestamp',
        orderBy: 'timestamp',
    },
    {
        select: 'id, movie_title, text, timestamp:created_at',
        orderBy: 'created_at',
    },
] as const;

const mutationSkipped = (): SupabaseMutationResult => ({
    ok: false,
    capabilityBlocked: false,
    missingSession: false,
    error: null,
});

const mutationMissingSession = (): SupabaseMutationResult => ({
    ok: false,
    capabilityBlocked: false,
    missingSession: true,
    error: null,
});

const mutationSucceeded = (): SupabaseMutationResult => ({
    ok: true,
    capabilityBlocked: false,
    missingSession: false,
    error: null,
});

const mutationFailed = (error: SupabaseDomainError): SupabaseMutationResult => ({
    ok: false,
    capabilityBlocked: isSupabaseCapabilityError(error),
    missingSession: false,
    error,
});

const normalizeText = (value: unknown, maxLength = 320): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const buildEmptyHydration = (
    options: LoadUserProgressionOptions = {},
): UserProgressionHydration => ({
    remoteState: null,
    cloudRituals: [],
    didReadCloudRituals: false,
    cloudFollowingKeys: [],
    didReadCloudFollowing: false,
    canReadProfileState: options.canReadProfileState ?? true,
    canReadFollow: options.canReadFollow ?? true,
});

const readRemoteProgressionState = async (
    userId: string,
    canReadProfileState: boolean,
): Promise<Pick<UserProgressionHydration, 'remoteState' | 'canReadProfileState'>> => {
    if (!canReadProfileState || !isSupabaseLive() || !supabase || !userId) {
        return { remoteState: null, canReadProfileState };
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('xp_state')
        .eq('user_id', userId)
        .maybeSingle();

    if (!error && data?.xp_state && typeof data.xp_state === 'object') {
        return {
            remoteState: normalizeXPState(data.xp_state as Partial<XPState>),
            canReadProfileState: true,
        };
    }

    if (error) {
        if (isSupabaseCapabilityError(error)) {
            return { remoteState: null, canReadProfileState: false };
        }
        console.error('[XP] failed to read profile state', error);
    }

    return { remoteState: null, canReadProfileState: true };
};

export const loadUserRituals = async (userId: string): Promise<CloudRitualReadResult> => {
    if (!userId || !isSupabaseLive() || !supabase) {
        return { rituals: [], didRead: false };
    }

    let rows: RitualBackupRow[] = [];
    let queryError: SupabaseDomainError | null = null;

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
            return { rituals: [], didRead: false };
        }

        rows = Array.isArray(data) ? (data as unknown as RitualBackupRow[]) : [];
        queryError = null;
        break;
    }

    if (queryError) {
        return { rituals: [], didRead: false };
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
                posterPath: row.poster_path || undefined,
            });
        })
        .filter((item): item is RitualLog => Boolean(item));

    return {
        rituals: mergeRitualLogs(mapped),
        didRead: true,
    };
};

const readCloudFollowingKeys = async (
    userId: string,
    canReadFollow: boolean,
): Promise<
    Pick<UserProgressionHydration, 'cloudFollowingKeys' | 'didReadCloudFollowing' | 'canReadFollow'>
> => {
    if (!canReadFollow || !isSupabaseLive() || !supabase || !userId) {
        return {
            cloudFollowingKeys: [],
            didReadCloudFollowing: false,
            canReadFollow,
        };
    }

    const { data, error } = await supabase
        .from('user_follows')
        .select('followed_user_id')
        .eq('follower_user_id', userId)
        .limit(1000);

    if (!error) {
        const rows = Array.isArray(data) ? (data as UserFollowRow[]) : [];
        return {
            cloudFollowingKeys: rows
                .map((row) => buildFollowUserIdKey(row.followed_user_id))
                .filter((value): value is string => Boolean(value)),
            didReadCloudFollowing: true,
            canReadFollow: true,
        };
    }

    if (isSupabaseCapabilityError(error)) {
        return {
            cloudFollowingKeys: [],
            didReadCloudFollowing: false,
            canReadFollow: false,
        };
    }

    console.error('[XP] failed to read follow graph', error);

    return {
        cloudFollowingKeys: [],
        didReadCloudFollowing: false,
        canReadFollow: true,
    };
};

export const loadUserProgression = async (
    userId: string,
    options: LoadUserProgressionOptions = {},
): Promise<UserProgressionHydration> => {
    if (!userId || !isSupabaseLive() || !supabase) {
        return buildEmptyHydration(options);
    }

    const canReadProfileState = options.canReadProfileState ?? true;
    const canReadFollow = options.canReadFollow ?? true;

    const [profileResult, ritualResult, followResult] = await Promise.all([
        readRemoteProgressionState(userId, canReadProfileState),
        loadUserRituals(userId),
        readCloudFollowingKeys(userId, canReadFollow),
    ]);

    return {
        remoteState: profileResult.remoteState,
        cloudRituals: ritualResult.rituals,
        didReadCloudRituals: ritualResult.didRead,
        cloudFollowingKeys: followResult.cloudFollowingKeys,
        didReadCloudFollowing: followResult.didReadCloudFollowing,
        canReadProfileState: profileResult.canReadProfileState,
        canReadFollow: followResult.canReadFollow,
    };
};

export const hydrateUserProgression = loadUserProgression;

export const mutateXP = async (input: MutateXPInput): Promise<SupabaseMutationResult> => {
    if (!isSupabaseLive() || !supabase || !input.userId) {
        return mutationSkipped();
    }

    const { error } = await supabase.from('profiles').upsert(
        {
            user_id: input.userId,
            email: input.email,
            display_name: input.displayName,
            xp_state: input.xpState,
            updated_at: input.updatedAt || new Date().toISOString(),
        },
        { onConflict: 'user_id' },
    );

    return error ? mutationFailed(error) : mutationSucceeded();
};

export const mutateRitual = async (input: MutateRitualInput): Promise<SupabaseMutationResult> => {
    if (!isSupabaseLive() || !supabase) {
        return mutationSkipped();
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;

    if (!sessionUser?.id) {
        return mutationMissingSession();
    }

    const nowIso = new Date().toISOString();
    const author =
        normalizeText(input.author, 120) ||
        normalizeText(sessionUser.email?.split('@')[0], 120) ||
        'Observer';
    const movieTitle = normalizeText(input.movieTitle, 220);
    const posterPath = normalizeText(input.posterPath, 500) || null;
    const text = normalizeText(input.text, 2000);
    const league = normalizeText(input.league, 120) || null;
    const year = normalizeText(input.year, 20) || null;

    const ritualInsertPayloads: Array<Record<string, string | null>> = [
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            poster_path: posterPath,
            text,
            timestamp: nowIso,
            league,
            year,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            poster_path: posterPath,
            text,
            timestamp: nowIso,
            league,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            text,
            timestamp: nowIso,
            league,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            text,
            timestamp: nowIso,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            poster_path: posterPath,
            text,
            created_at: nowIso,
            league,
            year,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            text,
            created_at: nowIso,
            league,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            text,
            created_at: nowIso,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            poster_path: posterPath,
            text,
            league,
            year,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            text,
            league,
        },
        {
            user_id: sessionUser.id,
            author,
            movie_title: movieTitle,
            text,
        },
    ];

    let insertError: SupabaseDomainError | null = null;

    for (const payload of ritualInsertPayloads) {
        const { error } = await supabase.from('rituals').insert([payload]);
        if (!error) {
            return mutationSucceeded();
        }
        insertError = error;
        if (!isSupabaseCapabilityError(error)) {
            break;
        }
    }

    return insertError ? mutationFailed(insertError) : mutationSkipped();
};

export const mutateFollow = async (input: MutateFollowInput): Promise<SupabaseMutationResult> => {
    if (
        !isSupabaseLive() ||
        !supabase ||
        !input.followerUserId ||
        !input.followedUserId
    ) {
        return mutationSkipped();
    }

    if (input.shouldFollow) {
        const { error } = await supabase.from('user_follows').upsert(
            [
                {
                    follower_user_id: input.followerUserId,
                    followed_user_id: input.followedUserId,
                },
            ],
            {
                onConflict: 'follower_user_id,followed_user_id',
                ignoreDuplicates: true,
            },
        );
        return error ? mutationFailed(error) : mutationSucceeded();
    }

    const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_user_id', input.followerUserId)
        .eq('followed_user_id', input.followedUserId);

    return error ? mutationFailed(error) : mutationSucceeded();
};
