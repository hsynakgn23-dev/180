import React, { useEffect, useState } from 'react';
import { useXP, type RegistrationGender } from '../../context/XPContext';
import { useLanguage } from '../../context/LanguageContext';
import { applyThemeMode, resolveThemeMode, type ThemeMode } from '../../lib/themeMode';
import {
    getRegistrationGenderOptions,
    SUPPORTED_LANGUAGE_OPTIONS,
    type LanguageCode
} from '../../i18n/localization';
import { UI_DICTIONARY } from '../../i18n/dictionary';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'identity' | 'appearance' | 'session';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { user, updateIdentity, updatePersonalInfo, logout, bio, avatarUrl, updateAvatar, avatarId, fullName, username, gender, birthDate } = useXP();
    const { text, language, setLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
    const [bioDraft, setBioDraft] = useState(bio);
    const [fullNameDraft, setFullNameDraft] = useState(fullName);
    const [usernameDraft, setUsernameDraft] = useState(username);
    const [genderDraft, setGenderDraft] = useState<RegistrationGender | ''>(gender || '');
    const [birthDateDraft, setBirthDateDraft] = useState(birthDate);
    const [theme, setTheme] = useState<ThemeMode>('midnight');
    const [statusMessage, setStatusMessage] = useState('');
    const [confirmLogout, setConfirmLogout] = useState(false);
    const genderOptions: Array<{ value: RegistrationGender; label: string }> = getRegistrationGenderOptions(language);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        setBioDraft(bio);
        setFullNameDraft(fullName);
        setUsernameDraft(username);
        setGenderDraft(gender || '');
        setBirthDateDraft(birthDate);
        setStatusMessage('');
        setConfirmLogout(false);

        setTheme(resolveThemeMode());

    }, [isOpen, bio, fullName, username, gender, birthDate]);

    useEffect(() => {
        if (!statusMessage) return;
        const timeout = setTimeout(() => setStatusMessage(''), 2000);
        return () => clearTimeout(timeout);
    }, [statusMessage]);

    const applyTheme = (nextTheme: ThemeMode) => {
        setTheme(nextTheme);
        applyThemeMode(nextTheme);
        setStatusMessage(text.settings.statusThemeUpdated);
    };

    const applyLanguage = (nextLanguage: LanguageCode) => {
        setLanguage(nextLanguage);
        setStatusMessage(UI_DICTIONARY[nextLanguage].settings.statusLanguageSaved);
    };

    const handleSaveIdentity = async () => {
        const profileResult = await updatePersonalInfo({
            fullName: fullNameDraft,
            username: usernameDraft,
            gender: (genderDraft || 'prefer_not_to_say') as RegistrationGender,
            birthDate: birthDateDraft
        });
        if (!profileResult.ok) {
            setStatusMessage(profileResult.message || text.settings.statusIdentitySaveFailed);
            return;
        }
        updateIdentity(bioDraft, avatarId);
        setStatusMessage(profileResult.message || text.settings.statusIdentitySaved);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                updateAvatar(reader.result);
                setStatusMessage(text.settings.statusAvatarUpdated);
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
                            <h2 className="text-lg tracking-[0.22em] uppercase font-bold text-sage">{text.settings.title}</h2>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#E5E4E2]/45 mt-1">
                                {text.settings.subtitle}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[10px] tracking-[0.18em] uppercase border border-white/15 rounded px-3 py-1.5 text-gray-400 hover:text-sage hover:border-sage/35 transition-colors"
                        >
                            {text.settings.close}
                        </button>
                    </div>

                    <div className="flex gap-2 mt-5">
                        {([
                            { id: 'identity', label: text.settings.tabIdentity },
                            { id: 'appearance', label: text.settings.tabAppearance },
                            { id: 'session', label: text.settings.tabSession }
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
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.avatar}</p>
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
                                            {text.settings.uploadAvatar}
                                        </button>
                                        <p className="text-[10px] text-gray-500 mt-2">{text.settings.avatarHint}</p>
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
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.personalInfo}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.fullName}
                                        <input
                                            value={fullNameDraft}
                                            onChange={(e) => setFullNameDraft(e.target.value)}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none"
                                            placeholder={text.login.fullNamePlaceholder}
                                        />
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.username}
                                        <input
                                            value={usernameDraft}
                                            onChange={(e) => setUsernameDraft(e.target.value.trim())}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none"
                                            placeholder={text.login.usernamePlaceholder}
                                        />
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.gender}
                                        <select
                                            value={genderDraft}
                                            onChange={(e) => setGenderDraft(e.target.value as RegistrationGender | '')}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] focus:border-sage/40 outline-none"
                                        >
                                            <option value="">{text.settings.select}</option>
                                            {genderOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.birthDate}
                                        <input
                                            type="date"
                                            value={birthDateDraft}
                                            onChange={(e) => setBirthDateDraft(e.target.value)}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] focus:border-sage/40 outline-none"
                                        />
                                    </label>
                                </div>
                                <p className="mt-3 text-[10px] text-gray-500">{text.settings.usernameHint}</p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <label className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2 block">
                                    {text.settings.bio} ({bioDraft.length}/180)
                                </label>
                                <textarea
                                    value={bioDraft}
                                    onChange={(e) => setBioDraft(e.target.value.slice(0, 180))}
                                    rows={4}
                                    className="w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none resize-none"
                                    placeholder={text.settings.bioPlaceholder}
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveIdentity}
                                    className="mt-4 w-full bg-sage text-[#121212] rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity"
                                >
                                    {text.settings.saveIdentity}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.theme}</p>
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
                                        <div className="theme-swatch-midnight h-10 rounded bg-[#121212] border border-white/10 mb-2" />
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text)]">{text.settings.themeMidnight}</p>
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
                                        <div className="theme-swatch-dawn h-10 rounded bg-[#FDFCF8] border border-[#d8d4cc] mb-2" />
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text)]">{text.settings.themeDawn}</p>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.language}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {SUPPORTED_LANGUAGE_OPTIONS.map((option) => (
                                        <button
                                            key={option.code}
                                            type="button"
                                            onClick={() => applyLanguage(option.code)}
                                            className={`px-4 py-2 rounded border text-[10px] uppercase tracking-[0.18em] transition-colors ${
                                                language === option.code
                                                    ? 'border-sage bg-sage/10 text-sage'
                                                    : 'border-white/10 text-gray-400 hover:border-sage/30 hover:text-sage'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'session' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">{text.settings.activeAccount}</p>
                                <p className="text-sm font-bold text-[#E5E4E2]">{user?.name || text.profileWidget.observer}</p>
                                <p className="text-xs text-gray-500 mt-1">{user?.email || text.settings.unknown}</p>
                            </div>

                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-red-400/80 mb-3">
                                    {text.settings.sessionControl}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full border border-red-500/30 text-red-400 rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-red-500/10 transition-colors"
                                >
                                    {confirmLogout ? text.settings.logoutConfirm : text.settings.logout}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
