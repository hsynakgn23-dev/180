import React, { useState } from 'react';


import { useNotifications } from '../../context/NotificationContext';

export const NotificationCenter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, unreadCount, markAllAsRead } = useNotifications();

    const handleToggle = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            markAllAsRead();
        }
    };


    return (
        <div className="relative">
            {/* Minimalist Whisper Icon (Bell/Pulse) */}
            <button
                onClick={handleToggle}
                className="relative p-2 text-sage/60 hover:text-sage transition-colors"
                title="Whispers"
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
                    <div className="absolute right-0 mt-2 w-72 bg-[#121212] border border-white/10 rounded-lg shadow-2xl z-50 animate-fade-in overflow-hidden">
                        <div className="p-3 border-b border-white/5 bg-white/5">
                            <h3 className="text-[10px] font-bold tracking-[0.2em] text-sage uppercase">
                                Echo Chamber
                            </h3>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length > 0 ? (
                                notifications.map(notif => (
                                    <div key={notif.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notif.read ? 'bg-sage/5' : ''}`}>
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
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500 text-xs">
                                    Silence...
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
