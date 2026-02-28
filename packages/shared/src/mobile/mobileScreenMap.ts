import type { MobileRouteIntent } from './mobileRouteContract';

export const MOBILE_SCREEN_IDS = [
    'daily_home',
    'invite_claim',
    'share_hub',
    'public_profile',
    'discover_home'
] as const;

export type MobileScreenId = (typeof MOBILE_SCREEN_IDS)[number];

export type MobileScreenPlan = {
    screen: MobileScreenId;
    params: Record<string, string>;
};

const withCommonParams = (
    base: Record<string, string>,
    input: {
        invite?: string;
        platform?: string;
        goal?: string;
        userId?: string;
        username?: string;
        route?: string;
    }
): Record<string, string> => {
    const params = { ...base };
    if (input.invite) params.invite = input.invite;
    if (input.platform) params.platform = input.platform;
    if (input.goal) params.goal = input.goal;
    if (input.userId) params.user_id = input.userId;
    if (input.username) params.username = input.username;
    if (input.route) params.route = input.route;
    return params;
};

export const resolveMobileScreenPlan = (intent: MobileRouteIntent): MobileScreenPlan => {
    if (intent.target === 'daily') {
        return {
            screen: 'daily_home',
            params: {}
        };
    }

    if (intent.target === 'invite') {
        return {
            screen: 'invite_claim',
            params: withCommonParams({}, { invite: intent.invite })
        };
    }

    if (intent.target === 'public_profile') {
        return {
            screen: 'public_profile',
            params: withCommonParams({}, {
                userId: intent.userId,
                username: intent.username
            })
        };
    }

    if (intent.target === 'discover') {
        return {
            screen: 'discover_home',
            params: withCommonParams({}, {
                route: intent.route
            })
        };
    }

    return {
        screen: 'share_hub',
        params: withCommonParams({}, {
            invite: intent.invite,
            platform: intent.platform,
            goal: intent.goal
        })
    };
};
