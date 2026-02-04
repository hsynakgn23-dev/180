import React, { useEffect, useState } from 'react';
import { useXP, LEAGUES_DATA, LEAGUE_NAMES } from '../../context/XPContext';
import { MAJOR_MARKS } from '../../data/marksData';
import { SettingsModal } from './SettingsModal';

interface ProfileViewProps {
    onClose: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onClose }) => {
    const { xp, league, progressPercentage, marks, daysPresent, streak, featuredMarks, toggleFeaturedMark, echoHistory, dailyRituals, nextLevelXP, bio, avatarId, updateIdentity, user, logout, updateAvatar, avatarUrl } = useXP();
    const [isVisible, setIsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [tempBio, setTempBio] = useState(bio);
    const [tempAvatar, setTempAvatar] = useState(avatarId);
    const [showSettings, setShowSettings] = useState(false);

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

    // Calculate DNA (Genre Stats)
    const genreCounts: Record<string, number> = {};
    let totalGenres = 0;
    dailyRituals.forEach(r => {
        if (r.genre) {
            genreCounts[r.genre] = (genreCounts[r.genre] || 0) + 1;
            totalGenres++;
        }
    });

    // Sort by count and take top 3
    const topGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);


    useEffect(() => {
        setIsVisible(true);
        setTempBio(bio);
        setTempAvatar(avatarId);
        return () => setIsVisible(false);
    }, [bio, avatarId]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 500); // Wait for fade out
    };

    const handleSaveIdentity = () => {
        updateIdentity(tempBio, tempAvatar);
        setIsEditing(false);
    };

    // Helper: Sort marks by category
    const categories = ['Presence', 'Writing', 'Rhythm', 'Discovery', 'Ritual', 'Social', 'Legacy'] as const;
    const AVATARS = ['geo_1', 'geo_2', 'geo_3', 'geo_4'];

    return (
        <div
            className={`fixed inset-0 z-50 bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center overflow-y-auto transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Sign Out Button (Top Left) */}
            <button
                onClick={logout}
                className="absolute top-8 left-8 text-[10px] tracking-widest uppercase text-red-400/60 hover:text-red-400 transition-colors z-50 p-4 font-bold"
            >
                Sign Out
            </button>

            {/* Settings & Close Buttons (Top Right) */}
            <div className="absolute top-8 right-8 flex items-center gap-4 z-50">
                <button
                    onClick={() => setShowSettings(true)}
                    className="text-sage/60 hover:text-sage transition-all p-3 hover:scale-110 hover:rotate-90 transform duration-300"
                    title="Ayarlar"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>
                <button
                    onClick={handleClose}
                    className="text-xs tracking-widest uppercase transition-colors p-4 font-bold hover:scale-105"
                    style={{ color: 'var(--color-highlight)' }}
                >
                    Close
                </button>
            </div>

            {/* Content Container */}
            <div className="w-full max-w-lg px-8 pb-16 flex flex-col items-center">
                {/* 1. Breath Zone (120px) */}
                <div className="h-[80px] w-full shrink-0" />

                {/* Header - 180 Absolute Cinema */}
                <header className="mb-12 text-center animate-fade-in">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-sage mb-3 drop-shadow-sm">180</h1>
                    <p className="text-clay font-medium tracking-[0.2em] text-xs md:text-sm uppercase">Absolute Cinema</p>
                </header>

                {/* 2. Identity Block */}
                <div className="flex flex-col items-center animate-slide-up mb-8 w-full">
                    {/* Avatar Loop */}
                    <div
                        className="w-24 h-24 rounded-full border border-gray-200/10 mb-6 flex items-center justify-center bg-white/5 shadow-sm relative group overflow-hidden"
                        onClick={() => isEditing && fileInputRef.current?.click()}
                    >
                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload}
                        />

                        {isEditing && (
                            <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[9px] uppercase tracking-widest text-white/80 font-bold">Upload</span>
                            </div>
                        )}

                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="User Avatar"
                                className="w-full h-full object-cover grayscale opacity-80 hover:opacity-100 transition-all duration-700 hover:scale-105"
                            />
                        ) : isEditing ? (
                            <div className="grid grid-cols-2 gap-1 absolute inset-0 bg-[#121212] z-10 p-1">
                                {AVATARS.map(av => (
                                    <button
                                        key={av}
                                        onClick={(e) => { e.stopPropagation(); setTempAvatar(av); }}
                                        className={`rounded-full border ${tempAvatar === av ? 'border-sage bg-sage/20' : 'border-white/5 hover:border-sage/50'}`}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl text-sage/50 font-serif italic ${avatarId === 'geo_1' ? 'bg-sage/10' : avatarId === 'geo_2' ? 'bg-clay/10' : 'bg-gray-50/5'}`}>
                                {avatarId === 'geo_1' ? 'I' : avatarId === 'geo_2' ? 'II' : avatarId === 'geo_3' ? 'III' : 'IV'}
                            </div>
                        )}
                    </div>

                    {/* Username & Bio */}
                    <h2 className="text-xl tracking-widest font-bold text-[#E5E4E2]/90 mb-2">
                        {user?.name ? user.name.toUpperCase() : 'KÜRATÖR'}
                    </h2>

                    {isEditing ? (
                        <div className="flex flex-col items-center gap-2 w-full mb-4">
                            <textarea
                                value={tempBio}
                                onChange={(e) => setTempBio(e.target.value)}
                                maxLength={180}
                                className="w-full bg-[#1A1A1A] border border-sage/30 p-2 text-xs text-center font-serif text-[#E5E4E2] focus:outline-none focus:border-sage rounded"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <button onClick={handleSaveIdentity} className="text-[9px] uppercase tracking-widest text-[#121212] bg-sage px-3 py-1 rounded font-bold hover:opacity-90">
                                    Save
                                </button>
                                <button onClick={() => setIsEditing(false)} className="text-[9px] uppercase tracking-widest text-gray-500 px-3 py-1 hover:text-white">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 mb-4 group cursor-pointer" onClick={() => setIsEditing(true)}>
                            <p className="text-xs font-serif italic text-sage/60 text-center max-w-xs leading-relaxed">
                                "{bio}"
                            </p>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] tracking-[0.2em] text-gray-600 uppercase">
                                Edit Identity
                            </span>
                        </div>
                    )}


                    {/* League & XP */}
                    <div className="text-xs tracking-[0.2em] text-[#E5E4E2]/60 mb-8 uppercase">
                        {league} · {Math.floor(xp)} XP
                    </div>

                    {/* Cinematic DNA (Frequency Wave) */}
                    <div className="w-full mb-12 animate-fade-in delay-100 relative group">
                        {/* Header */}
                        <div className="flex justify-between items-end mb-4 px-2">
                            <h3 className="text-xs font-bold tracking-[0.2em] text-[#E5E4E2]/60 uppercase">
                                Cinematic DNA
                            </h3>
                            {topGenres.length > 0 && (
                                <span className="text-[10px] font-serif italic text-sage/80 animate-pulse">
                                    "Your cinematic frequency is tuned to {topGenres[0][0]}."
                                </span>
                            )}
                        </div>

                        {/* Wave Chart Container */}
                        <div className="flex justify-center items-end h-24 gap-3 bg-white/5 border border-white/5 rounded-sm p-4 relative overflow-hidden">
                            {/* Background Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between py-4 opacity-10 pointer-events-none">
                                <div className="w-full h-px bg-sage/30"></div>
                                <div className="w-full h-px bg-sage/30"></div>
                                <div className="w-full h-px bg-sage/30"></div>
                            </div>

                            {topGenres.length > 0 ? (
                                topGenres.map(([genre, count]) => {
                                    const percentage = (count / totalGenres);
                                    const height = Math.max(20, percentage * 100);

                                    return (
                                        <div key={genre} className="flex flex-col items-center gap-2 z-10 w-1/4 group/bar">
                                            {/* Frequency Bar */}
                                            <div className="relative w-full flex justify-center items-end h-full">
                                                {/* The Bar */}
                                                <div
                                                    className="w-1 bg-[#8A9A5B] shadow-[0_0_10px_rgba(138,154,91,0.5)] transition-all duration-1000 ease-out relative rounded-t-sm group-hover/bar:w-2 group-hover/bar:bg-[#A3B18A]"
                                                    style={{ height: `${height}%` }}
                                                >
                                                    {/* Pulse Effect */}
                                                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/50 blur-[2px] animate-pulse"></div>
                                                </div>
                                            </div>

                                            {/* Labels */}
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-[#E5E4E2] tracking-wider uppercase opacity-80 group-hover/bar:opacity-100 transition-opacity">
                                                    {genre}
                                                </div>
                                                <div className="text-[8px] font-mono text-gray-500 opacity-60">
                                                    {Math.round(percentage * 100)}%
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[9px] text-gray-600 font-serif italic">No frequency detected.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. XP Bar Integration */}
                <div className="w-full mb-16 animate-fade-in delay-100 px-4">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[9px] font-bold text-sage tracking-[0.2em] uppercase">
                            Progress to {LEAGUES_DATA[LEAGUE_NAMES[LEAGUE_NAMES.indexOf(league) + 1]]?.name || 'Infinity'}
                        </span>
                        <span className="text-[9px] font-mono text-sage/60">
                            {Math.floor(nextLevelXP - xp)} XP Remaining
                        </span>
                    </div>
                    <div className="h-1 w-full bg-[#1A1A1A] rounded-full overflow-hidden border border-white/5 relative">
                        {/* Background Track */}
                        <div className="absolute inset-0 bg-sage/5"></div>

                        {/* Fill Bar */}
                        <div
                            className="h-full bg-gradient-to-r from-sage/40 to-sage transition-all duration-1000 ease-out relative"
                            style={{ width: `${progressPercentage}%` }}
                        >
                            <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/50 blur-[1px] animate-pulse"></div>
                        </div>
                    </div>
                </div>

                {/* 4. Stats (Reference Info) */}
                <div className="flex gap-16 text-center animate-fade-in delay-200 mb-16">
                    {/* Streak (New) */}
                    <div className="flex flex-col gap-2">
                        <span className="text-2xl font-serif text-[#E5E4E2]">{streak || 0}</span>
                        <span className="text-[9px] tracking-[0.2em] text-gray-500 uppercase">Streak</span>
                    </div>

                    {/* Days Present (Real) */}
                    <div className="flex flex-col gap-2">
                        <span className="text-2xl font-serif text-[#E5E4E2]">{daysPresent}</span>
                        <span className="text-[9px] tracking-[0.2em] text-gray-500 uppercase">Days</span>
                    </div>

                    {/* Rituals/Followers - Keeping balanced layout */}
                    <div className="flex flex-col gap-2">
                        <span className="text-2xl font-serif text-[#E5E4E2]">0</span>
                        <span className="text-[9px] tracking-[0.2em] text-gray-500 uppercase">Followers</span>
                    </div>
                </div>

                {/* Memory Log (New) */}
                <div className="w-full mb-16 animate-fade-in delay-200">
                    <div className="flex justify-between items-end mb-8 border-b border-gray-100/10 pb-4">
                        <h3 className="text-xs font-bold tracking-[0.3em] text-[#E5E4E2]/40 uppercase">
                            Memory Log
                        </h3>
                        <span className="text-[9px] tracking-[0.1em] text-gray-500">
                            {dailyRituals ? dailyRituals.length : 0} Records
                        </span>
                    </div>

                    <div className="flex flex-col gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {dailyRituals && dailyRituals.length > 0 ? (
                            dailyRituals.map((ritual) => (
                                <div key={ritual.id} className="group relative bg-white/5 border border-white/5 p-4 rounded-sm hover:border-sage/20 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-[#E5E4E2] tracking-wider uppercase">
                                            {ritual.movieTitle}
                                        </span>
                                        <span className="text-[10px] font-mono text-gray-500">
                                            {ritual.date}
                                        </span>
                                    </div>
                                    <p className="text-xs font-serif text-gray-400 italic line-clamp-2 leading-relaxed">
                                        "{ritual.text}"
                                    </p>
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="text-[9px] tracking-widest uppercase text-sage/60 border border-sage/10 px-1.5 py-0.5 rounded">
                                            Memory: {ritual.movieTitle}
                                        </span>
                                        {ritual.genre && (
                                            <span className="text-[9px] tracking-widest uppercase text-gray-600 border border-white/5 px-1.5 py-0.5 rounded">
                                                {ritual.genre}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-[10px] text-gray-600 font-serif italic border border-dashed border-gray-800 rounded">
                                The pages are empty. <br /> Submit a ritual to begin your log.
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Echo History (New) */}
                <div className="w-full mb-16 animate-fade-in delay-200">
                    <h3 className="text-xs font-bold tracking-[0.3em] text-[#E5E4E2]/40 uppercase text-center mb-8 border-b border-gray-100/10 pb-4">
                        Echo History
                    </h3>
                    <div className="flex flex-col gap-3">
                        {echoHistory && echoHistory.length > 0 ? (
                            echoHistory.map((log) => (
                                <div key={log.id} className="flex justify-between items-center text-[10px] text-gray-400 font-mono tracking-wide px-4 py-2 bg-white/5 border border-gray-100/10 rounded">
                                    <span className="text-[#E5E4E2] font-bold">Echo Received</span>
                                    <span>{log.movieTitle || 'Unknown Ritual'}</span>
                                    <span className="opacity-50">{log.date}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-[10px] text-gray-500 font-serif italic py-4">
                                No echoes heard explicitly yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* 6. The Vault (Updated with Pinning) */}
                <div className="w-full animate-fade-in delay-300">
                    <div className="flex justify-between items-end mb-8 border-b border-gray-100/10 pb-4">
                        <h3 className="text-xs font-bold tracking-[0.3em] text-[#E5E4E2]/40 uppercase">
                            The Vault
                        </h3>
                        <span className="text-[9px] tracking-[0.1em] text-gray-500">
                            {featuredMarks.length}/3 Featured
                        </span>
                    </div>

                    {categories.map(category => (
                        <div key={category} className="mb-12">
                            <div className="text-[9px] tracking-[0.2em] text-gray-500 uppercase mb-6 pl-2 border-l-2 border-transparent">
                                {category} Marks
                            </div>
                            <div className="grid grid-cols-4 gap-x-4 gap-y-12">
                                {MAJOR_MARKS.filter(m => m.category === category).map(mark => {
                                    const isUnlocked = marks.includes(mark.id);
                                    const isFeatured = featuredMarks.includes(mark.id);

                                    // Color logic: Sage or Clay
                                    const isClay = ['180_exact', 'genre_discovery', 'echo_initiate'].includes(mark.id);

                                    return (
                                        <div
                                            key={mark.id}
                                            className="relative group flex flex-col items-center justify-start h-32 cursor-pointer"
                                            onClick={() => {
                                                if (isUnlocked) toggleFeaturedMark(mark.id);
                                            }}
                                        >
                                            <div
                                                className={`w-14 h-14 flex items-center justify-center rounded-xl border transition-all duration-700 bg-[var(--color-bg)] z-10
                                                    ${isUnlocked
                                                        ? isFeatured
                                                            ? 'border-sage/60 text-sage shadow-[0_0_15px_rgba(138,154,91,0.1)] scale-105'
                                                            : isClay
                                                                ? 'border-clay/40 text-clay/80'
                                                                : 'border-sage/40 text-sage/80'
                                                        : 'border-white/5 text-gray-600 opacity-20'
                                                    }
                                                `}
                                            >
                                                <mark.Icon size={22} />

                                                {isFeatured && (
                                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-sage rounded-full animate-pulse" />
                                                )}
                                            </div>

                                            {/* Static Whisper & Memory (Visible if Unlocked) */}
                                            {isUnlocked ? (
                                                <div className="mt-3 flex flex-col items-center gap-1.5 animate-fade-in w-full">
                                                    <span className="text-[10px] font-sans font-bold tracking-widest text-[#E5E4E2]/90 uppercase text-center leading-none">
                                                        {mark.title}
                                                    </span>
                                                    <span className="text-[10px] font-serif italic text-sage/50 text-center leading-tight max-w-[80px]">
                                                        "{mark.whisper}"
                                                    </span>
                                                    <div className="text-[9px] tracking-wider uppercase text-gray-500/50 bg-white/5 px-2 py-0.5 rounded-full mt-1">
                                                        Memory: Fight Club
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[8px] tracking-widest text-gray-700 uppercase">Locked</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Settings Modal */}
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};
