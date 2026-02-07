import React, { useEffect, useMemo, useState } from 'react';
import { useXP, LEAGUES_DATA, LEAGUE_NAMES } from '../../context/XPContext';
import { MAJOR_MARKS } from '../../data/marksData';
import { SettingsModal } from './SettingsModal';
import { resolvePosterCandidates } from '../../lib/posterCandidates';
import { PROGRESS_EASING, getProgressFill, getProgressTransitionMs } from '../../lib/progressVisuals';
import { GearIcon } from '../../components/icons/GearIcon';
import { MarkBadge } from '../marks/MarkBadge';

interface ProfileViewProps {
    onClose: () => void;
    startInSettings?: boolean;
}

type FilmCommentSummary = {
    movieId: number;
    title: string;
    count: number;
    lastDate: string;
    lastText: string;
    genre?: string;
    posterPath?: string;
};

const CommentFilmPoster: React.FC<{ movieId: number; posterPath?: string; title: string }> = ({ movieId, posterPath, title }) => {
    const [candidateIndex, setCandidateIndex] = useState(0);
    const candidates = useMemo(
        () => resolvePosterCandidates(movieId, posterPath, 'w200'),
        [movieId, posterPath]
    );

    useEffect(() => {
        setCandidateIndex(0);
    }, [movieId, posterPath]);

    const currentSrc = candidates[candidateIndex] ?? null;

    if (!currentSrc) {
        return (
            <div className="w-16 h-24 bg-white/5 border border-white/10 rounded-md flex items-center justify-center text-[9px] uppercase tracking-[0.18em] text-sage/60">
                {title.slice(0, 2)}
            </div>
        );
    }

    return (
        <img
            src={currentSrc}
            alt={title}
            referrerPolicy="origin"
            className="w-16 h-24 object-cover rounded-md border border-white/10 bg-[#0f0f0f]"
            onError={() => {
                const next = candidateIndex + 1;
                if (next < candidates.length) {
                    setCandidateIndex(next);
                }
            }}
        />
    );
};

