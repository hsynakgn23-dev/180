import { isSupabaseLive, supabase } from './supabase';
import { buildApiUrl } from './apiBase';

type AdminApiErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'INVALID_TARGET'
    | 'INVALID_ID'
    | 'INVALID_ACTION'
    | 'METHOD_NOT_ALLOWED'
    | 'NOT_FOUND'
    | 'SERVER_ERROR';

type AdminApiResponse<T> = {
    ok: boolean;
    data?: T;
    errorCode?: AdminApiErrorCode;
    message?: string;
};

const ADMIN_CSRF_STORAGE_KEY = 'absolute-cinema.admin.csrf';
const ADMIN_CSRF_HEADER = 'x-admin-csrf-token';

let cachedAdminCsrfToken: string | null = null;

export type AdminSessionPayload = {
    userId: string;
    email: string;
    role: 'admin' | 'moderator';
    note: string;
    createdAt: string | null;
};

export type AdminDashboardPayload = {
    query: string;
    stats: {
        openReports: number;
        removedRituals: number;
        removedReplies: number;
        suspendedUsers: number;
    };
    users: Array<{
        userId: string;
        email: string;
        displayName: string;
        createdAt: string | null;
        updatedAt: string | null;
        role: string;
        suspendedUntil: string | null;
        moderationNote: string;
    }>;
    rituals: Array<{
        id: string;
        userId: string | null;
        author: string;
        movieTitle: string;
        text: string;
        createdAt: string | null;
        isRemoved: boolean;
        removedAt: string | null;
        removalReason: string;
    }>;
    replies: Array<{
        id: string;
        ritualId: string;
        userId: string | null;
        author: string;
        text: string;
        createdAt: string | null;
        isRemoved: boolean;
        removedAt: string | null;
        removalReason: string;
    }>;
    reports: Array<{
        id: string;
        reporterUserId: string | null;
        targetUserId: string | null;
        ritualId: string;
        replyId: string;
        reasonCode: string;
        details: string;
        status: string;
        createdAt: string | null;
    }>;
    actions: Array<{
        id: string;
        actorUserId: string | null;
        targetUserId: string | null;
        ritualId: string;
        replyId: string;
        reportId: string;
        action: string;
        reasonCode: string;
        note: string;
        metadata: Record<string, unknown>;
        createdAt: string | null;
    }>;
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

const readStoredAdminCsrfToken = (): string | null => {
    if (cachedAdminCsrfToken) return cachedAdminCsrfToken;
    if (typeof window === 'undefined') return null;

    try {
        const token = window.sessionStorage.getItem(ADMIN_CSRF_STORAGE_KEY)?.trim() || '';
        cachedAdminCsrfToken = token || null;
        return cachedAdminCsrfToken;
    } catch {
        return null;
    }
};

const storeAdminCsrfToken = (value: unknown) => {
    const token = String(value || '').trim();
    if (!token) return;

    cachedAdminCsrfToken = token;
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(ADMIN_CSRF_STORAGE_KEY, token);
    } catch {
        // Ignore storage failures and keep the in-memory copy.
    }
};

const mergeHeaders = (headersInit?: HeadersInit): Record<string, string> => {
    if (!headersInit) return {};
    if (typeof Headers !== 'undefined' && headersInit instanceof Headers) {
        const nextHeaders: Record<string, string> = {};
        headersInit.forEach((value, key) => {
            nextHeaders[key] = value;
        });
        return nextHeaders;
    }

    if (Array.isArray(headersInit)) {
        return Object.fromEntries(
            headersInit
                .filter(
                    (entry): entry is [string, string] =>
                        Array.isArray(entry) && entry.length === 2 && entry[1] != null
                )
                .map(([key, value]) => [key, String(value)])
        );
    }

    return Object.fromEntries(
        Object.entries(headersInit).flatMap(([key, value]) =>
            value == null ? [] : [[key, String(value)]]
        )
    );
};

const readMethod = (init?: RequestInit): string =>
    String(init?.method || 'GET')
        .trim()
        .toUpperCase() || 'GET';

const isStateChangingMethod = (method: string): boolean =>
    !['GET', 'HEAD', 'OPTIONS'].includes(method);

const bootstrapAdminCsrfToken = async (
    accessToken: string,
    forceRefresh = false
): Promise<string | null> => {
    if (!forceRefresh) {
        const existing = readStoredAdminCsrfToken();
        if (existing) return existing;
    }

    try {
        const response = await fetch(buildApiUrl('/api/admin/session'), {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            }
        });
        const rawBody = (await response.json().catch(() => ({}))) as {
            csrfToken?: string;
        };
        if (!response.ok) {
            return null;
        }

        storeAdminCsrfToken(rawBody.csrfToken);
        return readStoredAdminCsrfToken();
    } catch {
        return null;
    }
};

