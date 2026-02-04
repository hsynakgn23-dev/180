import React, { createContext, useContext, useState, type ReactNode } from 'react';

export interface Notification {
    id: string;
    type: 'echo' | 'follow' | 'daily' | 'reply'; // Added 'reply' type
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

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

    const unreadCount = notifications.filter(n => !n.read).length;

    const addNotification = (input: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            ...input,
            id: Date.now().toString(),
            timestamp: 'Just Now',
            read: false,
        };
        setNotifications(prev => [newNotification, ...prev]);
    };

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead }}>
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
