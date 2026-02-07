import React, { useEffect, useState } from 'react';
import { useXP } from '../../context/XPContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'identity' | 'appearance' | 'session';
type ThemeMode = 'midnight' | 'dawn';
type LanguageMode = 'tr' | 'en';

const THEME_STORAGE_KEY = '180_theme_pref';
const LANGUAGE_STORAGE_KEY = '180_lang_pref';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { user, updateIdentity, logout, bio, avatarUrl, updateAvatar, avatarId } = useXP();
    const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
    const [bioDraft, setBioDraft] = useState(bio);
    const [theme, setTheme] = useState<ThemeMode>('midnight');
    const [language, setLanguage] = useState<LanguageMode>('tr');
    const [statusMessage, setStatusMessage] = useState('');
    const [confirmLogout, setConfirmLogout] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        setBioDraft(bio);
        setStatusMessage('');
        setConfirmLogout(false);

        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'dawn' || storedTheme === 'midnight') {
            setTheme(storedTheme);
        } else {
            setTheme(document.body.classList.contains('light-mode') ? 'dawn' : 'midnight');
        }

        const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (storedLanguage === 'tr' || storedLanguage === 'en') {
            setLanguage(storedLanguage);
        }
    }, [isOpen, bio]);

    useEffect(() => {
        if (!statusMessage) return;
        const timeout = setTimeout(() => setStatusMessage(''), 2000);
        return () => clearTimeout(timeout);
    }, [statusMessage]);

    const applyTheme = (nextTheme: ThemeMode) => {
        setTheme(nextTheme);
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        if (nextTheme === 'dawn') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        setStatusMessage('Theme updated');
    };

    const applyLanguage = (nextLanguage: LanguageMode) => {
        setLanguage(nextLanguage);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        setStatusMessage('Language preference saved');
    };

    const handleSaveIdentity = () => {
        updateIdentity(bioDraft, avatarId);
        setStatusMessage('Identity saved');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                updateAvatar(reader.result);
                setStatusMessage('Avatar updated');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleLogout = async () => {
        if (!confirmLogout) {
            setConfirmLogout(true);
            return;
        }
        await logout();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[70] animate-fade-in"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#121212] border-l border-white/10 z-[80] animate-slide-in-right overflow-y-auto">
                <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-xl border-b border-white/10 p-6 z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg tracking-[0.22em] uppercase font-bold text-sage">Settings</h2>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#E5E4E2]/45 mt-1">
                                Account and experience controls
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[10px] tracking-[0.18em] uppercase border border-white/15 rounded px-3 py-1.5 text-gray-400 hover:text-sage hover:border-sage/35 transition-colors"
                        >
                            Close
                        </button>
                    </div>

                    <div className="flex gap-2 mt-5">
                        {([
                            { id: 'identity', label: 'Identity' },
                            { id: 'appearance', label: 'Appearance' },
                            { id: 'session', label: 'Session' }
                        ] as const).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-2 text-[10px] uppercase tracking-[0.2em] rounded border transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-sage text-[#121212] border-sage'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:text-sage hover:border-sage/30'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6">
                    {statusMessage && (
                        <div className="mb-5 text-[10px] uppercase tracking-[0.16em] text-sage/90 border border-sage/20 bg-sage/10 rounded px-3 py-2">
                            {statusMessage}
                        </div>
                    )}

                    {activeTab === 'identity' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">Avatar</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-[#0f0f0f]">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lg text-sage/70 font-bold">
                                                {user?.name?.slice(0, 1).toUpperCase() || 'U'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-[10px] uppercase tracking-[0.18em] border border-sage/30 rounded px-3 py-2 text-sage hover:border-sage/60 transition-colors"
                                        >
                                            Upload Avatar
                                        </button>
                                        <p className="text-[10px] text-gray-500 mt-2">Recommended: square image</p>
                                    </div>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">Display Name</p>
                                <div className="text-sm text-[#E5E4E2] font-bold tracking-wide">
                                    {user?.name || 'Observer'}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">
                                    Name edits are not wired to backend yet.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <label className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2 block">
                                    Bio ({bioDraft.length}/180)
                                </label>
                                <textarea
                                    value={bioDraft}
                                    onChange={(e) => setBioDraft(e.target.value.slice(0, 180))}
                                    rows={4}
                                    className="w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none resize-none"
                                    placeholder="Write a short cinematic identity note..."
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveIdentity}
                                    className="mt-4 w-full bg-sage text-[#121212] rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity"
                                >
                                    Save Identity
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">Theme</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => applyTheme('midnight')}
                                        className={`p-4 rounded border transition-colors ${
                                            theme === 'midnight'
                                                ? 'border-sage bg-sage/10'
                                                : 'border-white/10 bg-[#141414] hover:border-sage/30'
                                        }`}
                                    >
                                        <div className="h-10 rounded bg-[#121212] border border-white/10 mb-2" />
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#E5E4E2]">Midnight</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyTheme('dawn')}
                                        className={`p-4 rounded border transition-colors ${
                                            theme === 'dawn'
                                                ? 'border-sage bg-sage/10'
                                                : 'border-white/10 bg-[#141414] hover:border-sage/30'
                                        }`}
                                    >
                                        <div className="h-10 rounded bg-[#FDFCF8] border border-[#d8d4cc] mb-2" />
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#E5E4E2]">Dawn</p>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">Language</p>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => applyLanguage('tr')}
                                        className={`px-4 py-2 rounded border text-[10px] uppercase tracking-[0.18em] transition-colors ${
                                            language === 'tr'
                                                ? 'border-sage bg-sage/10 text-sage'
                                                : 'border-white/10 text-gray-400 hover:border-sage/30 hover:text-sage'
                                        }`}
                                    >
                                        Turkish
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyLanguage('en')}
                                        className={`px-4 py-2 rounded border text-[10px] uppercase tracking-[0.18em] transition-colors ${
                                            language === 'en'
                                                ? 'border-sage bg-sage/10 text-sage'
                                                : 'border-white/10 text-gray-400 hover:border-sage/30 hover:text-sage'
                                        }`}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'session' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">Active Account</p>
                                <p className="text-sm font-bold text-[#E5E4E2]">{user?.name || 'Observer'}</p>
                                <p className="text-xs text-gray-500 mt-1">{user?.email || 'unknown'}</p>
                            </div>

                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-red-400/80 mb-3">
                                    Session Control
                                </p>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full border border-red-500/30 text-red-400 rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-red-500/10 transition-colors"
                                >
                                    {confirmLogout ? 'Click Again To Logout' : 'Logout'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
