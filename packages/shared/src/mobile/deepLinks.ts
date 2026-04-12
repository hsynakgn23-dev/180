import {
    encodeMobileRouteIntentToParams,
    normalizeMobileRouteIntent,
    parseMobileRouteIntentFromParams,
    type MobileRouteIntent
} from './mobileRouteContract';
import { resolveMobileScreenPlan } from './mobileScreenMap';

export type MobileDeepLinkInput =
    | { type: 'daily' }
    | { type: 'profile' }
    | { type: 'invite'; inviteCode?: string }
    | { type: 'share'; platform?: string; goal?: string; inviteCode?: string }
    | { type: 'public_profile'; userId?: string; username?: string }
    | { type: 'discover'; route?: string };

export type MobileDeepLinkOptions = {
    base?: string | null;
};

const DEFAULT_MOBILE_DEEP_LINK_BASE = 'absolutecinema://open';

const normalizeValue = (value: string | null | undefined, maxLength = 40): string =>
    String(value || '').trim().slice(0, maxLength);

const resolveMobileDeepLinkBase = (options?: MobileDeepLinkOptions): string => {
    const configured = normalizeValue(options?.base || '', 240);
    return configured || DEFAULT_MOBILE_DEEP_LINK_BASE;
};

const appendQuery = (base: string, params: Record<string, string>): string => {
    const urlSearchParams = new URLSearchParams(params);
    const query = urlSearchParams.toString();
    if (!query) return base;
    return `${base}${base.includes('?') ? '&' : '?'}${query}`;
};

const toRouteIntent = (input: MobileDeepLinkInput): MobileRouteIntent => {
    if (input.type === 'daily') {
        return { target: 'daily' };
    }
    if (input.type === 'profile') {
        return { target: 'profile' };
    }
    if (input.type === 'invite') {
        return { target: 'invite', invite: input.inviteCode };
    }
    if (input.type === 'public_profile') {
        return {
            target: 'public_profile',
            userId: input.userId,
            username: input.username
        };
    }
    if (input.type === 'discover') {
        return {
            target: 'discover',
            route: input.route as
                | 'mood_films'
                | 'director_deep_dives'
                | 'daily_curated_picks'
                | undefined
        };
    }
    return {
        target: 'share',
        platform: input.platform as 'instagram' | 'tiktok' | 'x' | undefined,
        goal: input.goal as 'comment' | 'streak' | undefined,
        invite: input.inviteCode
    };
};

export const buildMobileDeepLink = (input: MobileDeepLinkInput, options?: MobileDeepLinkOptions): string => {
    return buildMobileDeepLinkFromRouteIntent(toRouteIntent(input), options);
};

export const buildMobileDeepLinkFromRouteIntent = (
    routeIntent: MobileRouteIntent,
    options?: MobileDeepLinkOptions
): string => {
    const base = resolveMobileDeepLinkBase(options);
    const normalizedIntent = normalizeMobileRouteIntent(routeIntent);
    const routeParams = encodeMobileRouteIntentToParams(normalizedIntent);
    const screenPlan = resolveMobileScreenPlan(normalizedIntent);
    const params = {
        ...routeParams,
        screen: screenPlan.screen,
        ...screenPlan.params
    };
    return appendQuery(base, params);
};

export const appendMobileDeepLinkParams = (
    url: URL,
    input: MobileDeepLinkInput,
    options?: MobileDeepLinkOptions
): URL => {
    const target = toRouteIntent(input).target;
    url.searchParams.set('app_target', target);
    url.searchParams.set('app_link', buildMobileDeepLink(input, options));
    return url;
};

export const parseMobileDeepLink = (value: string): MobileRouteIntent | null => {
    const raw = normalizeValue(value, 500);
    if (!raw) return null;
    try {
        const parsed = new URL(raw);
        return parseMobileRouteIntentFromParams(parsed.searchParams);
    } catch {
        return null;
    }
};
