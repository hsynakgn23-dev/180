import React, { useState } from 'react';
import { useXP } from '../../context/XPContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { user, updateIdentity, logout, bio, avatarUrl, updateAvatar } = useXP();
    const [activeTab, setActiveTab] = useState<'personal' | 'security' | 'preferences' | 'session'>('personal');

    // Personal Info State
    const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] || '');
    const [lastName, setLastName] = useState(user?.name?.split(' ')[1] || '');
    const [username, setUsername] = useState(user?.name || '');
    const [userBio, setUserBio] = useState(bio);

    // Security State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Preferences State
    const [theme, setTheme] = useState<'midnight' | 'dawn'>('midnight');
    const [language, setLanguage] = useState<'tr' | 'en'>('tr');

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    updateAvatar(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSavePersonal = () => {
        updateIdentity(userBio, 'geo_1'); // Keep current avatar ID
        // In real app: update user name via API with firstName + lastName
        onClose();
    };

    const handleChangePassword = () => {
        setPasswordError('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('Tüm alanları doldurun');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Yeni şifre en az 6 karakter olmalı');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Şifreler eşleşmiyor');
            return;
        }

        // In real app: API call to change password
        alert('Şifre başarıyla değiştirildi');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleThemeChange = (newTheme: 'midnight' | 'dawn') => {
        setTheme(newTheme);
        // Toggle body class for theme
        if (newTheme === 'dawn') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    };

    const handleLogout = () => {
        if (confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
            logout();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#121212] border-l border-white/10 z-[70] animate-slide-in-right overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-xl border-b border-white/5 p-6 z-10">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold tracking-wider text-sage">Ayarlar</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-2"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1.5">
                        {[
                            { id: 'personal', label: 'Kimlik' },
                            { id: 'security', label: 'Güvenlik' },
                            { id: 'preferences', label: 'Tercih' },
                            { id: 'session', label: 'Oturum' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-wider font-bold rounded transition-colors ${activeTab === tab.id
                                    ? 'bg-sage text-[#121212]'
                                    : 'bg-white/5 text-gray-400 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Personal Info Tab */}
                    {activeTab === 'personal' && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-widest text-sage/60 uppercase mb-4">Kişisel Bilgiler</h3>

                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center gap-4 p-6 bg-white/5 rounded-lg border border-white/5">
                                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-sage/20 relative group cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}>
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-sage/10 flex items-center justify-center text-sage text-2xl font-bold">
                                            {username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs text-white uppercase tracking-wider">Değiştir</span>
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

                            {/* Name Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Ad</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full bg-[#1A1A1A] border border-white/10 px-4 py-2 text-sm text-white focus:border-sage outline-none rounded transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Soyad</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="w-full bg-[#1A1A1A] border border-white/10 px-4 py-2 text-sm text-white focus:border-sage outline-none rounded transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Username */}
                            <div>
                                <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-white/10 px-4 py-2 text-sm text-white focus:border-sage outline-none rounded transition-colors"
                                />
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">
                                    Biyografi ({userBio.length}/180)
                                </label>
                                <textarea
                                    value={userBio}
                                    onChange={(e) => setUserBio(e.target.value.slice(0, 180))}
                                    rows={4}
                                    className="w-full bg-[#1A1A1A] border border-white/10 px-4 py-2 text-sm text-white focus:border-sage outline-none rounded transition-colors resize-none font-serif"
                                    placeholder="Sinematik yolculuğunuzu anlatın..."
                                />
                            </div>

                            <button
                                onClick={handleSavePersonal}
                                className="w-full bg-sage text-[#121212] font-bold py-3 uppercase tracking-widest text-sm rounded hover:bg-sage/90 transition-colors"
                            >
                                Kaydet
                            </button>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-widest text-sage/60 uppercase mb-4">Şifre Değiştir</h3>

                            <div>
                                <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Mevcut Şifre</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-white/10 px-4 py-2 text-sm text-white focus:border-sage outline-none rounded transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Yeni Şifre</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-white/10 px-4 py-2 text-sm text-white focus:border-sage outline-none rounded transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Yeni Şifre (Tekrar)</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-white/10 px-4 py-2 text-sm text-white focus:border-sage outline-none rounded transition-colors"
                                />
                            </div>

                            {passwordError && (
                                <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-2 rounded">
                                    {passwordError}
                                </div>
                            )}

                            <button
                                onClick={handleChangePassword}
                                className="w-full bg-sage text-[#121212] font-bold py-3 uppercase tracking-widest text-sm rounded hover:bg-sage/90 transition-colors"
                            >
                                Şifreyi Değiştir
                            </button>
                        </div>
                    )}

                    {/* Preferences Tab */}
                    {activeTab === 'preferences' && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-widest text-sage/60 uppercase mb-4">Görünüm & Dil</h3>

                            {/* Theme Selection */}
                            <div>
                                <label className="text-xs uppercase tracking-widest text-gray-400 mb-3 block">Tema</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleThemeChange('midnight')}
                                        className={`p-4 rounded-lg border-2 transition-all ${theme === 'midnight'
                                            ? 'border-sage bg-sage/10'
                                            : 'border-white/10 bg-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="w-full h-16 bg-[#121212] rounded mb-2 border border-white/10" />
                                        <span className="text-xs font-bold tracking-wider text-white">Midnight</span>
                                        <p className="text-[10px] text-gray-500 mt-1">Deep Obsidian</p>
                                    </button>
                                    <button
                                        onClick={() => handleThemeChange('dawn')}
                                        className={`p-4 rounded-lg border-2 transition-all ${theme === 'dawn'
                                            ? 'border-sage bg-sage/10'
                                            : 'border-white/10 bg-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="w-full h-16 bg-[#FDFCF8] rounded mb-2 border border-gray-300" />
                                        <span className="text-xs font-bold tracking-wider text-white">Dawn</span>
                                        <p className="text-[10px] text-gray-500 mt-1">Cream & Sage</p>
                                    </button>
                                </div>
                            </div>

                            {/* Language Selection */}
                            <div>
                                <label className="text-xs uppercase tracking-widest text-gray-400 mb-3 block">Dil / Language</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setLanguage('tr')}
                                        className={`px-6 py-3 rounded border-2 transition-all ${language === 'tr'
                                            ? 'border-sage bg-sage/10 text-white'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        <span className="text-sm font-bold tracking-wider">🇹🇷 Türkçe</span>
                                    </button>
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`px-6 py-3 rounded border-2 transition-all ${language === 'en'
                                            ? 'border-sage bg-sage/10 text-white'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        <span className="text-sm font-bold tracking-wider">🇬🇧 English</span>
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <p className="text-xs text-gray-500 italic">
                                    Dil tercihiniz film detayları ve TMDB verilerini etkiler.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Session Tab */}
                    {activeTab === 'session' && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-widest text-sage/60 uppercase mb-4">Oturum Yönetimi</h3>

                            <div className="p-6 bg-white/5 rounded-lg border border-white/5">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{user?.name || 'Küratör'}</p>
                                        <p className="text-xs text-gray-500">{user?.email || 'observer@180.cinema'}</p>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-400 space-y-1">
                                    <p>Oturum Açma: <span className="text-white">Bugün, 20:00</span></p>
                                    <p>Son Aktivite: <span className="text-white">Az önce</span></p>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold py-3 uppercase tracking-widest text-sm rounded hover:bg-red-500/20 transition-colors"
                            >
                                Çıkış Yap
                            </button>

                            <p className="text-xs text-gray-500 text-center italic">
                                "Seal your cinematic memory"
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
