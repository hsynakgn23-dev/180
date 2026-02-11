import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useXP } from './XPContext';

export interface Notification {
    id: string;
    type: 'echo' | 'follow' | 'daily' | 'reply' | 'system';
    message: string;
    timestamp: string;
    read: boolean;
    link?: string; // Optional link to the relevant content
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const NOTIFICATION_STORAGE_KEY_PREFIX = '180_notifications_';
const GUEST_NOTIFICATION_KEY = 'guest';
const MAX_NOTIFICATIONS = 120;

const MOCK_NOTIFICATIONS: Notification[] = [
    { id: '1', type: 'daily', message: 'The Daily 5 has been refreshed.', timestamp: 'Just Now', read: false },
    { id: '2', type: 'echo', message: 'User_4421 echoed your In the Mood for Love ritual.', timestamp: '2h ago', read: false },
    { id: '3', type: 'follow', message: 'Silent_Walker is now shadow following you.', timestamp: '5h ago', read: true },
];

const getInitialNotifications = (): Notification[] => {
    const allowSeed =
        import.meta.env.DEV &&
        import.meta.env.VITE_ENABLE_MOCK_NOTIFICATIONS === '1';
    return allowSeed ? MOCK_NOTIFICATIONS : [];
};

const isNotificationType = (value: string): value is Notification['type'] =>
    value === 'echo' || value === 'follow' || value === 'daily' || value === 'reply' || value === 'system';

const normalizeNotification = (value: unknown): Notification | null => {
    if (!value || typeof value !== 'object') return null;
    const row = value as Partial<Notification>;
    const type = typeof row.type === 'string' && isNotificationType(row.type) ? row.type : null;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const message = typeof row.message === 'string' ? row.message.trim() : '';
    const timestamp = typeof row.timestamp === 'string' ? row.timestamp.trim() : '';
    if (!type || !id || !message || !timestamp) return null;
    return {
        id,
        type,
        message,
        timestamp,
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

const readNotificationsFromStorage = (storageKey: string): Notification[] => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as unknown[];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((entry) => normalizeNotification(entry))
            .filter((entry): entry is Notification => Boolean(entry))
            .slice(0, MAX_NOTIFICATIONS);
    } catch {
        localStorage.removeItem(storageKey);
        return [];
    }
};

const persistNotificationsToStorage = (storageKey: string, notifications: Notification[]) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    } catch {
        console.warn('[Notifications] local persistence failed.');
    }
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useXP();
    const storageKey = getNotificationStorageKey(user);
    const [notifications, setNotifications] = useState<Notification[]>(() => getInitialNotifications());
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const fromStorage = readNotificationsFromStorage(storageKey);
        if (fromStorage.length > 0) {
            setNotifications(fromStorage);
        } else {
            setNotifications(getInitialNotifications());
        }
        setIsHydrated(true);
    }, [storageKey]);

    useEffect(() => {
        if (!isHydrated) return;
        persistNotificationsToStorage(storageKey, notifications);
    }, [isHydrated, notifications, storageKey]);

    const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

    const addNotification = useCallback((input: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            ...input,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: 'Just Now',
            read: false,
        };
        setNotifications((prev) => [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS));
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead
    }), [addNotification, markAllAsRead, markAsRead, notifications, unreadCount]);

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
