import { normalizeInviteCode, type MobileRouteIntent } from './mobileRouteContract';

export type MobileWebPromptReason = 'streak_active' | 'ritual_active' | 'none';

export type MobileWebPromptInput = {
    streak: number;
    dailyRitualsCount: number;
    inviteCode?: string | null;
};

export type MobileWebPromptDecision = {
    shouldShow: boolean;
    reason: MobileWebPromptReason;
    routeIntent: MobileRouteIntent;
};

const toSafeCount = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
};

export const resolveMobileWebPromptDecision = (
    input: MobileWebPromptInput
): MobileWebPromptDecision => {
    const streak = toSafeCount(input.streak);
    const dailyRitualsCount = toSafeCount(input.dailyRitualsCount);
    const invite = normalizeInviteCode(input.inviteCode);
    const shareBase =
        invite
            ? ({ target: 'share', invite } as const)
            : ({ target: 'share' } as const);

    if (streak >= 3) {
        return {
            shouldShow: true,
            reason: 'streak_active',
            routeIntent: {
                ...shareBase,
                goal: 'streak'
            }
        };
    }

    if (dailyRitualsCount >= 1) {
        return {
            shouldShow: true,
            reason: 'ritual_active',
            routeIntent: {
                ...shareBase,
                goal: 'comment'
            }
        };
    }

    return {
        shouldShow: false,
        reason: 'none',
        routeIntent: { target: 'daily' }
    };
};
