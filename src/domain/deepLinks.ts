type MobileDeepLinkType = 'daily' | 'invite' | 'share';

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

export const buildMobileDeepLink = (input: MobileDeepLinkInput): string => {
    const base = getMobileDeepLinkBase();
    const common: Record<string, string> = {
        target: input.type
    };

    if (input.type === 'invite') {
        const inviteCode = normalizeValue(input.inviteCode, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (inviteCode) {
            common.invite = inviteCode;
        }
    }

    if (input.type === 'share') {
        const platform = normalizeValue(input.platform, 24).toLowerCase();
        const goal = normalizeValue(input.goal, 24).toLowerCase();
        const inviteCode = normalizeValue(input.inviteCode, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (platform) common.platform = platform;
        if (goal) common.goal = goal;
        if (inviteCode) common.invite = inviteCode;
    }

    return appendQuery(base, common);
};

export const appendMobileDeepLinkParams = (url: URL, input: MobileDeepLinkInput): URL => {
    const target: MobileDeepLinkType = input.type;
    url.searchParams.set('app_target', target);
    url.searchParams.set('app_link', buildMobileDeepLink(input));
    return url;
};
