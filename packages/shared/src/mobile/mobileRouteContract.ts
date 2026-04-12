export const MOBILE_ROUTE_TARGETS = [
    'daily',
    'profile',
    'invite',
    'share',
    'public_profile',
    'discover'
] as const;

export type MobileRouteTarget = (typeof MOBILE_ROUTE_TARGETS)[number];

export type MobileSharePlatform = 'instagram' | 'tiktok' | 'x';
export type MobileShareGoal = 'comment' | 'streak';
export const MOBILE_DISCOVER_ROUTE_IDS = [
    'mood_films',
    'director_deep_dives',
    'daily_curated_picks'
] as const;
export type MobileDiscoverRouteId = (typeof MOBILE_DISCOVER_ROUTE_IDS)[number];

export type MobileRouteIntent =
    | { target: 'daily' }
    | { target: 'profile' }
    | { target: 'invite'; invite?: string }
    | { target: 'share'; invite?: string; platform?: MobileSharePlatform; goal?: MobileShareGoal }
    | { target: 'public_profile'; userId?: string; username?: string }
    | { target: 'discover'; route?: MobileDiscoverRouteId };

const INVITE_CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const SHARE_PLATFORMS = new Set<MobileSharePlatform>(['instagram', 'tiktok', 'x']);
const SHARE_GOALS = new Set<MobileShareGoal>(['comment', 'streak']);
const DISCOVER_ROUTE_IDS = new Set<MobileDiscoverRouteId>(MOBILE_DISCOVER_ROUTE_IDS);

const normalizeValue = (value: string | null | undefined, maxLength = 40): string =>
    String(value || '').trim().slice(0, maxLength);

export const normalizeInviteCode = (value: string | null | undefined): string => {
    const normalized = normalizeValue(value, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return INVITE_CODE_REGEX.test(normalized) ? normalized : '';
};

const normalizeSharePlatform = (value: string | null | undefined): MobileSharePlatform | undefined => {
    const normalized = normalizeValue(value, 24).toLowerCase();
    return SHARE_PLATFORMS.has(normalized as MobileSharePlatform)
        ? (normalized as MobileSharePlatform)
        : undefined;
};

const normalizeShareGoal = (value: string | null | undefined): MobileShareGoal | undefined => {
    const normalized = normalizeValue(value, 24).toLowerCase();
    return SHARE_GOALS.has(normalized as MobileShareGoal)
        ? (normalized as MobileShareGoal)
        : undefined;
};

const normalizePublicProfileUserId = (value: string | null | undefined): string => {
    return normalizeValue(value, 120).replace(/[^a-zA-Z0-9-]/g, '');
};

const normalizePublicProfileUsername = (value: string | null | undefined): string => {
    return normalizeValue(value, 80)
        .replace(/^@+/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
};

const normalizeDiscoverRouteId = (value: string | null | undefined): MobileDiscoverRouteId | undefined => {
    const normalized = normalizeValue(value, 40).toLowerCase();
    return DISCOVER_ROUTE_IDS.has(normalized as MobileDiscoverRouteId)
        ? (normalized as MobileDiscoverRouteId)
        : undefined;
};

export const normalizeMobileRouteIntent = (input: MobileRouteIntent): MobileRouteIntent => {
    if (input.target === 'daily') {
        return { target: 'daily' };
    }

    if (input.target === 'profile') {
        return { target: 'profile' };
    }

    if (input.target === 'invite') {
        const invite = normalizeInviteCode(input.invite);
        return invite
            ? { target: 'invite', invite }
            : { target: 'invite' };
    }

    if (input.target === 'public_profile') {
        const userId = normalizePublicProfileUserId(input.userId);
        const username = normalizePublicProfileUsername(input.username);
        return {
            target: 'public_profile',
            ...(userId ? { userId } : {}),
            ...(username ? { username } : {})
        };
    }

    if (input.target === 'discover') {
        const route = normalizeDiscoverRouteId(input.route);
        return route
            ? { target: 'discover', route }
            : { target: 'discover' };
    }

    const invite = normalizeInviteCode(input.invite);
    const platform = normalizeSharePlatform(input.platform);
    const goal = normalizeShareGoal(input.goal);
    return {
        target: 'share',
        ...(invite ? { invite } : {}),
        ...(platform ? { platform } : {}),
        ...(goal ? { goal } : {})
    };
};

export const encodeMobileRouteIntentToParams = (input: MobileRouteIntent): Record<string, string> => {
    const normalized = normalizeMobileRouteIntent(input);
    const params: Record<string, string> = {
        target: normalized.target
    };

    if (normalized.target === 'invite' && normalized.invite) {
        params.invite = normalized.invite;
    }

    if (normalized.target === 'public_profile') {
        if (normalized.userId) params.user_id = normalized.userId;
        if (normalized.username) params.username = normalized.username;
    }

    if (normalized.target === 'discover' && normalized.route) {
        params.route = normalized.route;
    }

    if (normalized.target === 'share') {
        if (normalized.invite) params.invite = normalized.invite;
        if (normalized.platform) params.platform = normalized.platform;
        if (normalized.goal) params.goal = normalized.goal;
    }

    return params;
};

export const parseMobileRouteIntentFromParams = (params: URLSearchParams): MobileRouteIntent | null => {
    const target = normalizeValue(params.get('target'), 24).toLowerCase() as MobileRouteTarget;
    if (!MOBILE_ROUTE_TARGETS.includes(target)) return null;

    if (target === 'daily') {
        return { target: 'daily' };
    }

    if (target === 'profile') {
        return { target: 'profile' };
    }

    if (target === 'invite') {
        const invite = normalizeInviteCode(params.get('invite'));
        return invite
            ? { target: 'invite', invite }
            : { target: 'invite' };
    }

    if (target === 'public_profile') {
        const userId = normalizePublicProfileUserId(params.get('user_id'));
        const username = normalizePublicProfileUsername(params.get('username'));
        return {
            target: 'public_profile',
            ...(userId ? { userId } : {}),
            ...(username ? { username } : {})
        };
    }

    if (target === 'discover') {
        const route = normalizeDiscoverRouteId(params.get('route'));
        return route
            ? { target: 'discover', route }
            : { target: 'discover' };
    }

    const invite = normalizeInviteCode(params.get('invite'));
    const platform = normalizeSharePlatform(params.get('platform'));
    const goal = normalizeShareGoal(params.get('goal'));

    return {
        target: 'share',
        ...(invite ? { invite } : {}),
        ...(platform ? { platform } : {}),
        ...(goal ? { goal } : {})
    };
};
