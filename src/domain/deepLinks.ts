import {
    encodeMobileRouteIntentToParams,
    parseMobileRouteIntentFromParams,
    type MobileRouteIntent
} from './mobileRouteContract';
import { resolveMobileScreenPlan } from './mobileScreenMap';

type MobileDeepLinkInput =
    | { type: 'daily' }
    | { type: 'invite'; inviteCode?: string }
    | { type: 'share'; platform?: string; goal?: string; inviteCode?: string };

const DEFAULT_MOBILE_DEEP_LINK_BASE = 'absolutecinema://open';

const normalizeValue = (value: string | null | undefined, maxLength = 40): string =>
    String(value || '').trim().slice(0, maxLength);

const getMobileDeepLinkBase = (): string => {
    const configured = normalizeValue(import.meta.env.VITE_MOBILE_DEEP_LINK_BASE || '', 240);
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
    if (input.type === 'invite') {
        return { target: 'invite', invite: input.inviteCode };
    }
    return {
        target: 'share',
        platform: input.platform as 'instagram' | 'tiktok' | 'x' | undefined,
        goal: input.goal as 'comment' | 'streak' | undefined,
        invite: input.inviteCode
    };
};

export const buildMobileDeepLink = (input: MobileDeepLinkInput): string => {
    const base = getMobileDeepLinkBase();
    const routeIntent = toRouteIntent(input);
    const routeParams = encodeMobileRouteIntentToParams(routeIntent);
    const screenPlan = resolveMobileScreenPlan(routeIntent);
    const params = {
        ...routeParams,
        screen: screenPlan.screen,
        ...screenPlan.params
    };
    return appendQuery(base, params);
};

export const appendMobileDeepLinkParams = (url: URL, input: MobileDeepLinkInput): URL => {
    const target = toRouteIntent(input).target;
    url.searchParams.set('app_target', target);
    url.searchParams.set('app_link', buildMobileDeepLink(input));
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
