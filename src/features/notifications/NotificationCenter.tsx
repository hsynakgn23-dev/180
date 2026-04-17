import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';


import { type Notification, useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { parseMobileDeepLink } from '../../domain/deepLinks';

const isHashRoute = (value: string): boolean =>
    value === '/' ||
    value === '#/' ||
    value.startsWith('#/') ||
    value.startsWith('/u/') ||
    value === '/admin' ||
    value.startsWith('/admin?');

const resolveMobileNotificationLink = (
    rawLink: string
): { kind: 'hash' | 'assign'; href: string } | null => {
    const routeIntent = parseMobileDeepLink(rawLink);
    if (!routeIntent) return null;

    // Public profile — /u/<key>?name=<username>
    if (routeIntent.target === 'public_profile') {
        const routeKey = routeIntent.userId
            ? `id:${routeIntent.userId}`
            : routeIntent.username
                ? `name:${routeIntent.username}`
                : '';
        if (!routeKey) {
            return { kind: 'hash', href: '/' };
        }

        const query = new URLSearchParams();
        if (routeIntent.userId && routeIntent.username) {
            query.set('name', routeIntent.username);
        }

        const suffix = query.toString();
        return {
            kind: 'hash',
            href: `/u/${encodeURIComponent(routeKey)}${suffix ? `?${suffix}` : ''}`
        };
    }

    // Own profile — /#/profile
    if (routeIntent.target === 'profile') {
        return { kind: 'hash', href: '/profile' };
    }

    // Daily rollover — /#/daily
    if (routeIntent.target === 'daily') {
        return { kind: 'hash', href: '/daily' };
    }

    // Invite / referral — /#/invite?code=<invite>
    if (routeIntent.target === 'invite') {
        const query = new URLSearchParams();
        if (routeIntent.invite) query.set('code', routeIntent.invite);
        const suffix = query.toString();
        return {
            kind: 'hash',
            href: `/invite${suffix ? `?${suffix}` : ''}`
        };
    }

    // Share — /#/share?invite=...&platform=...&goal=...
    if (routeIntent.target === 'share') {
        const query = new URLSearchParams();
        if (routeIntent.invite) query.set('invite', routeIntent.invite);
        if (routeIntent.platform) query.set('platform', routeIntent.platform);
        if (routeIntent.goal) query.set('goal', routeIntent.goal);
        const suffix = query.toString();
        return {
            kind: 'hash',
            href: `/share${suffix ? `?${suffix}` : ''}`
        };
    }

    // Discover — /#/discover?route=<route>
    if (routeIntent.target === 'discover') {
        const query = new URLSearchParams();
        if (routeIntent.route) query.set('route', routeIntent.route);
        const suffix = query.toString();
        return {
            kind: 'hash',
            href: `/discover${suffix ? `?${suffix}` : ''}`
        };
    }

    return { kind: 'hash', href: '/' };
};

const resolveNotificationLink = (
    rawLink: string
): { kind: 'hash' | 'assign'; href: string } | null => {
    const normalized = String(rawLink || '').trim();
    if (!normalized) return null;

    const mobileLink = resolveMobileNotificationLink(normalized);
    if (mobileLink) return mobileLink;

    if (isHashRoute(normalized)) {
        return {
            kind: 'hash',
            href: normalized.replace(/^#/, '')
        };
    }

    try {
        const parsed = new URL(normalized, window.location.origin);
        if (parsed.origin === window.location.origin) {
            if (parsed.hash && isHashRoute(parsed.hash)) {
                return {
                    kind: 'hash',
                    href: parsed.hash.replace(/^#/, '')
                };
            }

            if (isHashRoute(parsed.pathname)) {
                const nextHref = `${parsed.pathname}${parsed.search}${parsed.hash}`;
                return {
                    kind: 'hash',
                    href: nextHref.replace(/^#/, '')
                };
            }
        }

        return {
            kind: 'assign',
            href: parsed.toString()
        };
    } catch {
        return {
            kind: normalized.startsWith('/') ? 'assign' : 'hash',
            href: normalized.replace(/^#/, '')
        };
    }
};

export const NotificationCenter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const notificationItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const { notifications, unreadCount, markAsRead, markManyAsRead } = useNotifications();
    const { text } = useLanguage();
    const unreadNotificationIds = useMemo(
        () => notifications.filter((notification) => !notification.read).map((notification) => notification.id),
        [notifications]
    );

    const markVisibleNotificationsAsRead = useCallback(() => {
        if (!isOpen || unreadNotificationIds.length === 0) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const visibleUnreadNotificationIds: string[] = [];
        unreadNotificationIds.forEach((notificationId) => {
            const element = notificationItemRefs.current[notificationId];
            if (!element) return;
            const itemRect = element.getBoundingClientRect();
            const isVisible = itemRect.bottom > containerRect.top && itemRect.top < containerRect.bottom;
            if (isVisible) {
                visibleUnreadNotificationIds.push(notificationId);
            }
        });
        if (visibleUnreadNotificationIds.length > 0) {
            markManyAsRead(visibleUnreadNotificationIds);
        }
    }, [isOpen, markManyAsRead, unreadNotificationIds]);

    useEffect(() => {
        if (!isOpen) return;
        const frame = window.requestAnimationFrame(() => {
            markVisibleNotificationsAsRead();
        });
        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [isOpen, notifications, markVisibleNotificationsAsRead]);

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);

        const destination = resolveNotificationLink(notification.link || '');
        if (!destination) return;

        setIsOpen(false);

        if (destination.kind === 'hash') {
            const normalizedHash = destination.href.startsWith('#')
                ? destination.href
                : `#${destination.href.startsWith('/') ? destination.href : `/${destination.href}`}`;
            window.location.assign(normalizedHash);
            return;
        }

        window.location.assign(destination.href);
    };

    return (
        <div className="relative">
            {/* Minimalist Whisper Icon (Bell/Pulse) */}
            <button
                onClick={handleToggle}
                className="relative p-2 text-sage/60 hover:text-sage transition-colors"
                title={text.notifications.title}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>

                {/* Unread Indicator Dot */}
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-sage rounded-full animate-pulse" />
                )}
            </button>

            {/* Dropdown / Echo Chamber */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-[18rem] max-w-[calc(100vw-2rem)] bg-[#121212] border border-white/10 rounded-lg shadow-2xl z-50 animate-fade-in overflow-hidden">
                        <div className="p-3 border-b border-white/5 bg-white/5">
                            <h3 className="text-[10px] font-bold tracking-[0.2em] text-sage uppercase">
                                {text.notifications.panelTitle}
                            </h3>
                        </div>
                        <div
                            ref={scrollContainerRef}
                            className="max-h-64 overflow-y-auto"
                            onScroll={markVisibleNotificationsAsRead}
                        >
                            {notifications.length > 0 ? (
                                notifications.map(notif => (
                                    <button
                                        key={notif.id}
                                        ref={(element) => {
                                            notificationItemRefs.current[notif.id] = element;
                                        }}
                                        type="button"
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`w-full p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer text-left ${!notif.read ? 'bg-sage/5' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon based on type */}
                                            <div className="mt-0.5 text-sage/80">
                                                {notif.type === 'echo' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.588 4.996L12 16.94l7.412-11.944H4.588zM12 21h.01" /></svg>
                                                )}
                                                {notif.type === 'follow' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                )}
                                                {notif.type === 'daily' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                )}
                                                {notif.type === 'reply' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                                )}
                                                {notif.type === 'system' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs font-sans text-[#E5E4E2] leading-relaxed mb-1">
                                                    {notif.message}
                                                </p>
                                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">
                                                    {notif.timestamp}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500 text-xs">
                                    {text.notifications.empty}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
