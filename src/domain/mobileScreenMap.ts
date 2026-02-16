import type { MobileRouteIntent } from './mobileRouteContract';

export const MOBILE_SCREEN_IDS = ['daily_home', 'invite_claim', 'share_hub'] as const;

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
    }
): Record<string, string> => {
    const params = { ...base };
    if (input.invite) params.invite = input.invite;
    if (input.platform) params.platform = input.platform;
    if (input.goal) params.goal = input.goal;
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

    return {
        screen: 'share_hub',
        params: withCommonParams({}, {
            invite: intent.invite,
            platform: intent.platform,
            goal: intent.goal
        })
    };
};
