import { getConfiguredApiBase } from './apiBase';
import { fetchWithAuth } from './fetchWithAuth';

export type GiftCodeType = 'tickets' | 'premium';

type ReferralApiErrorCode =
    | 'UNAUTHORIZED'
    | 'INVALID_CODE'
    | 'CODE_NOT_FOUND'
    | 'CODE_REVOKED'
    | 'CODE_EXPIRED'
    | 'CODE_EXHAUSTED'
    | 'ALREADY_REDEEMED'
    | 'WALLET_UPDATE_FAILED'
    | 'SUBSCRIPTION_UPDATE_FAILED'
    | 'REFERRAL_PROGRAM_DISABLED'
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
    giftType: GiftCodeType;
    value: number;
    inviterUserId: string | null;
    inviterRewardXp: number;
    inviteeRewardXp: number;
    claimCount: number;
};

const getApiBase = (): string => {
    const configuredBase = String(
        import.meta.env.VITE_REFERRAL_API_BASE || getConfiguredApiBase()
    ).trim();
    if (!configuredBase) return '';
    return configuredBase.replace(/\/+$/, '');
};

const getApiUrl = (path: string): string => {
    const base = getApiBase();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
};

const normalizeGiftCode = (value: unknown): string =>
    String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 80);

const normalizeErrorCode = (value: unknown): ReferralApiErrorCode => {
    const code = String(value || '').trim().toUpperCase();
    switch (code) {
        case 'UNAUTHORIZED':
        case 'INVALID_CODE':
        case 'CODE_NOT_FOUND':
        case 'CODE_REVOKED':
        case 'CODE_EXPIRED':
        case 'CODE_EXHAUSTED':
        case 'ALREADY_REDEEMED':
        case 'WALLET_UPDATE_FAILED':
        case 'SUBSCRIPTION_UPDATE_FAILED':
        case 'REFERRAL_PROGRAM_DISABLED':
            return code;
        default:
            return 'SERVER_ERROR';
    }
};

export const getReferralDeviceKey = (): string => 'gift-code-only';

export const ensureInviteCodeViaApi = async (
    _seed: string
): Promise<ReferralApiResponse<EnsureInviteCodePayload>> => ({
    ok: false,
    errorCode: 'REFERRAL_PROGRAM_DISABLED',
    message: 'Friend invite program is disabled.'
});

export const claimInviteCodeViaApi = async (
    code: string,
    _deviceKey?: string
): Promise<ReferralApiResponse<ClaimInvitePayload>> => {
    const giftCode = normalizeGiftCode(code);
    if (!giftCode || giftCode.length < 6) {
        return {
            ok: false,
            errorCode: 'INVALID_CODE',
            message: 'Invalid gift code.'
        };
    }

    try {
        const response = await fetchWithAuth(getApiUrl('/api/gift-redeem'), {
            method: 'POST',
            isWrite: true,
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({ code: giftCode })
        });

        const rawBody = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            code?: string;
            giftType?: GiftCodeType;
            value?: number;
            error?: string;
            errorCode?: string;
            message?: string;
        };

        if (!response.ok || rawBody.ok === false) {
            const errorCode = normalizeErrorCode(rawBody.errorCode || rawBody.error);
            return {
                ok: false,
                errorCode,
                message: rawBody.message || rawBody.error || `HTTP ${response.status}`
            };
        }

        const giftType = rawBody.giftType === 'premium' ? 'premium' : 'tickets';
        const value = Math.max(0, Math.floor(Number(rawBody.value) || 0));
        return {
            ok: true,
            data: {
                code: normalizeGiftCode(rawBody.code || giftCode),
                giftType,
                value,
                inviterUserId: null,
                inviterRewardXp: 0,
                inviteeRewardXp: 0,
                claimCount: 0
            }
        };
    } catch (error) {
        return {
            ok: false,
            errorCode: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Network error.'
        };
    }
};
