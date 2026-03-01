import {
    appendMobileDeepLinkParams as appendMobileDeepLinkParamsShared,
    buildMobileDeepLink as buildMobileDeepLinkShared,
    buildMobileDeepLinkFromRouteIntent as buildMobileDeepLinkFromRouteIntentShared,
    parseMobileDeepLink,
    type MobileDeepLinkInput
} from '../../packages/shared/src/mobile/deepLinks';
import type { MobileRouteIntent } from './mobileRouteContract';

const DEFAULT_MOBILE_DEEP_LINK_BASE = 'absolutecinema://open';

const normalizeValue = (value: string | null | undefined, maxLength = 40): string =>
    String(value || '').trim().slice(0, maxLength);

const getMobileDeepLinkBase = (): string => {
    const configured = normalizeValue(import.meta.env.VITE_MOBILE_DEEP_LINK_BASE || '', 240);
    return configured || DEFAULT_MOBILE_DEEP_LINK_BASE;
};

export type { MobileDeepLinkInput } from '../../packages/shared/src/mobile/deepLinks';

export const buildMobileDeepLink = (input: MobileDeepLinkInput): string => {
    return buildMobileDeepLinkShared(input, {
        base: getMobileDeepLinkBase()
    });
};

export const buildMobileDeepLinkFromRouteIntent = (routeIntent: MobileRouteIntent): string => {
    return buildMobileDeepLinkFromRouteIntentShared(routeIntent, {
        base: getMobileDeepLinkBase()
    });
};

export const appendMobileDeepLinkParams = (url: URL, input: MobileDeepLinkInput): URL => {
    return appendMobileDeepLinkParamsShared(url, input, {
        base: getMobileDeepLinkBase()
    });
};

export const appendMobileDeepLinkParamsToHref = (
    href: string,
    input: MobileDeepLinkInput,
    options?: { origin?: string | null }
): string => {
    const normalizedHref = normalizeValue(href, 500);
    if (!normalizedHref) return '';

    const origin =
        normalizeValue(options?.origin || '', 240) ||
        (typeof window !== 'undefined' ? normalizeValue(window.location.origin, 240) : '');
    if (!origin) return normalizedHref;

    try {
        const url = new URL(normalizedHref, origin);
        appendMobileDeepLinkParams(url, input);
        return url.origin === origin
            ? `${url.pathname}${url.search}${url.hash}`
            : url.toString();
    } catch {
        return normalizedHref;
    }
};

export { parseMobileDeepLink };
