import { isSupabaseLive, supabase } from './supabase';

type AdminApiErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
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
        const response = await fetch(path, {
            ...init,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                ...(init?.headers || {})
            }
        });

        const rawBody = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            data?: T;
            errorCode?: AdminApiErrorCode;
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

export const readAdminSession = async (): Promise<AdminApiResponse<AdminSessionPayload>> =>
    requestAdminApi<AdminSessionPayload>('/api/admin/session', {
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
    return requestAdminApi<AdminDashboardPayload>(`/api/admin/dashboard${suffix}`, {
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
    }>('/api/admin/moderation/comment', {
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
    }>('/api/admin/moderation/user', {
        method: 'POST',
        body: JSON.stringify(input)
    });
