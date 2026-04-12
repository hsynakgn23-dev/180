import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PushNotificationSnapshot } from './mobilePush';
import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';

type NotificationEventRow = {
  id?: unknown;
  kind?: unknown;
  title?: unknown;
  body?: unknown;
  deep_link?: unknown;
  created_at?: unknown;
  metadata?: unknown;
};

type NotificationEventSubscriptionInput = {
  onInsert?: (snapshot: PushNotificationSnapshot) => void;
};

const MAX_FETCH_LIMIT = 40;

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

const normalizeKind = (value: unknown): PushNotificationSnapshot['kind'] => {
  const raw = normalizeText(value, 40).toLowerCase();
  if (raw === 'reply' || raw === 'comment') return 'comment';
  if (raw === 'echo' || raw === 'like') return 'like';
  if (raw === 'follow') return 'follow';
  if (raw === 'daily' || raw === 'daily_drop') return 'daily_drop';
  if (raw === 'streak') return 'streak';
  return 'generic';
};

const toSnapshot = (row: NotificationEventRow): PushNotificationSnapshot | null => {
  const notificationId = normalizeText(row.id, 120);
  if (!notificationId) return null;

  const metadata = toObject(row.metadata);
  const deepLink =
    normalizeText(row.deep_link, 500) ||
    normalizeText(metadata?.deepLink, 500) ||
    normalizeText(metadata?.deep_link, 500);

  return {
    notificationId,
    title: normalizeText(row.title, 140) || 'Bildirim',
    body: normalizeText(row.body, 300),
    deepLink: deepLink || null,
    kind: normalizeKind(row.kind),
    receivedAt: normalizeIsoDate(row.created_at),
  };
};

const readCurrentUserId = async (): Promise<string> => {
  if (!isSupabaseLive() || !supabase) return '';
  const sessionResult = await readSupabaseSessionSafe();
  return normalizeText(sessionResult.session?.user?.id, 120);
};

const removeRealtimeChannel = (target: RealtimeChannel | null): void => {
  if (!target || !supabase) return;
  void supabase.removeChannel(target);
};

export const fetchRecentMobileNotificationEvents = async (input?: {
  limit?: number;
}): Promise<PushNotificationSnapshot[]> => {
  if (!isSupabaseLive() || !supabase) return [];

  const userId = await readCurrentUserId();
  if (!userId) return [];

  try {
    const limit = clampLimit(input?.limit, 20);
    const { data, error } = await supabase
      .from('notification_events')
      .select('id,kind,title,body,deep_link,created_at,metadata')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];

    const rows = Array.isArray(data) ? (data as NotificationEventRow[]) : [];
    return rows
      .map((row) => toSnapshot(row))
      .filter((row): row is PushNotificationSnapshot => Boolean(row))
      .reverse();
  } catch {
    return [];
  }
};

export const subscribeToMobileNotificationEvents = (
  input: NotificationEventSubscriptionInput
): (() => void) => {
  let cancelled = false;
  let channel: RealtimeChannel | null = null;

  void (async () => {
    if (!isSupabaseLive() || !supabase) return;

    const userId = await readCurrentUserId();
    if (!userId || !supabase) return;

    const nextChannel = supabase
      .channel(`mobile-notification-events-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_events',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return;
          const snapshot = toSnapshot((payload.new || {}) as NotificationEventRow);
          if (!snapshot) return;
          input.onInsert?.(snapshot);
        }
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
