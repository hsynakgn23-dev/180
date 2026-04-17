import { buildApiUrl } from './apiBase';
import { fetchWithTimeout } from './network';
import { isSupabaseLive, supabase } from './supabase';

type EngagementNotificationApiErrorCode =
    | 'UNAUTHORIZED'
    | 'EXPO_PUSH_FAILED'
    | 'SERVER_ERROR';

type EngagementNotificationApiResponse<T> = {
    ok: boolean;
    data?: T;
    errorCode?: EngagementNotificationApiErrorCode;
    message?: string;
};

export type EngagementNotificationPayload =
    | {
          kind: 'comment' | 'like';
          ritualId: string;
          actorLabel?: string;
      }
    | {
          kind: 'follow';
          targetUserId: string;
          actorLabel?: string;
      };

const normalizeText = (value: unknown, maxLength: number): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
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

export const sendEngagementNotification = async (
    payload: EngagementNotificationPayload
): Promise<
    EngagementNotificationApiResponse<{
        sentCount: number;
        ticketCount: number;
        errorCount: number;
        skipped: boolean;
        targetUserId: string | null;
        message: string;
    }>
> => {
    const accessToken = await getAuthToken();
    if (!accessToken) {
        return {
            ok: false,
            errorCode: 'UNAUTHORIZED',
            message: 'Missing access token.'
        };
    }

    const body: Record<string, unknown> = {
        kind: payload.kind
    };

    const actorLabel = normalizeText(payload.actorLabel, 80);
    if (actorLabel) body.actorLabel = actorLabel;

    if (payload.kind === 'follow') {
        const targetUserId = normalizeText(payload.targetUserId, 120);
        if (targetUserId) body.targetUserId = targetUserId;
    } else {
        const ritualId = normalizeText(payload.ritualId, 120);
        if (ritualId) body.ritualId = ritualId;
    }

    try {
        const response = await fetchWithTimeout({
            url: buildApiUrl('/api/push/engagement'),
            timeoutMs: 10000,
            timeoutMessage: 'Engagement notification timeout',
            init: {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify(body)
            }
        });

        const rawBody = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            data?: {
                sentCount: number;
                ticketCount: number;
                errorCount: number;
                skipped: boolean;
                targetUserId: string | null;
                message: string;
            };
            errorCode?: EngagementNotificationApiErrorCode;
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
