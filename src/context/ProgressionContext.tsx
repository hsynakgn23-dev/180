import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { MAJOR_MARKS } from '../data/marksData.js';
import { STREAK_MILESTONE_SET } from '../domain/celebrations.js';
import { moderateComment } from '../lib/commentModeration.js';
import { loadUserProgression, mutateRitual, mutateXP } from '../lib/supabase/progression.js';

import { useAuth } from './AuthContext.js';
import {
    compactStateForPersistence,
    persistUserRitualBackupToLocal,
    persistUserXpStateToLocal,
    readUserRitualBackupFromLocal,
    readUserXpStateFromLocal,
} from './xpShared/persistence.js';
import {
    applyXPDelta,
    buildInitialXPState,
    getLeagueIndexFromXp,
    getLocalDateKey,
    KNOWN_MOVIES_BY_ID,
    LEAGUE_NAMES,
    LEAGUES_DATA,
    LEVEL_THRESHOLD,
    LONG_FORM_RITUAL_THRESHOLD,
    MAX_DAILY_DWELL_XP,
    mergeRitualLogs,
    mergeStringLists,
    mergeXPStates,
    parseDateKeyToDayIndex,
    ritualFingerprint,
    SHARE_REWARD_XP,
} from './xpShared/state.js';
import type {
    AuthResult,
    EchoLog,
    LeagueInfo,
    RitualLog,
    SharePromptEvent,
    ShareRewardTrigger,
    StreakCelebrationEvent,
    XPState,
} from './xpShared/types.js';

export type ProgressionContextValue = {
    // State
    state: XPState;
    setState: React.Dispatch<React.SetStateAction<XPState>>;
    updateState: (update: Partial<XPState> | ((prev: XPState) => Partial<XPState>)) => void;
    isXpHydrated: boolean;

    // UI state
    whisper: string | null;
    triggerWhisper: (message: string) => void;
    levelUpEvent: LeagueInfo | null;
    closeLevelUp: () => void;
    streakCelebrationEvent: StreakCelebrationEvent | null;
    closeStreakCelebration: () => void;
    sharePromptEvent: SharePromptEvent | null;
    dismissSharePrompt: () => void;

    // Mark/streak helpers exposed for profile flows
    tryUnlockMark: (markId: string, currentMarks: string[]) => string[];
    getToday: () => string;

    // Capability flag refs needed by profile-side cloud writes
    canWriteFollowRef: React.MutableRefObject<boolean>;

    // Progression methods
    applyQuizProgress: (input: {
        totalXP: number | null;
        streak: number | null;
        dateKey: string;
        streakProtectedNow: boolean;
    }) => void;
    submitRitual: (
        movieId: number,
        text: string,
        rating: number,
        genre: string,
        title?: string,
        posterPath?: string,
    ) => AuthResult;
    deleteRitual: (ritualId: string) => void;
    echoRitual: (ritualId: string) => void;
    receiveEcho: (movieTitle?: string) => void;
    awardShareXP: (
        platform: 'instagram' | 'tiktok' | 'x',
        trigger: ShareRewardTrigger,
    ) => AuthResult;
    debugAddXP: (amount: number) => void;
    debugUnlockMark: (markId: string) => void;
    toggleFeaturedMark: (markId: string) => void;

    // Derived progression info
    xp: number;
    leagueName: string;
    leagueInfo: LeagueInfo;
    progressPercentage: number;
    nextLevelXP: number;
    daysPresent: number;
    streak: number;
    dailyRituals: RitualLog[];
    dailyRitualsCount: number;
    marks: string[];
    featuredMarks: string[];
    echoHistory: EchoLog[];
};

const ProgressionContext = createContext<ProgressionContextValue | undefined>(undefined);

