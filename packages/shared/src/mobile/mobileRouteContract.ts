export const MOBILE_ROUTE_TARGETS = ['daily', 'invite', 'share'] as const;

export type MobileRouteTarget = (typeof MOBILE_ROUTE_TARGETS)[number];

export type MobileSharePlatform = 'instagram' | 'tiktok' | 'x';
export type MobileShareGoal = 'comment' | 'streak';

export type MobileRouteIntent =
    | { target: 'daily' }
    | { target: 'invite'; invite?: string }
    | { target: 'share'; invite?: string; platform?: MobileSharePlatform; goal?: MobileShareGoal };

const INVITE_CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const SHARE_PLATFORMS = new Set<MobileSharePlatform>(['instagram', 'tiktok', 'x']);
const SHARE_GOALS = new Set<MobileShareGoal>(['comment', 'streak']);

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

export const normalizeMobileRouteIntent = (input: MobileRouteIntent): MobileRouteIntent => {
    if (input.target === 'daily') {
        return { target: 'daily' };
    }

    if (input.target === 'invite') {
        const invite = normalizeInviteCode(input.invite);
        return invite
            ? { target: 'invite', invite }
            : { target: 'invite' };
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

    if (normalized.target === 'share') {
        if (normalized.invite) params.invite = normalized.invite;
        if (normalized.platform) params.platform = normalized.platform;
        if (normalized.goal) params.goal = normalized.goal;
    }

    return params;
};

export const parseMobileRouteIntentFromParams = (params: URLSearchParams): MobileRouteIntent | null => {
    const target = normalizeValue(params.get('target'), 16).toLowerCase() as MobileRouteTarget;
    if (!MOBILE_ROUTE_TARGETS.includes(target)) return null;

    if (target === 'daily') {
        return { target: 'daily' };
    }

    if (target === 'invite') {
        const invite = normalizeInviteCode(params.get('invite'));
        return invite
            ? { target: 'invite', invite }
            : { target: 'invite' };
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