export const ProfileView: React.FC<ProfileViewProps> = ({ onClose, startInSettings = false }) => {
    const {
        xp,
        league,
        progressPercentage,
        marks,
        daysPresent,
        streak,
        featuredMarks,
        toggleFeaturedMark,
        dailyRituals,
        nextLevelXP,
        fullName,
        username,
        gender,
        birthDate,
        bio,
        avatarId,
        updateIdentity,
        deleteRitual,
        user,
        logout,
        updateAvatar,
        avatarUrl
    } = useXP();
    const [isVisible, setIsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [tempBio, setTempBio] = useState(bio);
    const [tempAvatar, setTempAvatar] = useState(avatarId);
    const [showSettings, setShowSettings] = useState(false);
    const progressFill = getProgressFill(progressPercentage);
    const progressTransitionMs = getProgressTransitionMs(progressPercentage);
    const genderLabel = gender === 'female'
        ? 'Kadin'
        : gender === 'male'
            ? 'Erkek'
            : gender === 'non_binary'
                ? 'Non-binary'
                : gender === 'prefer_not_to_say'
                    ? 'Belirtmek istemiyor'
                    : '';

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleDeleteRitual = (ritualId: string) => {
        deleteRitual(String(ritualId));
    };

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

    const commentedFilms = useMemo<FilmCommentSummary[]>(() => {
        const filmMap = new Map<number, FilmCommentSummary>();
        for (const ritual of dailyRituals) {
            const existing = filmMap.get(ritual.movieId);
            if (!existing) {
                filmMap.set(ritual.movieId, {
                    movieId: ritual.movieId,
                    title: ritual.movieTitle || `Film #${ritual.movieId}`,
                    count: 1,
                    lastDate: ritual.date,
                    lastText: ritual.text,
                    genre: ritual.genre,
                    posterPath: ritual.posterPath
                });
                continue;
            }
            existing.count += 1;
            if (ritual.date >= existing.lastDate) {
                existing.lastDate = ritual.date;
                existing.lastText = ritual.text;
                existing.genre = ritual.genre || existing.genre;
                existing.posterPath = ritual.posterPath || existing.posterPath;
                existing.title = ritual.movieTitle || existing.title;
            }
        }

        return Array.from(filmMap.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.lastDate.localeCompare(a.lastDate);
        });
    }, [dailyRituals]);

    const mostWrittenFilm = commentedFilms[0];


    useEffect(() => {
        setIsVisible(true);
        setTempBio(bio);
        setTempAvatar(avatarId);
        return () => setIsVisible(false);
    }, [bio, avatarId]);

    useEffect(() => {
        if (startInSettings) {
            setShowSettings(true);
        }
    }, [startInSettings]);

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

    return (
        <div
            className={`fixed inset-0 z-50 bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center overflow-y-auto transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Home Button (Top Left) */}
            <button
                onClick={handleClose}
                className="absolute top-3 left-3 sm:top-8 sm:left-8 text-[10px] sm:text-xs tracking-widest uppercase transition-colors z-50 p-2 sm:p-3 font-bold hover:scale-105"
                style={{ color: 'var(--color-highlight)' }}
                aria-label="Ana sayfaya don"
                title="Ana sayfaya don"
            >
                🏠
            </button>

            <div className="absolute top-3 right-3 sm:top-8 sm:right-8 z-50 flex items-center gap-1.5 sm:gap-2">
                <button
                    onClick={() => setShowSettings(true)}
                    className="h-9 w-9 rounded-full border border-sage/30 hover:border-clay/60 text-clay/80 hover:text-clay transition-colors flex items-center justify-center bg-[#1A1A1A]/80"
                    title="Settings"
                    aria-label="Open settings"
                >
                    <GearIcon className="w-4 h-4" />
                </button>
                <button
                    onClick={logout}
                    className="text-[9px] sm:text-[10px] tracking-widest uppercase text-red-400/60 hover:text-red-400 transition-colors p-2 sm:p-3 font-bold"
                >
                    Sign Out
                </button>
            </div>

            {/* Content Container - Two Column Layout */}
            <div className="w-full max-w-7xl px-4 sm:px-6 md:px-12 pb-16 pt-20 sm:pt-24">
                {/* Header - 180 Absolute Cinema */}
                <header className="mb-12 text-center animate-fade-in">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-sage mb-3 drop-shadow-sm">180</h1>
                    <p className="text-clay font-medium tracking-[0.2em] text-xs md:text-sm uppercase">Absolute Cinema</p>
                </header>

                {/* Two Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
                    {/* LEFT COLUMN - User Card, DNA, Stats */}
                    <div className="space-y-6">
                        {/* User Identity Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-slide-up">
                            <div className="flex flex-col items-center">
                                {/* Avatar with Settings Icon */}
                                <div className="relative mb-4">
                                    <div
                                        className="w-24 h-24 rounded-full border border-gray-200/10 flex items-center justify-center bg-white/5 shadow-sm relative group overflow-hidden"
                                        onClick={() => isEditing && fileInputRef.current?.click()}
                                    >
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
                                                className="w-full h-full object-cover transition-all duration-700 hover:scale-105"
                                            />
                                        ) : (
                                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl text-sage/50 font-serif italic ${avatarId === 'geo_1' ? 'bg-sage/10' : avatarId === 'geo_2' ? 'bg-clay/10' : 'bg-gray-50/5'}`}>
                                                {avatarId === 'geo_1' ? 'I' : avatarId === 'geo_2' ? 'II' : avatarId === 'geo_3' ? 'III' : 'IV'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Settings Icon */}
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#1A1A1A] hover:bg-clay/10 rounded-full flex items-center justify-center border border-sage/20 hover:border-clay/30 transition-all hover:scale-110"
                                        title="Ayarlar"
                                    >
                                        <GearIcon className="w-4 h-4 text-clay/80" />
                                    </button>
                                </div>

                                {/* Username & Bio */}
                                <h2 className="text-xl tracking-widest font-bold text-[#E5E4E2]/90 mb-2">
                                    {user?.name ? user.name.toUpperCase() : 'KÜRATÖR'}
                                </h2>
                                <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-1">
                                    @{username || 'observer'}
                                </p>
                                <p className="text-[10px] text-gray-500 mb-4 text-center">
                                    {fullName || 'Isim belirtilmedi'} | {genderLabel || 'Cinsiyet belirtilmedi'} | {birthDate || 'Dogum tarihi yok'}
                                </p>

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
                                <div className="text-xs tracking-[0.2em] text-[#E5E4E2]/60 mb-4 uppercase">
                                    {league} · {Math.floor(xp)} XP
                                </div>

                                {/* XP Progress Bar */}
                                <div className="w-full">
                                    <div className="flex justify-between items-end mb-2 text-[9px]">
                                        <span className="font-bold text-sage tracking-wider uppercase">
                                            {LEAGUES_DATA[LEAGUE_NAMES[LEAGUE_NAMES.indexOf(league) + 1]]?.name || 'Max'}
                                        </span>
                                        <span className="font-mono text-sage/60">
                                            {Math.floor(nextLevelXP - xp)} XP
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-[#1A1A1A] rounded-full overflow-hidden border border-white/5 relative">
                                        <div
                                            className="h-full relative"
                                            style={{
                                                width: `${progressPercentage}%`,
                                                background: progressFill,
                                                transitionProperty: 'width, background',
                                                transitionDuration: `${progressTransitionMs}ms`,
                                                transitionTimingFunction: PROGRESS_EASING
                                            }}
                                        >
                                            <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/50 blur-[1px] animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cinematic DNA Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase mb-4">Cinematic DNA</h3>

                            <div className="flex justify-center items-end h-32 gap-4 bg-white/5 border border-white/5 rounded p-4 relative overflow-hidden">
                                {topGenres.length > 0 ? (
                                    topGenres.map(([genre, count]) => {
                                        const percentage = (count / totalGenres);
                                        const height = Math.max(20, percentage * 100);

                                        return (
                                            <div key={genre} className="flex flex-col items-center gap-2 z-10 flex-1 group/bar">
                                                <div className="relative w-full flex justify-center items-end h-full">
                                                    <div
                                                        className="w-2 bg-sage shadow-[0_0_10px_rgba(138,154,91,0.5)] transition-all duration-1000 ease-out relative rounded-t-sm group-hover/bar:w-3"
                                                        style={{ height: `${height}%` }}
                                                    >
                                                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/50 blur-[2px] animate-pulse"></div>
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[9px] font-bold text-[#E5E4E2] tracking-wider uppercase">
                                                        {genre}
                                                    </div>
                                                    <div className="text-[8px] font-mono text-gray-500">
                                                        {Math.round(percentage * 100)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex items-end justify-center gap-1 h-full">
                                        {[...Array(8)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-sage/20 rounded-t animate-pulse"
                                                style={{
                                                    height: `${20 + Math.random() * 60}%`,
                                                    animationDelay: `${i * 0.1}s`,
                                                    animationDuration: `${1 + Math.random()}s`
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase mb-4">Stats</h3>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="flex flex-col gap-1">
                                    <span className="text-4xl font-bold text-sage">{streak || 0}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">Streak</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-4xl font-bold text-sage">{daysPresent}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">Days</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-4xl font-bold text-sage">{dailyRituals.length}</span>
                                    <span className="text-[9px] tracking-wider text-gray-500 uppercase">Rituals</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Activity & Vault */}
                    <div className="space-y-6">
                        {/* Activity Pulse */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">Activity Pulse</h3>
                                <span className="text-[9px] tracking-wider text-gray-500 uppercase">
                                    Profile Feed
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">Comments</div>
                                    <div className="text-2xl font-bold text-sage">{dailyRituals.length}</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">Films</div>
                                    <div className="text-2xl font-bold text-sage">{commentedFilms.length}</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">Top Genre</div>
                                    <div className="text-sm font-bold text-[#E5E4E2] uppercase">
                                        {topGenres[0]?.[0] || 'None'}
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mb-1">Most Written</div>
                                    <div className="text-sm font-bold text-[#E5E4E2] line-clamp-1">
                                        {mostWrittenFilm?.title || 'No records'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Commented Films Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">Commented Films</h3>
                                <span className="text-[9px] tracking-wider text-gray-500">
                                    {commentedFilms.length} Titles
                                </span>
                            </div>

                            {commentedFilms.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {commentedFilms.slice(0, 6).map((film) => (
                                        <article key={film.movieId} className="bg-white/5 border border-white/10 rounded-lg p-3 flex gap-3 hover:border-sage/20 transition-colors">
                                            <CommentFilmPoster movieId={film.movieId} posterPath={film.posterPath} title={film.title} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h4 className="text-xs font-bold tracking-wide text-[#E5E4E2] uppercase line-clamp-2">
                                                        {film.title}
                                                    </h4>
                                                    <span className="text-[10px] font-mono text-sage whitespace-nowrap">
                                                        x{film.count}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-serif italic text-gray-400 line-clamp-2 leading-relaxed">
                                                    "{film.lastText}"
                                                </p>
                                                <div className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-widest text-gray-500">
                                                    <span>{film.lastDate}</span>
                                                    {film.genre && <span className="text-sage/70">{film.genre}</span>}
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-[10px] text-gray-600 font-serif italic border border-dashed border-gray-800 rounded">
                                    No commented films yet. Your next ritual will start this archive.
                                </div>
                            )}
                        </div>

                        {/* The Vault Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">The Vault</h3>
                                <span className="text-[9px] tracking-wider text-gray-500">
                                    {featuredMarks.length}/3 Featured
                                </span>
                            </div>

                            {categories.map(category => (
                                <div key={category} className="mb-8">
                                    <div className="text-[9px] tracking-[0.2em] text-gray-500 uppercase mb-3 pl-1">
                                        {category} Marks
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-x-2 sm:gap-x-3 gap-y-4 sm:gap-y-5">
                                        {MAJOR_MARKS.filter(m => m.category === category).map(mark => {
                                            const isUnlocked = marks.includes(mark.id);
                                            const isFeatured = featuredMarks.includes(mark.id);
                                            const isClay = ['180_exact', 'genre_discovery', 'echo_initiate'].includes(mark.id);

                                            return (
                                                <div
                                                    key={mark.id}
                                                    className="relative group flex flex-col items-center justify-start min-h-[112px] cursor-pointer px-1"
                                                    onClick={() => {
                                                        if (isUnlocked) toggleFeaturedMark(mark.id);
                                                    }}
                                                >
                                                    <div
                                                        className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all duration-700 bg-[var(--color-bg)] z-10
                                                            ${isUnlocked
                                                                ? isFeatured
                                                                    ? 'border-sage/60 text-sage shadow-[0_0_15px_rgba(138,154,91,0.1)] scale-105'
                                                                    : isClay
                                                                        ? 'border-clay/40 text-clay/80'
                                                                        : 'border-sage/40 text-sage/80'
                                                                : 'border-sage/10 text-sage/20'
                                                            }
                                                        `}
                                                    >
                                                        <MarkBadge
                                                            mark={mark}
                                                            size={18}
                                                            imageClassName={`w-8 h-8 rounded-lg object-cover ${isUnlocked ? 'opacity-95' : 'opacity-30 grayscale'}`}
                                                        />

                                                        {isFeatured && (
                                                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-sage rounded-full animate-pulse" />
                                                        )}
                                                    </div>

                                                    <div className="mt-2 flex flex-col items-center gap-1.5 w-full">
                                                        <span className={`text-[9px] font-sans font-bold tracking-wider uppercase text-center leading-none ${isUnlocked ? 'text-[#E5E4E2]/90' : 'text-[#E5E4E2]/60'}`}>
                                                            {mark.title}
                                                        </span>
                                                        <span className={`text-[9px] text-center leading-[1.25] max-w-[116px] ${isUnlocked ? 'text-[#E5E4E2]/72' : 'text-[#E5E4E2]/46'}`}>
                                                            Kazanim: {mark.description}
                                                        </span>
                                                        <span className={`text-[8px] tracking-[0.14em] uppercase ${isUnlocked ? 'text-clay/70' : 'text-gray-600'}`}>
                                                            {isUnlocked ? 'Unlocked' : 'Locked'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Memory Log Card */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-6 animate-fade-in">
                            <div className="flex justify-between items-end mb-6 border-b border-gray-100/10 pb-4">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-sage uppercase">Memory Log</h3>
                                <span className="text-[9px] tracking-wider text-gray-500">
                                    {dailyRituals.length} Records
                                </span>
                            </div>

                            <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                {dailyRituals.length > 0 ? (
                                    dailyRituals.map((ritual) => (
                                        <div key={ritual.id} className="group relative bg-white/5 border border-white/5 p-4 rounded hover:border-sage/20 transition-colors">
                                            <div className="flex justify-between items-start mb-2 gap-3">
                                                <span className="text-xs font-bold text-[#E5E4E2] tracking-wider uppercase">
                                                    {ritual.movieTitle}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">
                                                        {ritual.date}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteRitual(ritual.id)}
                                                        className="text-[9px] tracking-widest uppercase text-gray-500 hover:text-clay transition-colors"
                                                        title="Delete this ritual"
                                                    >
                                                        Erase
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs font-serif text-gray-400 italic line-clamp-2 leading-relaxed">
                                                "{ritual.text}"
                                            </p>
                                            {ritual.genre && (
                                                <div className="flex items-center gap-2 mt-3">
                                                    <span className="text-[9px] tracking-widest uppercase text-gray-600 border border-white/5 px-1.5 py-0.5 rounded">
                                                        {ritual.genre}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-[10px] text-gray-600 font-serif italic border border-dashed border-gray-800 rounded">
                                        The pages are empty. <br /> Submit a ritual to begin your log.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};
