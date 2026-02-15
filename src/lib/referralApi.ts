import { isSupabaseLive, supabase } from './supabase';

type ReferralApiErrorCode =
    | 'UNAUTHORIZED'
    | 'INVALID_CODE'
    | 'INVITE_NOT_FOUND'
    | 'SELF_INVITE'
    | 'ALREADY_CLAIMED'
    | 'DEVICE_DAILY_LIMIT'
    | 'DEVICE_CODE_REUSE'
    | 'SERVER_ERROR';

type ReferralApiResponse<T> = {
    ok: boolean;
    data?: T;
    errorCode?: ReferralApiErrorCode;
    message?: string;
};

type EnsureInviteCodePayload = {
    code: string;
    created: boolean;
    claimCount: number;
    inviteLink: string;
};

type ClaimInvitePayload = {
    code: string;
    inviterUserId: string | null;
    inviterRewardXp: number;
    inviteeRewardXp: number;
    claimCount: number;
};

const REFERRAL_DEVICE_KEY_STORAGE = '180_referral_device_key_v1';

const getApiBase = (): string => {
    const configuredBase = String(import.meta.env.VITE_REFERRAL_API_BASE || '').trim();
    if (!configuredBase) return '';
    return configuredBase.replace(/\/+$/, '');
};

const getApiUrl = (path: string): string => {
    const base = getApiBase();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
};

const getAuthToken = async (): Promise<string | null> => {
    if (!isSupabaseLive() || !supabase) return null;
    try {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
    } catch {
        return null;
    }
};

const postReferralApi = async <T>(
    path: string,
    payload: Record<string, unknown>
): Promise<ReferralApiResponse<T>> => {
    const accessToken = await getAuthToken();
    if (!accessToken) {
        return {
            ok: false,
            errorCode: 'UNAUTHORIZED',
            message: 'Missing access token.'
        };
    }

    try {
        const response = await fetch(getApiUrl(path), {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        const rawBody = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            data?: T;
            errorCode?: ReferralApiErrorCode;
            message?: string;
            error?: string;
        };

        if (!response.ok || rawBody.ok === false) {
            return {
                ok: false,
                errorCode: rawBody.errorCode || 'SERVER_ERROR',
                message: rawBody.message || rawBody.error || `HTTP ${response.status}`
            };
        }

        return {
            ok: true,
            data: rawBody.data
        };
    } catch (error) {
        return {
            ok: false,
            errorCode: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Network error.'
        };
    }
};

const normalizeDeviceKey = (value: string): string =>
    value.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80);

export const getReferralDeviceKey = (): string => {
    try {
        const existing = localStorage.getItem(REFERRAL_DEVICE_KEY_STORAGE);
        if (existing) return normalizeDeviceKey(existing);
        const generated = normalizeDeviceKey(
            `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        );
        localStorage.setItem(REFERRAL_DEVICE_KEY_STORAGE, generated);
        return generated;
    } catch {
        return normalizeDeviceKey(`dev-${Date.now().toString(36)}-fallback`);
    }
};

export const ensureInviteCodeViaApi = async (seed: string): Promise<ReferralApiResponse<EnsureInviteCodePayload>> =>
    postReferralApi<EnsureInviteCodePayload>('/api/referral/create', { seed });

export const claimInviteCodeViaApi = async (
    code: string,
    deviceKey: string
): Promise<ReferralApiResponse<ClaimInvitePayload>> =>
    postReferralApi<ClaimInvitePayload>('/api/referral/claim', { code, deviceKey });
