import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLanguage } from './LanguageContext';
import { useXP } from './XPContext';
import {
    fetchRecentNotificationEvents,
    markNotificationEventsRead,
    subscribeToNotificationEvents,
    type NotificationEventSnapshot
} from '../lib/notificationEvents';

export interface Notification {
    id: string;
    type: 'echo' | 'follow' | 'daily' | 'reply' | 'system';
    message: string;
    timestamp: string;
    read: boolean;
    link?: string;
    createdAt?: string;
    origin?: 'local' | 'remote';
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markManyAsRead: (ids: string[]) => void;
    markAllAsRead: () => void;
}

type LocalNotificationRecord = {
    id: string;
    type: Notification['type'];
    message: string;
    createdAt: string;
    read: boolean;
    link?: string;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const NOTIFICATION_STORAGE_KEY_PREFIX = '180_notifications_';
const GUEST_NOTIFICATION_KEY = 'guest';
const MAX_NOTIFICATIONS = 120;

const isNotificationType = (value: string): value is Notification['type'] =>
    value === 'echo' || value === 'follow' || value === 'daily' || value === 'reply' || value === 'system';

const buildMockNotifications = (): LocalNotificationRecord[] => {
    const now = Date.now();
    return [
        {
            id: 'mock-daily',
            type: 'daily',
            message: 'The Daily 5 has been refreshed.',
            createdAt: new Date(now).toISOString(),
            read: false
        },
        {
            id: 'mock-echo',
            type: 'echo',
            message: 'User_4421 echoed your In the Mood for Love ritual.',
            createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
            read: false
        },
        {
            id: 'mock-follow',
            type: 'follow',
            message: 'Silent_Walker is now shadow following you.',
            createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
            read: true
        }
    ];
};

const getInitialLocalNotifications = (): LocalNotificationRecord[] => {
    const allowSeed =
        import.meta.env.DEV &&
        import.meta.env.VITE_ENABLE_MOCK_NOTIFICATIONS === '1';
    return allowSeed ? buildMockNotifications() : [];
};

const normalizeText = (value: unknown, maxLength = 320): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeIsoDate = (value: unknown): string => {
    const text = normalizeText(value, 80);
    if (!text) return new Date().toISOString();
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return new Date().toISOString();
    return new Date(parsed).toISOString();
};

const normalizeLocalNotification = (value: unknown): LocalNotificationRecord | null => {
    if (!value || typeof value !== 'object') return null;

    const row = value as Partial<LocalNotificationRecord & { timestamp?: string }>;
    const type = typeof row.type === 'string' && isNotificationType(row.type) ? row.type : null;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const message = typeof row.message === 'string' ? row.message.trim() : '';

    if (!type || !id || !message) return null;

    return {
        id,
        type,
        message,
        createdAt: normalizeIsoDate(row.createdAt || row.timestamp),
        read: Boolean(row.read),
        link: typeof row.link === 'string' ? row.link : undefined
    };
};

const normalizeStorageKeyPart = (raw: string | undefined): string => {
    const normalized = (raw || '').trim().toLowerCase();
    if (!normalized) return GUEST_NOTIFICATION_KEY;
    return normalized.replace(/[^a-z0-9._-]/g, '_');
};

const getNotificationStorageKey = (user: { id?: string; email?: string } | null | undefined): string => {
    const keyPart = normalizeStorageKeyPart(user?.id || user?.email);
    return `${NOTIFICATION_STORAGE_KEY_PREFIX}${keyPart}`;
};

const readLocalNotificationsFromStorage = (storageKey: string): LocalNotificationRecord[] => {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];

        const parsed = JSON.parse(raw) as unknown[];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((entry) => normalizeLocalNotification(entry))
            .filter((entry): entry is LocalNotificationRecord => Boolean(entry))
            .slice(0, MAX_NOTIFICATIONS);
    } catch {
        localStorage.removeItem(storageKey);
        return [];
    }
};

const persistLocalNotificationsToStorage = (storageKey: string, notifications: LocalNotificationRecord[]) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    } catch {
        console.warn('[Notifications] local persistence failed.');
    }
};

const mapRemoteKindToNotificationType = (kind: NotificationEventSnapshot['kind']): Notification['type'] => {
    if (kind === 'comment') return 'reply';
    if (kind === 'like') return 'echo';
    if (kind === 'follow') return 'follow';
    if (kind === 'daily_drop') return 'daily';
    return 'system';
};

const buildNotificationMessage = (title: string, body: string): string => {
    const normalizedTitle = normalizeText(title, 140);
    const normalizedBody = normalizeText(body, 320);

    if (normalizedTitle && normalizedBody) {
        const loweredTitle = normalizedTitle.toLowerCase();
        const loweredBody = normalizedBody.toLowerCase();
        if (loweredBody.startsWith(loweredTitle)) {
            return normalizedBody;
        }
        return `${normalizedTitle}: ${normalizedBody}`;
    }

    return normalizedBody || normalizedTitle || 'Bildirim';
};

const formatNotificationTimestamp = (createdAt: string, language: string): string => {
    const parsed = Date.parse(createdAt);
    if (!Number.isFinite(parsed)) {
        return language === 'tr' ? 'Az once' : 'Just now';
    }

    const diffMs = Date.now() - parsed;
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (diffMs < minuteMs) {
        return language === 'tr' ? 'Az once' : 'Just now';
    }

    if (diffMs < hourMs) {
        const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
        return language === 'tr' ? `${minutes} dk once` : `${minutes}m ago`;
    }

    if (diffMs < dayMs) {
        const hours = Math.max(1, Math.floor(diffMs / hourMs));
        return language === 'tr' ? `${hours} sa once` : `${hours}h ago`;
    }

    if (diffMs < 7 * dayMs) {
        const days = Math.max(1, Math.floor(diffMs / dayMs));
        return language === 'tr' ? `${days} gun once` : `${days}d ago`;
    }

    return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
        month: 'short',
        day: 'numeric'
    }).format(new Date(parsed));
};