export const ProgressionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const { user } = auth;

    const [state, setState] = useState<XPState>(buildInitialXPState());
    const [whisper, setWhisper] = useState<string | null>(null);
    const [levelUpEvent, setLevelUpEvent] = useState<LeagueInfo | null>(null);
    const [levelUpQueue, setLevelUpQueue] = useState<LeagueInfo[]>([]);
    const [streakCelebrationEvent, setStreakCelebrationEvent] =
        useState<StreakCelebrationEvent | null>(null);
    const [sharePromptEvent, setSharePromptEvent] = useState<SharePromptEvent | null>(null);
    const previousLeagueIndexRef = useRef(getLeagueIndexFromXp(state.totalXP));
    const pendingWelcomeWhisperRef = useRef(false);
    const canReadProfileStateRef = useRef(true);
    const canWriteProfileStateRef = useRef(true);
    const canWriteRitualRef = useRef(true);
    const canReadFollowRef = useRef(true);
    const canWriteFollowRef = useRef(true);
    const [isXpHydrated, setIsXpHydrated] = useState(false);

    // ---------- core helpers ----------

    const updateState = useCallback(
        (update: Partial<XPState> | ((prev: XPState) => Partial<XPState>)) => {
            setState((prev) => {
                const patch = typeof update === 'function' ? update(prev) : update;
                const updated = { ...prev, ...patch };
                if (user) {
                    persistUserXpStateToLocal(user.email, updated);
                }
                return updated;
            });
        },
        [user],
    );

    const triggerWhisper = useCallback((message: string) => {
        setWhisper(message);
        setTimeout(() => setWhisper(null), 4000);
    }, []);

    const tryUnlockMark = useCallback(
        (markId: string, currentMarks: string[]): string[] => {
            if (!currentMarks.includes(markId)) {
                const markDef = MAJOR_MARKS.find((m) => m.id === markId);
                const msg = markDef?.whisper || 'Mark unlocked.';
                triggerWhisper(msg);
                return [...currentMarks, markId];
            }
            return currentMarks;
        },
        [triggerWhisper],
    );

    const getToday = useCallback((): string => getLocalDateKey(), []);

    const checkStreakMaintenance = useCallback(
        (lastDate: string | null, today: string) => {
            if (!lastDate) return 1;
            const lastDayIndex = parseDateKeyToDayIndex(lastDate);
            const todayDayIndex = parseDateKeyToDayIndex(today);
            if (lastDayIndex === null || todayDayIndex === null) return undefined;
            const diffDays = todayDayIndex - lastDayIndex;
            if (diffDays === 1) return undefined;
            if (diffDays > 1) return 0;
            return undefined;
        },
        [],
    );

    const triggerStreakCelebration = useCallback((day: number) => {
        if (!Number.isFinite(day) || day <= 0) return;
        setStreakCelebrationEvent({
            day,
            isMilestone: STREAK_MILESTONE_SET.has(day),
        });
    }, []);

    const dismissSharePrompt = useCallback(() => {
        setSharePromptEvent(null);
    }, []);

    const closeLevelUp = useCallback(() => setLevelUpEvent(null), []);
    const closeStreakCelebration = useCallback(() => setStreakCelebrationEvent(null), []);

    // ---------- hydrate state when user changes ----------

    useEffect(() => {
        setIsXpHydrated(false);
        setLevelUpEvent(null);
        setLevelUpQueue([]);
        setStreakCelebrationEvent(null);
        setSharePromptEvent(null);
        canReadProfileStateRef.current = true;
        canWriteProfileStateRef.current = true;
        canWriteRitualRef.current = true;
        canReadFollowRef.current = true;
        canWriteFollowRef.current = true;

        if (!user) {
            setState(buildInitialXPState('Orbiting nearby...'));
            setIsXpHydrated(true);
            previousLeagueIndexRef.current = getLeagueIndexFromXp(0);
            return;
        }

        setState(buildInitialXPState());
        let active = true;

        const hydrateState = async () => {
            let remoteState: XPState | null = null;
            let localState: XPState | null = null;
            let cloudRituals: RitualLog[] = [];
            let didReadCloudRituals = false;
            let localRitualBackup: RitualLog[] = [];
            let cloudFollowingKeys: string[] = [];
            let didReadCloudFollowing = false;

            if (user.id) {
                const hydration = await loadUserProgression(user.id, {
                    canReadProfileState: canReadProfileStateRef.current,
                    canReadFollow: canReadFollowRef.current,
                });

                remoteState = hydration.remoteState;
                cloudRituals = hydration.cloudRituals;
                didReadCloudRituals = hydration.didReadCloudRituals;
                cloudFollowingKeys = hydration.cloudFollowingKeys;
                didReadCloudFollowing = hydration.didReadCloudFollowing;
                canReadProfileStateRef.current = hydration.canReadProfileState;
                canReadFollowRef.current = hydration.canReadFollow;
            }

            localState = readUserXpStateFromLocal(user.email);
            localRitualBackup = readUserRitualBackupFromLocal(user.email);

            let resolvedState = mergeXPStates([remoteState, localState]);
            if (!resolvedState) {
                resolvedState = buildInitialXPState();
            }

            const pendingRegistration = auth.consumePendingRegistration();
            if (pendingRegistration && pendingRegistration.email === user.email) {
                resolvedState = {
                    ...resolvedState,
                    fullName: pendingRegistration.fullName,
                    username: pendingRegistration.username,
                    gender: pendingRegistration.gender,
                    birthDate: pendingRegistration.birthDate,
                };
            }

            resolvedState = {
                ...resolvedState,
                fullName: resolvedState.fullName || user.fullName || '',
                username: resolvedState.username || user.username || '',
                gender: resolvedState.gender || user.gender || '',
                birthDate: resolvedState.birthDate || user.birthDate || '',
            };

            const cloudRitualFingerprints = new Set(
                cloudRituals.map((ritual) => ritualFingerprint(ritual)),
            );
            const cloudRitualIds = new Set(
                cloudRituals
                    .map((ritual) => String(ritual.id || '').trim())
                    .filter((value): value is string => Boolean(value)),
            );
            const filterToCloudKnownRituals = (rituals: RitualLog[]): RitualLog[] =>
                (rituals || []).filter((ritual) => {
                    const ritualId = String(ritual.id || '').trim();
                    return (
                        (ritualId && cloudRitualIds.has(ritualId)) ||
                        cloudRitualFingerprints.has(ritualFingerprint(ritual))
                    );
                });

            const mergedRituals = didReadCloudRituals
                ? mergeRitualLogs(
                      cloudRituals,
                      filterToCloudKnownRituals(resolvedState.dailyRituals || []),
                      filterToCloudKnownRituals(localRitualBackup),
                  )
                : mergeRitualLogs(
                      resolvedState.dailyRituals || [],
                      localRitualBackup,
                      cloudRituals,
                  );
            const ritualGenres = mergedRituals
                .map((ritual) => (ritual.genre || '').trim())
                .filter((genre): genre is string => Boolean(genre));
            resolvedState = {
                ...resolvedState,
                dailyRituals: mergedRituals,
                activeDays: mergeStringLists(
                    resolvedState.activeDays || [],
                    mergedRituals.map((ritual) => ritual.date),
                ).sort((a, b) => a.localeCompare(b)),
                uniqueGenres: mergeStringLists(resolvedState.uniqueGenres || [], ritualGenres),
                following: didReadCloudFollowing
                    ? cloudFollowingKeys
                    : mergeStringLists(resolvedState.following || [], cloudFollowingKeys),
            };

            if (!active) return;

            setState(resolvedState);
            previousLeagueIndexRef.current = getLeagueIndexFromXp(resolvedState.totalXP || 0);
            persistUserXpStateToLocal(user.email, resolvedState);
            setIsXpHydrated(true);
        };

        void hydrateState();

        return () => {
            active = false;
        };
    }, [user?.email, user?.id]);

    // ---------- level up detection ----------

    useEffect(() => {
        if (!isXpHydrated) return;

        const currentLeagueIndex = getLeagueIndexFromXp(state.totalXP);
        const previousLeagueIndex = previousLeagueIndexRef.current;

        if (currentLeagueIndex > previousLeagueIndex) {
            const crossed: LeagueInfo[] = [];
            for (let i = previousLeagueIndex + 1; i <= currentLeagueIndex; i += 1) {
                const leagueName = LEAGUE_NAMES[i];
                crossed.push(LEAGUES_DATA[leagueName]);
            }
            setLevelUpQueue((prev) => [...prev, ...crossed]);
            triggerWhisper('The orbit is changing.');
        }

        previousLeagueIndexRef.current = currentLeagueIndex;
    }, [isXpHydrated, state.totalXP, triggerWhisper]);

    useEffect(() => {
        if (levelUpEvent || levelUpQueue.length === 0) return;
        const [next, ...rest] = levelUpQueue;
        setLevelUpEvent(next);
        setLevelUpQueue(rest);
    }, [levelUpEvent, levelUpQueue]);

    // ---------- daily login XP ----------

    useEffect(() => {
        if (!user || !isXpHydrated) return;

        const today = getToday();

        setState((prev) => {
            let newActiveDays = prev.activeDays || [];
            if (!newActiveDays.includes(today)) {
                newActiveDays = [...newActiveDays, today];
            }

            let currentMarks = [...(prev.marks || [])];
            let newStreak = prev.streak;

            const leagueIndex = getLeagueIndexFromXp(prev.totalXP);
            const currentLeague = LEAGUE_NAMES[leagueIndex];
            if (currentLeague === 'Eternal') currentMarks = tryUnlockMark('eternal_mark', currentMarks);
            if (newActiveDays.length >= 14) currentMarks = tryUnlockMark('daybreaker', currentMarks);
            if (newActiveDays.length >= 30) currentMarks = tryUnlockMark('legacy', currentMarks);

            if (prev.lastLoginDate !== today && prev.lastLoginDate) {
                const gap = checkStreakMaintenance(prev.lastLoginDate, today);
                if (gap === 0) newStreak = 0;
            }

            let updated = prev;
            if (prev.lastLoginDate !== today) {
                pendingWelcomeWhisperRef.current = true;
                updated = {
                    ...prev,
                    ...applyXPDelta(prev, 5, 'daily_login'),
                    lastLoginDate: today,
                    dailyDwellXP: 0,
                    lastDwellDate: today,
                    activeDays: newActiveDays,
                    marks: currentMarks,
                    streak: newStreak,
                };
            } else if (JSON.stringify(currentMarks) !== JSON.stringify(prev.marks)) {
                updated = { ...prev, marks: currentMarks };
            }

            persistUserXpStateToLocal(user.email, updated);
            return updated;
        });
    }, [isXpHydrated, user?.email]);

    useEffect(() => {
        if (!pendingWelcomeWhisperRef.current) return;
        pendingWelcomeWhisperRef.current = false;
        triggerWhisper('Welcome back.');
    }, [state.lastLoginDate, triggerWhisper]);

    // ---------- dwell time ----------

    // Lifecycle: start on [dailyDwellXP,lastDwellDate], cleanup on unmount/dep-change
    // Auth reset: handled via progression hydrate effects
    // Background: no action (timer resumes naturally)
    // Retry: none — timer-driven
    useEffect(() => {
        const interval = setInterval(() => {
            const today = getToday();
            if (state.lastDwellDate !== today) {
                updateState({ dailyDwellXP: 0, lastDwellDate: today });
                return;
            }
            if (state.dailyDwellXP < MAX_DAILY_DWELL_XP) {
                updateState((prev) => ({
                    ...applyXPDelta(prev, 2, 'dwell'),
                    dailyDwellXP: prev.dailyDwellXP + 2,
                }));
            }
        }, 120000);
        return () => clearInterval(interval);
    }, [state.dailyDwellXP, state.lastDwellDate, updateState, getToday]);

    // ---------- profile-state cloud upsert ----------

    useEffect(() => {
        if (!user || !isXpHydrated) return;

        persistUserXpStateToLocal(user.email, state);

        const stateForCloud = compactStateForPersistence(state);

        if (!user.id || !canWriteProfileStateRef.current) return;

        void mutateXP({
            userId: user.id,
            email: user.email,
            displayName: state.username || state.fullName || user.name,
            xpState: stateForCloud,
        }).then((result) => {
            if (result.ok || !result.error) return;
            if (result.capabilityBlocked) {
                canWriteProfileStateRef.current = false;
            } else {
                console.error('[XP] failed to upsert profile state', result.error);
            }
        });
    }, [isXpHydrated, state, user]);

    // ---------- progression methods ----------

    const applyQuizProgress = useCallback(
        (input: {
            totalXP: number | null;
            streak: number | null;
            dateKey: string;
            streakProtectedNow: boolean;
        }) => {
            const normalizedDateKey = String(input.dateKey || '').trim() || getToday();
            const nextTotalXP =
                input.totalXP !== null && Number.isFinite(input.totalXP)
                    ? Math.max(state.totalXP, Math.floor(input.totalXP))
                    : state.totalXP;
            const nextStreak =
                input.streak !== null && Number.isFinite(input.streak)
                    ? Math.max(state.streak, Math.floor(input.streak))
                    : state.streak;
            const shouldProtectToday = Boolean(input.streakProtectedNow && normalizedDateKey);
            const streakAdvanced =
                shouldProtectToday &&
                nextStreak > state.streak &&
                normalizedDateKey !== state.lastStreakDate;
            const nextActiveDays = shouldProtectToday
                ? mergeStringLists(state.activeDays || [], [normalizedDateKey]).sort((left, right) =>
                      left.localeCompare(right),
                  )
                : state.activeDays || [];

            updateState({
                totalXP: nextTotalXP,
                streak: nextStreak,
                lastStreakDate: shouldProtectToday ? normalizedDateKey : state.lastStreakDate,
                activeDays: nextActiveDays,
            });

            if (streakAdvanced) {
                triggerStreakCelebration(nextStreak);
            }
        },
        [state, updateState, getToday, triggerStreakCelebration],
    );

    const submitRitual = useCallback(
        (
            movieId: number,
            text: string,
            _rating: number,
            genre: string,
            title?: string,
            posterPath?: string,
        ): AuthResult => {
            const moderation = moderateComment(text, {
                maxChars: 180,
                maxEmojiCount: 6,
                maxEmojiRatio: 0.2,
            });
            if (!moderation.ok) {
                const message = moderation.message || 'Yorum gonderilemedi.';
                triggerWhisper(message);
                return { ok: false, message };
            }

            const sanitizedText = text.trim();
            const today = getToday();
            if (state.dailyRituals.some((r) => r.date === today && r.movieId === movieId)) {
                triggerWhisper('Memory stored.');
                return { ok: false, message: 'Bu filme bugun zaten yorum yazildi.' };
            }

            const length = sanitizedText.length;
            let earnedXP = 15;
            if (length === 180) earnedXP = 50;

            let newStreak = state.streak;
            let nonConsecutive = state.nonConsecutiveCount;

            const hasdoneRitualToday = state.dailyRituals.some((r) => r.date === today);
            const shouldIncreaseStreakToday = !hasdoneRitualToday;
            if (shouldIncreaseStreakToday) {
                if (state.lastStreakDate) {
                    const gap = checkStreakMaintenance(state.lastStreakDate, today);
                    if (gap === undefined) newStreak += 1;
                    else {
                        newStreak = 1;
                        nonConsecutive += 1;
                    }
                } else {
                    newStreak = 1;
                    nonConsecutive += 1;
                }
                triggerStreakCelebration(newStreak);
            }

            if (newStreak >= 7) earnedXP *= 1.5;

            let currentMarks = [...(state.marks || [])];
            const newUniqueGenres = [...(state.uniqueGenres || [])];

            if (state.dailyRituals.length === 0) currentMarks = tryUnlockMark('first_mark', currentMarks);
            if (length === 180) currentMarks = tryUnlockMark('180_exact', currentMarks);
            if (length < 40) currentMarks = tryUnlockMark('minimalist', currentMarks);
            if (length >= LONG_FORM_RITUAL_THRESHOLD)
                currentMarks = tryUnlockMark('deep_diver', currentMarks);

            if (nonConsecutive >= 10) currentMarks = tryUnlockMark('no_rush', currentMarks);
            if (newStreak >= 3) currentMarks = tryUnlockMark('daily_regular', currentMarks);
            if (newStreak >= 5) currentMarks = tryUnlockMark('held_for_five', currentMarks);
            if (newStreak >= 7) currentMarks = tryUnlockMark('seven_quiet_days', currentMarks);

            const newRitual: RitualLog = {
                id: Date.now().toString(),
                date: today,
                movieId,
                movieTitle: title || KNOWN_MOVIES_BY_ID.get(movieId)?.title || 'Unknown Title',
                text: sanitizedText,
                genre,
                rating: _rating,
                posterPath: posterPath || KNOWN_MOVIES_BY_ID.get(movieId)?.posterPath,
            };
            const knownMovie = KNOWN_MOVIES_BY_ID.get(movieId);

            if (!newUniqueGenres.includes(genre)) {
                newUniqueGenres.push(genre);
                if (newUniqueGenres.length >= 10) currentMarks = tryUnlockMark('wide_lens', currentMarks);
                if (newUniqueGenres.length >= 3)
                    currentMarks = tryUnlockMark('genre_discovery', currentMarks);
            }

            const allRituals = [newRitual, ...(state.dailyRituals || [])];
            if (user?.email) {
                persistUserRitualBackupToLocal(user.email, allRituals);
            }
            if (allRituals.length >= 20) currentMarks = tryUnlockMark('ritual_marathon', currentMarks);
            if (allRituals.length >= 50) currentMarks = tryUnlockMark('archive_keeper', currentMarks);

            const exact180Count = allRituals.filter((ritual) => ritual.text.length === 180).length;
            if (exact180Count >= 3) currentMarks = tryUnlockMark('precision_loop', currentMarks);

            const genreCount = allRituals.filter((r) => r.genre === genre).length;
            if (genreCount >= 20) currentMarks = tryUnlockMark('one_genre_devotion', currentMarks);

            const latestFiveGenres = allRituals
                .slice(0, 5)
                .map((ritual) => ritual.genre?.trim().toLowerCase())
                .filter((value): value is string => Boolean(value));
            if (latestFiveGenres.length === 5 && new Set(latestFiveGenres).size === 5) {
                currentMarks = tryUnlockMark('genre_nomad', currentMarks);
            }

            if (knownMovie?.year && knownMovie.year < 1990)
                currentMarks = tryUnlockMark('classic_soul', currentMarks);
            if (typeof knownMovie?.voteAverage === 'number' && knownMovie.voteAverage <= 7.9) {
                currentMarks = tryUnlockMark('hidden_gem', currentMarks);
            }

            const hour = new Date().getHours();
            if (hour >= 0 && hour < 1) currentMarks = tryUnlockMark('midnight_ritual', currentMarks);
            if (hour >= 5 && hour < 7) currentMarks = tryUnlockMark('watched_on_time', currentMarks);

            if (state.dailyRituals.length === 0)
                currentMarks = tryUnlockMark('mystery_solver', currentMarks);

            const newTotalXP = Math.floor(state.totalXP + earnedXP);

            updateState((prev) => ({
                ...applyXPDelta(prev, earnedXP, 'ritual'),
                dailyRituals: allRituals,
                marks: currentMarks,
                uniqueGenres: newUniqueGenres,
                streak: newStreak,
                lastStreakDate: today,
                nonConsecutiveCount: nonConsecutive,
            }));

            const preferredGoal: ShareRewardTrigger =
                shouldIncreaseStreakToday && newStreak > 0 ? 'streak' : 'comment';
            setSharePromptEvent({
                id: `${today}-${movieId}-${Date.now()}`,
                preferredGoal,
                commentPreview: sanitizedText,
                streak: newStreak,
                date: today,
            });

            if (user?.id && canWriteRitualRef.current) {
                const leagueForInsert = LEAGUE_NAMES[getLeagueIndexFromXp(newTotalXP)];
                void mutateRitual({
                    author: user.name || user.email?.split('@')[0] || 'Observer',
                    movieTitle: newRitual.movieTitle,
                    posterPath: newRitual.posterPath || null,
                    text: newRitual.text,
                    league: leagueForInsert,
                    year: knownMovie?.year ? String(knownMovie.year) : null,
                }).then((result) => {
                    if (result.ok) return;

                    if (result.missingSession) {
                        triggerWhisper('Ritual yerelde kaydedildi. Cloud icin tekrar giris yap.');
                        return;
                    }

                    if (!result.error) return;

                    if (result.capabilityBlocked) {
                        canWriteRitualRef.current = false;
                        triggerWhisper(
                            'Cloud ritual sync devre disi. Yerel kayitla devam ediliyor.',
                        );
                        return;
                    }

                    console.error('[Ritual] Failed to sync ritual:', result.error);
                    const lowered = (result.error.message || '').toLowerCase();
                    if (
                        lowered.includes('permission') ||
                        lowered.includes('policy') ||
                        lowered.includes('jwt')
                    ) {
                        triggerWhisper('Cloud izni reddedildi. Cikis-giris yapip tekrar dene.');
                    } else if (lowered.includes('rate limit') || lowered.includes('too many')) {
                        triggerWhisper('Cok hizli gonderim algilandi. Biraz bekleyip tekrar dene.');
                    } else {
                        triggerWhisper('Ritual kaydedildi ama cloud senkronu basarisiz oldu.');
                    }
                });
            }

            return { ok: true, message: 'Yorum kaydedildi.' };
        },
        [
            state,
            user,
            updateState,
            getToday,
            checkStreakMaintenance,
            tryUnlockMark,
            triggerWhisper,
            triggerStreakCelebration,
        ],
    );

    const deleteRitual = useCallback(
        (ritualId: string) => {
            if (!ritualId) return;
            const normalizedId = String(ritualId);
            const exists = (state.dailyRituals || []).some(
                (ritual) => String(ritual.id) === normalizedId,
            );
            if (!exists) return;

            setState((prev) => {
                const currentRituals = prev.dailyRituals || [];
                const remaining = currentRituals.filter(
                    (ritual) => String(ritual.id) !== normalizedId,
                );
                const updated = { ...prev, dailyRituals: remaining };
                if (user) {
                    persistUserXpStateToLocal(user.email, updated);
                }
                return updated;
            });
            triggerWhisper('Ritual erased.');
        },
        [state.dailyRituals, user, triggerWhisper],
    );

    const echoRitual = useCallback(
        (ritualId: string) => {
            void ritualId;
            const newGiven = (state.echoesGiven || 0) + 1;
            let currentMarks = [...(state.marks || [])];
            if (state.echoesGiven === 0) currentMarks = tryUnlockMark('echo_initiate', currentMarks);
            if (newGiven >= 10) currentMarks = tryUnlockMark('echo_chamber', currentMarks);
            updateState((prev) => ({
                ...applyXPDelta(prev, 1, 'echo_given'),
                marks: currentMarks,
                echoesGiven: newGiven,
            }));
        },
        [state.echoesGiven, state.marks, tryUnlockMark, updateState],
    );

    const receiveEcho = useCallback(
        (movieTitle = 'Unknown Ritual') => {
            const newReceived = (state.echoesReceived || 0) + 1;
            let currentMarks = [...(state.marks || [])];

            if (newReceived >= 1) currentMarks = tryUnlockMark('first_echo', currentMarks);
            if (newReceived >= 1) currentMarks = tryUnlockMark('echo_receiver', currentMarks);
            if (newReceived >= 5) currentMarks = tryUnlockMark('influencer', currentMarks);
            if (newReceived >= 5) currentMarks = tryUnlockMark('resonator', currentMarks);

            const newLog: EchoLog = {
                id: Date.now().toString(),
                movieTitle,
                date: new Date().toLocaleDateString(),
            };

            updateState((prev) => ({
                ...applyXPDelta(prev, 3, 'echo_received'),
                marks: currentMarks,
                echoesReceived: newReceived,
                echoHistory: [newLog, ...(prev.echoHistory || [])].slice(0, 10),
            }));
        },
        [state.echoesReceived, state.marks, tryUnlockMark, updateState],
    );

    const awardShareXP = useCallback(
        (
            platform: 'instagram' | 'tiktok' | 'x',
            trigger: ShareRewardTrigger,
        ): AuthResult => {
            const today = getToday();

            if (trigger === 'comment') {
                const hasCommentToday = state.dailyRituals.some((ritual) => ritual.date === today);
                if (!hasCommentToday) {
                    return {
                        ok: false,
                        message: 'Yorum paylasim bonusu icin once bugun yorum yaz.',
                    };
                }
            }

            if (trigger === 'streak') {
                const isStreakCompletedToday =
                    state.streak > 0 && state.lastStreakDate === today;
                if (!isStreakCompletedToday) {
                    return {
                        ok: false,
                        message: 'Streak paylasim bonusu icin once bugunku rituelini tamamla.',
                    };
                }
            }

            if (state.lastShareRewardDate === today) {
                return { ok: false, message: 'Bugun paylasim bonusu zaten alindi.' };
            }

            updateState((prev) => ({
                ...applyXPDelta(prev, SHARE_REWARD_XP, 'share'),
                lastShareRewardDate: today,
            }));
            triggerWhisper(`Paylasim bonusi +${SHARE_REWARD_XP} XP`);

            const platformLabel =
                platform === 'x' ? 'X' : platform === 'tiktok' ? 'TikTok' : 'Instagram';
            const triggerLabel =
                trigger === 'streak' ? 'streak paylasimi' : 'yorum paylasimi';
            return {
                ok: true,
                message: `${platformLabel} ${triggerLabel} kaydedildi. +${SHARE_REWARD_XP} XP`,
            };
        },
        [state, updateState, getToday, triggerWhisper],
    );

    const debugAddXP = useCallback(
        (amount: number) => {
            setState((prev) => {
                const updated = { ...prev, totalXP: prev.totalXP + amount };
                if (user) {
                    persistUserXpStateToLocal(user.email, updated);
                }
                return updated;
            });
        },
        [user],
    );

    const debugUnlockMark = useCallback(
        (markId: string) => {
            const updated = tryUnlockMark(markId, state.marks);
            updateState({ marks: updated });
        },
        [state.marks, tryUnlockMark, updateState],
    );

    const toggleFeaturedMark = useCallback(
        (markId: string) => {
            let current = [...(state.featuredMarks || [])];
            if (current.includes(markId)) {
                current = current.filter((id) => id !== markId);
            } else {
                if (current.length < 3) {
                    current.push(markId);
                } else {
                    current.shift();
                    current.push(markId);
                }
            }
            updateState({ featuredMarks: current });
        },
        [state.featuredMarks, updateState],
    );

    // ---------- derived ----------

    const leagueIndex = getLeagueIndexFromXp(state.totalXP);
    const leagueName = LEAGUE_NAMES[leagueIndex];
    const leagueInfo = LEAGUES_DATA[leagueName];
    const currentLevelStart = leagueIndex * LEVEL_THRESHOLD;
    const progressPercentage = Math.min(
        100,
        Math.max(0, ((state.totalXP - currentLevelStart) / LEVEL_THRESHOLD) * 100),
    );
    const nextLevelXP = currentLevelStart + LEVEL_THRESHOLD;

    const value = useMemo<ProgressionContextValue>(
        () => ({
            state,
            setState,
            updateState,
            isXpHydrated,
            whisper,
            triggerWhisper,
            levelUpEvent,
            closeLevelUp,
            streakCelebrationEvent,
            closeStreakCelebration,
            sharePromptEvent,
            dismissSharePrompt,
            tryUnlockMark,
            getToday,
            canWriteFollowRef,
            applyQuizProgress,
            submitRitual,
            deleteRitual,
            echoRitual,
            receiveEcho,
            awardShareXP,
            debugAddXP,
            debugUnlockMark,
            toggleFeaturedMark,
            xp: state.totalXP,
            leagueName,
            leagueInfo,
            progressPercentage,
            nextLevelXP,
            daysPresent: state.activeDays ? state.activeDays.length : 0,
            streak: state.streak || 0,
            dailyRituals: state.dailyRituals || [],
            dailyRitualsCount: state.dailyRituals ? state.dailyRituals.length : 0,
            marks: state.marks || [],
            featuredMarks: state.featuredMarks || [],
            echoHistory: state.echoHistory || [],
        }),
        [
            state,
            updateState,
            isXpHydrated,
            whisper,
            triggerWhisper,
            levelUpEvent,
            closeLevelUp,
            streakCelebrationEvent,
            closeStreakCelebration,
            sharePromptEvent,
            dismissSharePrompt,
            tryUnlockMark,
            getToday,
            applyQuizProgress,
            submitRitual,
            deleteRitual,
            echoRitual,
            receiveEcho,
            awardShareXP,
            debugAddXP,
            debugUnlockMark,
            toggleFeaturedMark,
            leagueName,
            leagueInfo,
            progressPercentage,
            nextLevelXP,
        ],
    );

    return <ProgressionContext.Provider value={value}>{children}</ProgressionContext.Provider>;
};

export const useProgression = (): ProgressionContextValue => {
    const ctx = useContext(ProgressionContext);
    if (!ctx) {
        throw new Error('useProgression must be used within a ProgressionProvider');
    }
    return ctx;
};
