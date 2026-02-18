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

export { parseMobileDeepLink };
