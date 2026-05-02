import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseLive, supabase } from '../supabase.js';

type NotificationEventRow = {
    id?: unknown;
    kind?: unknown;
    title?: unknown;
    body?: unknown;
    deep_link?: unknown;
    created_at?: unknown;
    read_at?: unknown;
    metadata?: unknown;
};

export type NotificationEventSnapshot = {
    notificationId: string;
    kind: 'comment' | 'like' | 'follow' | 'daily_drop' | 'streak' | 'generic';
    title: string;
    body: string;
    deepLink: string | null;
    createdAt: string;
    readAt: string | null;
};

type NotificationSubscriptionInput = {
    onChange?: () => void;
};

const MAX_FETCH_LIMIT = 120;

const normalizeText = (value: unknown, maxLength = 320): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const clampLimit = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(MAX_FETCH_LIMIT, Math.trunc(parsed)));
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const normalizeIsoDate = (value: unknown): string => {
    const text = normalizeText(value, 80);
    if (!text) return new Date().toISOString();
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return new Date().toISOString();
    return new Date(parsed).toISOString();
};

const normalizeNullableIsoDate = (value: unknown): string | null => {
    const text = normalizeText(value, 80);
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
};

const normalizeKind = (value: unknown): NotificationEventSnapshot['kind'] => {
    const raw = normalizeText(value, 40).toLowerCase();
    if (raw === 'comment' || raw === 'reply') return 'comment';
    if (raw === 'like' || raw === 'echo') return 'like';
    if (raw === 'follow') return 'follow';
    if (raw === 'daily_drop' || raw === 'daily') return 'daily_drop';
    if (raw === 'streak') return 'streak';
    return 'generic';
};

const toSnapshot = (row: NotificationEventRow): NotificationEventSnapshot | null => {
    const notificationId = normalizeText(row.id, 120);
    if (!notificationId) return null;

    const metadata = toObject(row.metadata);
    const deepLink =
        normalizeText(row.deep_link, 500) ||
        normalizeText(metadata?.deepLink, 500) ||
        normalizeText(metadata?.deep_link, 500);

    return {
        notificationId,
        kind: normalizeKind(row.kind),
        title: normalizeText(row.title, 140) || 'Bildirim',
        body: normalizeText(row.body, 320),
        deepLink: deepLink || null,
        createdAt: normalizeIsoDate(row.created_at),
        readAt: normalizeNullableIsoDate(row.read_at),
    };
};

const readCurrentUserId = async (): Promise<string> => {
    if (!isSupabaseLive() || !supabase) return '';
    try {
        const { data } = await supabase.auth.getSession();
        return normalizeText(data.session?.user?.id, 120);
    } catch {
        return '';
    }
};

const removeRealtimeChannel = (target: RealtimeChannel | null): void => {
    if (!target || !supabase) return;
    void supabase.removeChannel(target);
};

export const loadNotifications = async (input?: {
    limit?: number;
}): Promise<NotificationEventSnapshot[]> => {
    if (!isSupabaseLive() || !supabase) return [];

    const userId = await readCurrentUserId();
    if (!userId) return [];

    try {
        const limit = clampLimit(input?.limit, 40);
        const { data, error } = await supabase
            .from('notification_events')
            .select('id,kind,title,body,deep_link,created_at,read_at,metadata')
            .eq('recipient_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];

        const rows = Array.isArray(data) ? (data as NotificationEventRow[]) : [];
        return rows
            .map((row) => toSnapshot(row))
            .filter((row): row is NotificationEventSnapshot => Boolean(row));
    } catch {
        return [];
    }
};

export const mutateNotificationsRead = async (input?: {
    notificationIds?: string[];
}): Promise<number> => {
    if (!isSupabaseLive() || !supabase) return 0;

    const userId = await readCurrentUserId();
    if (!userId) return 0;

    const normalizedIds = Array.from(
        new Set(
            (input?.notificationIds || [])
                .map((value) => normalizeText(value, 120))
                .filter(Boolean),
        ),
    );

    if (input?.notificationIds && normalizedIds.length === 0) return 0;

    try {
        let query = supabase
            .from('notification_events')
            .update({ read_at: new Date().toISOString() })
            .eq('recipient_user_id', userId)
            .is('read_at', null);

        if (normalizedIds.length > 0) {
            query = query.in('id', normalizedIds);
        }

        const { data, error } = await query.select('id');
        if (error) return 0;
        return Array.isArray(data) ? data.length : 0;
    } catch {
        return 0;
    }
};

export const subscribeNotifications = (
    input: NotificationSubscriptionInput,
): (() => void) => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    void (async () => {
        if (!isSupabaseLive() || !supabase) return;

        const userId = await readCurrentUserId();
        if (!userId || !supabase) return;

        const nextChannel = supabase
            .channel(`web-notification-events-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notification_events',
                    filter: `recipient_user_id=eq.${userId}`,
                },
                () => {
                    if (cancelled) return;
                    input.onChange?.();
                },
            )
            .subscribe();

        channel = nextChannel;

        if (cancelled) {
            channel = null;
            removeRealtimeChannel(nextChannel);
        }
    })();

    return () => {
        cancelled = true;
        const activeChannel = channel;
        channel = null;
        removeRealtimeChannel(activeChannel);
    };
};
