import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

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

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>(() => getInitialNotifications());

    const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

    const addNotification = useCallback((input: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            ...input,
            id: Date.now().toString(),
            timestamp: 'Just Now',
            read: false,
        };
        setNotifications((prev) => [newNotification, ...prev]);
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