const requestAdminApi = async <T>(
    path: string,
    init?: RequestInit
): Promise<AdminApiResponse<T>> => {
    const accessToken = await getAuthToken();
    if (!accessToken) {
        return {
            ok: false,
            errorCode: 'UNAUTHORIZED',
            message: 'Missing access token.'
        };
    }

    try {
        const method = readMethod(init);
        const headers: Record<string, string> = {
            'content-type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...mergeHeaders(init?.headers)
        };

        if (isStateChangingMethod(method)) {
            const csrfToken =
                (await bootstrapAdminCsrfToken(accessToken, true)) || readStoredAdminCsrfToken();
            if (!csrfToken) {
                return {
                    ok: false,
                    errorCode: 'FORBIDDEN',
                    message: 'Admin security token is missing.'
                };
            }
            headers[ADMIN_CSRF_HEADER] = csrfToken;
        }

        const response = await fetch(path, {
            ...init,
            headers
        });

        const rawBody = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            data?: T;
            errorCode?: AdminApiErrorCode;
            message?: string;
            error?: string;
            csrfToken?: string;
        };

        storeAdminCsrfToken(rawBody.csrfToken);

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

export const readAdminSession = async (): Promise<AdminApiResponse<AdminSessionPayload>> =>
    requestAdminApi<AdminSessionPayload>(buildApiUrl('/api/admin/session'), {
        method: 'GET'
    });

export const readAdminDashboard = async (
    query = '',
    limit = 20
): Promise<AdminApiResponse<AdminDashboardPayload>> => {
    const params = new URLSearchParams();
    if (query.trim()) {
        params.set('q', query.trim());
    }
    params.set('limit', String(limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return requestAdminApi<AdminDashboardPayload>(buildApiUrl(`/api/admin/dashboard${suffix}`), {
        method: 'GET'
    });
};

export const moderateAdminComment = async (input: {
    entityType: 'ritual' | 'reply';
    entityId: string;
    action: 'remove' | 'restore';
    reasonCode: string;
    note?: string;
}) =>
    requestAdminApi<{
        entityType: 'ritual' | 'reply';
        entityId: string;
        action: 'remove' | 'restore';
        isRemoved: boolean;
        userId: string | null;
        author: string;
        movieTitle?: string;
        text: string;
        removalReason: string;
        reportResolutionWarning?: string;
        auditWarning?: string;
    }>(buildApiUrl('/api/admin/moderation/comment'), {
        method: 'POST',
        body: JSON.stringify(input)
    });

export const moderateAdminUser = async (input: {
    targetUserId: string;
    action: 'suspend' | 'unsuspend' | 'delete';
    durationHours?: number;
    reasonCode: string;
    note?: string;
}) =>
    requestAdminApi<{
        action: 'suspend' | 'unsuspend' | 'delete';
        targetUserId: string;
        suspendedUntil?: string | null;
        auditWarning?: string;
    }>(buildApiUrl('/api/admin/moderation/user'), {
        method: 'POST',
        body: JSON.stringify(input)
    });

export type GiftCode = {
    id: string;
    code: string;
    gift_type: 'tickets' | 'premium';
    value: number;
    max_uses: number;
    use_count: number;
    expires_at: string | null;
    note: string | null;
    created_at: string;
    is_revoked: boolean;
    redemption_count?: number;
    redemptions?: GiftCodeRedemption[];
    auditWarning?: string;
};

export type GiftCodeRedemption = {
    id: string;
    code: string;
    user_id: string | null;
    gift_type: string;
    value: number;
    status: string;
    redeemed_at: string | null;
    fulfilled_at: string | null;
    last_error: string | null;
};

export const listAdminGiftCodes = async (): Promise<AdminApiResponse<GiftCode[]>> =>
    requestAdminApi<GiftCode[]>(buildApiUrl('/api/admin/gift'), { method: 'GET' });

export const createAdminGiftCode = async (input: {
    giftType: 'tickets' | 'premium';
    value: number;
    maxUses?: number;
    expiresInDays?: number;
    note?: string;
}) =>
    requestAdminApi<GiftCode>(buildApiUrl('/api/admin/gift'), {
        method: 'POST',
        body: JSON.stringify(input)
    });

export const updateAdminGiftCode = async (input: {
    codeId: string;
    isRevoked: boolean;
    note?: string;
}) =>
    requestAdminApi<GiftCode>(buildApiUrl('/api/admin/gift'), {
        method: 'PATCH',
        body: JSON.stringify(input)
    });