const decorateLocalNotification = (
    record: LocalNotificationRecord,
    language: string
): Notification => ({
    id: record.id,
    type: record.type,
    message: record.message,
    timestamp: formatNotificationTimestamp(record.createdAt, language),
    read: record.read,
    link: record.link,
    createdAt: record.createdAt,
    origin: 'local'
});

const decorateRemoteNotification = (
    snapshot: NotificationEventSnapshot,
    language: string
): Notification => ({
    id: snapshot.notificationId,
    type: mapRemoteKindToNotificationType(snapshot.kind),
    message: buildNotificationMessage(snapshot.title, snapshot.body),
    timestamp: formatNotificationTimestamp(snapshot.createdAt, language),
    read: Boolean(snapshot.readAt),
    link: snapshot.deepLink || undefined,
    createdAt: snapshot.createdAt,
    origin: 'remote'
});

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useXP();
    const { language } = useLanguage();
    const storageKey = getNotificationStorageKey(user);
    const [localNotifications, setLocalNotifications] = useState<LocalNotificationRecord[]>(() =>
        getInitialLocalNotifications()
    );
    const [remoteNotifications, setRemoteNotifications] = useState<NotificationEventSnapshot[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(false);
        const fromStorage = readLocalNotificationsFromStorage(storageKey);
        setLocalNotifications(fromStorage.length > 0 ? fromStorage : getInitialLocalNotifications());
        setIsHydrated(true);
    }, [storageKey]);

    useEffect(() => {
        if (!isHydrated) return;
        persistLocalNotificationsToStorage(storageKey, localNotifications);
    }, [isHydrated, localNotifications, storageKey]);

    useEffect(() => {
        if (!user?.id) {
            setRemoteNotifications([]);
            return;
        }

        let active = true;

        const syncRemoteNotifications = async () => {
            const nextNotifications = await fetchRecentNotificationEvents({
                limit: MAX_NOTIFICATIONS
            });
            if (!active) return;
            setRemoteNotifications(nextNotifications);
        };

        void syncRemoteNotifications();

        const unsubscribe = subscribeToNotificationEvents({
            onChange: () => {
                void syncRemoteNotifications();
            }
        });

        const pollId = window.setInterval(() => {
            void syncRemoteNotifications();
        }, 30000);

        return () => {
            active = false;
            window.clearInterval(pollId);
            unsubscribe();
        };
    }, [user?.id]);

    const notifications = useMemo(() => {
        const merged = [
            ...remoteNotifications.map((entry) => decorateRemoteNotification(entry, language)),
            ...localNotifications.map((entry) => decorateLocalNotification(entry, language))
        ];

        return merged
            .sort((left, right) => {
                const leftTime = Date.parse(left.createdAt || '');
                const rightTime = Date.parse(right.createdAt || '');
                return rightTime - leftTime;
            })
            .slice(0, MAX_NOTIFICATIONS);
    }, [language, localNotifications, remoteNotifications]);

    const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);

    const addNotification = useCallback((input: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: LocalNotificationRecord = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: input.type,
            message: normalizeText(input.message, 320) || 'Bildirim',
            createdAt: new Date().toISOString(),
            read: false,
            link: typeof input.link === 'string' ? input.link : undefined
        };
        setLocalNotifications((prev) => [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS));
    }, []);

    const markManyAsRead = useCallback((ids: string[]) => {
        const normalizedIds = Array.from(new Set(ids.map((value) => normalizeText(value, 120)).filter(Boolean)));
        if (normalizedIds.length === 0) return;

        const idSet = new Set(normalizedIds);
        const unreadRemoteIdSet = new Set(
            remoteNotifications
                .filter((notification) => !notification.readAt)
                .map((notification) => notification.notificationId)
        );
        const remoteIds = normalizedIds.filter((id) => unreadRemoteIdSet.has(id));
        const readAt = new Date().toISOString();

        setLocalNotifications((prev) =>
            prev.map((notification) =>
                idSet.has(notification.id) ? { ...notification, read: true } : notification
            )
        );
        setRemoteNotifications((prev) =>
            prev.map((notification) =>
                idSet.has(notification.notificationId) && !notification.readAt
                    ? { ...notification, readAt }
                    : notification
            )
        );

        if (remoteIds.length > 0) {
            void markNotificationEventsRead({ notificationIds: remoteIds }).then((updatedCount) => {
                if (updatedCount === 0) {
                    console.warn('[Notifications] remote read sync returned no updated rows.');
                }
            });
        }
    }, [remoteNotifications]);

    const markAsRead = useCallback((id: string) => {
        markManyAsRead([id]);
    }, [markManyAsRead]);

    const markAllAsRead = useCallback(() => {
        const unreadIds = notifications
            .filter((notification) => !notification.read)
            .map((notification) => notification.id);
        markManyAsRead(unreadIds);
    }, [markManyAsRead, notifications]);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markManyAsRead,
        markAllAsRead
    }), [addNotification, markAllAsRead, markAsRead, markManyAsRead, notifications, unreadCount]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
