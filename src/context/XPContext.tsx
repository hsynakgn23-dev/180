import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MAJOR_MARKS } from '../data/marksData';
import { supabase, isSupabaseLive } from '../lib/supabase';
import { moderateComment } from '../lib/commentModeration';
import { normalizeAvatarUrl } from '../lib/avatarUpload';
import { STREAK_MILESTONE_SET } from '../domain/celebrations';
import { buildApiUrl } from '../lib/apiBase';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import { sendEngagementNotification } from '../lib/engagementNotificationApi';
import { claimInviteCodeViaApi, ensureInviteCodeViaApi, getReferralDeviceKey } from '../lib/referralApi';
export { getLeagueKeyByIndex, resolveLeagueInfo, resolveLeagueKey, resolveLeagueKeyFromXp } from '../domain/leagueSystem';

import { AuthProvider, useAuth } from './AuthContext';
import type {
    AuthResult,
    EchoLog,
    LeagueInfo,
    RegistrationGender,
    RegistrationProfileInput,
    RitualLog,
    SessionUser,
    SharePromptEvent,
    ShareRewardTrigger,
    StreakCelebrationEvent,
    XPState,
} from './xpShared/types';
import {
    applyXPDelta,
    buildFollowUserIdKey,
    buildInitialXPState,
    buildInviteLink,
    INVITEE_REWARD_XP,
    INVITER_REWARD_XP,
    isSupabaseCapabilityError,
    KNOWN_MOVIES_BY_ID,
    LEAGUE_NAMES,
    LEAGUES_DATA,
    LEVEL_THRESHOLD,
    LONG_FORM_RITUAL_THRESHOLD,
    MAX_DAILY_DWELL_XP,
    mergeRitualLogs,
    mergeStringLists,
    mergeXPStates,
    normalizeFollowKey,
    normalizeXPState,
    parseDateKeyToDayIndex,
    REGISTRATION_GENDERS,
    ritualFingerprint,
    SHARE_REWARD_XP,
    USERNAME_REGEX,
    getLeagueIndexFromXp,
    getLocalDateKey,
} from './xpShared/state';
import {
    compactStateForPersistence,
    persistUserRitualBackupToLocal,
    persistUserXpStateToLocal,
    readUserRitualBackupFromLocal,
    readUserRitualsFromCloud,
    readUserXpStateFromLocal,
} from './xpShared/persistence';
import { normalizeAuthError } from './xpShared/auth';

// Backward-compatible re-exports for existing consumers of XPContext.
export { LEAGUES_DATA, LEAGUE_NAMES } from './xpShared/state';
export type {
    LeagueInfo,
    RegistrationGender,
    SharePromptEvent,
    StreakCelebrationEvent,
} from './xpShared/types';

type UserFollowRow = {
    followed_user_id: string | null;
};

interface XPContextType {
    xp: number;
    league: string;
    leagueInfo: LeagueInfo;
    levelUpEvent: LeagueInfo | null;
    closeLevelUp: () => void;
    streakCelebrationEvent: StreakCelebrationEvent | null;
    closeStreakCelebration: () => void;
    sharePromptEvent: SharePromptEvent | null;
    dismissSharePrompt: () => void;
    progressPercentage: number;
    nextLevelXP: number;
    whisper: string | null;
    dailyRituals: RitualLog[];
    dailyRitualsCount: number;
    marks: string[];
    featuredMarks: string[];
    toggleFeaturedMark: (markId: string) => void;
    daysPresent: number;
    streak: number;
    echoHistory: EchoLog[];
    following: string[];
    isFollowingUser: (targetUserId?: string | null, username?: string) => boolean;
    fullName: string;
    username: string;
    gender: RegistrationGender | '';
    birthDate: string;
    bio: string;
    avatarId: string;
    updateIdentity: (bio: string, avatarId: string) => void;
    updatePersonalInfo: (profile: RegistrationProfileInput) => Promise<AuthResult>;
    toggleFollowUser: (target: { userId?: string | null; username: string }) => Promise<AuthResult>;
    awardShareXP: (platform: 'instagram' | 'tiktok' | 'x', trigger: ShareRewardTrigger) => AuthResult;
    applyQuizProgress: (input: {
        totalXP: number | null;
        streak: number | null;
        dateKey: string;
        streakProtectedNow: boolean;
    }) => void;
    inviteCode: string;
    inviteLink: string;
    invitedByCode: string | null;
    inviteClaimsCount: number;
    inviteRewardsEarned: number;
    inviteRewardConfig: {
        inviterXp: number;
        inviteeXp: number;
    };
    claimInviteCode: (code: string) => Promise<AuthResult>;
    submitRitual: (movieId: number, text: string, rating: number, genre: string, title?: string, posterPath?: string) => AuthResult;
    deleteRitual: (ritualId: string) => void;
    echoRitual: (ritualId: string) => void;
    receiveEcho: (movieTitle?: string) => void;
    debugAddXP: (amount: number) => void;
    debugUnlockMark: (markId: string) => void;
    user: SessionUser | null;
    authMode: 'supabase' | 'local';
    isPasswordRecoveryMode: boolean;
    login: (email: string, password: string, isRegistering?: boolean, registrationProfile?: RegistrationProfileInput) => Promise<AuthResult>;
    requestPasswordReset: (email: string) => Promise<AuthResult>;
    completePasswordReset: (newPassword: string) => Promise<AuthResult>;
    loginWithGoogle: () => Promise<AuthResult>;
    loginWithApple: () => Promise<AuthResult>;
    logout: () => Promise<void>;
    avatarUrl?: string;
    updateAvatar: (url: string) => void;
    redeemInviteCode: (code: string) => AuthResult;
    isPremium: boolean;
}

const XPContext = createContext<XPContextType | undefined>(undefined);

const XPProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const { user, authMode, isPasswordRecoveryMode } = auth;

    const [state, setState] = useState<XPState>(buildInitialXPState());
    const [whisper, setWhisper] = useState<string | null>(null);
    const [levelUpEvent, setLevelUpEvent] = useState<LeagueInfo | null>(null);
    const [levelUpQueue, setLevelUpQueue] = useState<LeagueInfo[]>([]);
    const [streakCelebrationEvent, setStreakCelebrationEvent] = useState<StreakCelebrationEvent | null>(null);
    const [sharePromptEvent, setSharePromptEvent] = useState<SharePromptEvent | null>(null);
    const previousLeagueIndexRef = useRef(getLeagueIndexFromXp(state.totalXP));
    const pendingWelcomeWhisperRef = useRef(false);
    const canReadProfileStateRef = useRef(true);
    const canWriteProfileStateRef = useRef(true);
    const canWriteRitualRef = useRef(true);
    const canReadFollowRef = useRef(true);
    const canWriteFollowRef = useRef(true);
    const [isXpHydrated, setIsXpHydrated] = useState(false);
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        if (!user) { setIsPremium(false); return; }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchWithAuth(buildApiUrl('/api/subscription-status'), {
                    headers: { Accept: 'application/json' },
                });
                if (!cancelled && res.ok) {
                    const json = await res.json();
                    setIsPremium(json.tier === 'premium');
                }
            } catch { /* fallback: stays false */ }
        })();
        return () => { cancelled = true; };
    }, [user]);

    // Load data when user changes
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
            setState(buildInitialXPState("Orbiting nearby..."));
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

            if (isSupabaseLive() && supabase && user.id && canReadProfileStateRef.current) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('xp_state')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!error && data?.xp_state && typeof data.xp_state === 'object') {
                    remoteState = normalizeXPState(data.xp_state as Partial<XPState>);
                } else if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canReadProfileStateRef.current = false;
                    } else {
                        console.error('[XP] failed to read profile state', error);
                    }
                }

                const cloudRitualResult = await readUserRitualsFromCloud(user.id);
                cloudRituals = cloudRitualResult.rituals;
                didReadCloudRituals = cloudRitualResult.didRead;

                if (canReadFollowRef.current) {
                    const { data: followData, error: followError } = await supabase
                        .from('user_follows')
                        .select('followed_user_id')
                        .eq('follower_user_id', user.id)
                        .limit(1000);

                    if (!followError) {
                        const rows = Array.isArray(followData) ? (followData as UserFollowRow[]) : [];
                        cloudFollowingKeys = rows
                            .map((row) => buildFollowUserIdKey(row.followed_user_id))
                            .filter((value): value is string => Boolean(value));
                        didReadCloudFollowing = true;
                    } else if (isSupabaseCapabilityError(followError)) {
                        canReadFollowRef.current = false;
                    } else {
                        console.error('[XP] failed to read follow graph', followError);
                    }
                }
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
                    birthDate: pendingRegistration.birthDate
                };
            }

            resolvedState = {
                ...resolvedState,
                fullName: resolvedState.fullName || user.fullName || '',
                username: resolvedState.username || user.username || '',
                gender: resolvedState.gender || user.gender || '',
                birthDate: resolvedState.birthDate || user.birthDate || ''
            };

            const cloudRitualFingerprints = new Set(
                cloudRituals.map((ritual) => ritualFingerprint(ritual))
            );
            const cloudRitualIds = new Set(
                cloudRituals
                    .map((ritual) => String(ritual.id || '').trim())
                    .filter((value): value is string => Boolean(value))
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
                    filterToCloudKnownRituals(localRitualBackup)
                )
                : mergeRitualLogs(
                    resolvedState.dailyRituals || [],
                    localRitualBackup,
                    cloudRituals
                );
            const ritualGenres = mergedRituals
                .map((ritual) => (ritual.genre || '').trim())
                .filter((genre): genre is string => Boolean(genre));
            resolvedState = {
                ...resolvedState,
                dailyRituals: mergedRituals,
                activeDays: mergeStringLists(resolvedState.activeDays || [], mergedRituals.map((ritual) => ritual.date))
                    .sort((a, b) => a.localeCompare(b)),
                uniqueGenres: mergeStringLists(resolvedState.uniqueGenres || [], ritualGenres),
                following: didReadCloudFollowing
                    ? cloudFollowingKeys
                    : mergeStringLists(resolvedState.following || [], cloudFollowingKeys)
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

    useEffect(() => {
        if (!isXpHydrated || !user?.email || !isSupabaseLive() || !supabase) {
            return;
        }

        let active = true;

        const syncInviteProgram = async () => {
            const seed = user.email || user.id || `web-${Date.now().toString(36)}`;
            const result = await ensureInviteCodeViaApi(seed);
            if (!active || !result.ok || !result.data) {
                return;
            }

            const referralCode = String(result.data.code || '').trim().toUpperCase();
            const referralCount = Math.max(0, Number(result.data.claimCount || 0));
            if (!referralCode) {
                return;
            }

            setState((prev) => {
                if (
                    String(prev.referralCode || '').trim().toUpperCase() === referralCode &&
                    Math.max(0, Number(prev.referralCount || 0)) === referralCount
                ) {
                    return prev;
                }

                const updated = {
                    ...prev,
                    referralCode,
                    referralCount
                };
                persistUserXpStateToLocal(user.email, updated);
                return updated;
            });
        };

        void syncInviteProgram();

        return () => {
            active = false;
        };
    }, [isXpHydrated, user?.email, user?.id]);

    const getToday = () => getLocalDateKey();

    // Check streak maintenance logic
    const checkStreakMaintenance = (lastDate: string | null, today: string) => {
        if (!lastDate) return 1;
        const lastDayIndex = parseDateKeyToDayIndex(lastDate);
        const todayDayIndex = parseDateKeyToDayIndex(today);
        if (lastDayIndex === null || todayDayIndex === null) return undefined;
        const diffDays = todayDayIndex - lastDayIndex;
        if (diffDays === 1) return undefined; // Maintained
        if (diffDays > 1) return 0; // Broken
        return undefined; // Same day (0)
    };

    const updateState = (
        update: Partial<XPState> | ((prev: XPState) => Partial<XPState>)
    ) => {
        setState(prev => {
            const patch = typeof update === 'function' ? update(prev) : update;
            const updated = { ...prev, ...patch };
            if (user) {
                persistUserXpStateToLocal(user.email, updated);
            }
            return updated;
        });
    };

    const getInviteCodeValidationMessage = (code: string): string | null => {
        const normalizedCode = code.trim().toUpperCase();
        if (!normalizedCode || normalizedCode.length < 4) {
            return 'Gecersiz davet kodu.';
        }
        if (state.invitedBy) {
            return 'Zaten bir davet kodu kullandiniz.';
        }
        if (normalizedCode === String(state.referralCode || '').trim().toUpperCase()) {
            return 'Kendi kodunu kullanamazsin.';
        }
        return null;
    };

    const resolveInviteClaimFailureMessage = (
        errorCode?: string,
        fallbackMessage?: string
    ): string => {
        switch (String(errorCode || '').toUpperCase()) {
            case 'UNAUTHORIZED':
                return 'Davet kodu kullanmak icin once giris yapmalisin.';
            case 'INVALID_CODE':
                return 'Gecersiz davet kodu.';
            case 'INVITE_NOT_FOUND':
                return 'Davet kodu bulunamadi.';
            case 'SELF_INVITE':
                return 'Kendi kodunu kullanamazsin.';
            case 'ALREADY_CLAIMED':
                return 'Zaten bir davet kodu kullandiniz.';
            case 'DEVICE_DAILY_LIMIT':
                return 'Bu cihaz bugun cok fazla deneme yapti.';
            case 'DEVICE_CODE_REUSE':
                return 'Bu cihaz bu kodu zaten kullandi.';
            default:
                return fallbackMessage || 'Davet kodu uygulanamadi.';
        }
    };

    const applyQuizProgress = (input: {
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
        const streakAdvanced = shouldProtectToday && nextStreak > state.streak && normalizedDateKey !== state.lastStreakDate;
        const nextActiveDays = shouldProtectToday
            ? mergeStringLists(state.activeDays || [], [normalizedDateKey]).sort((left, right) => left.localeCompare(right))
            : state.activeDays || [];

        updateState({
            totalXP: nextTotalXP,
            streak: nextStreak,
            lastStreakDate: shouldProtectToday ? normalizedDateKey : state.lastStreakDate,
            activeDays: nextActiveDays
        });

        if (streakAdvanced) {
            triggerStreakCelebration(nextStreak);
        }
    };

    const triggerStreakCelebration = (day: number) => {
        if (!Number.isFinite(day) || day <= 0) return;
        setStreakCelebrationEvent({
            day,
            isMilestone: STREAK_MILESTONE_SET.has(day)
        });
    };

    const dismissSharePrompt = () => {
        setSharePromptEvent(null);
    };

    const dispatchAuthWhisper = useCallback(
        (result: AuthResult): AuthResult => {
            if (result.whisper) {
                setWhisper(result.whisper);
                setTimeout(() => setWhisper(null), 4000);
            }
            return result;
        },
        [],
    );

    const login = useCallback(
        async (
            email: string,
            password: string,
            isRegistering?: boolean,
            registrationProfile?: RegistrationProfileInput,
        ): Promise<AuthResult> =>
            dispatchAuthWhisper(await auth.login(email, password, isRegistering, registrationProfile)),
        [auth, dispatchAuthWhisper],
    );

    const loginWithGoogle = useCallback(
        async (): Promise<AuthResult> => dispatchAuthWhisper(await auth.loginWithGoogle()),
        [auth, dispatchAuthWhisper],
    );

    const loginWithApple = useCallback(
        async (): Promise<AuthResult> => dispatchAuthWhisper(await auth.loginWithApple()),
        [auth, dispatchAuthWhisper],
    );

    const requestPasswordReset = useCallback(
        async (email: string): Promise<AuthResult> =>
            dispatchAuthWhisper(await auth.requestPasswordReset(email)),
        [auth, dispatchAuthWhisper],
    );

    const completePasswordReset = useCallback(
        async (newPassword: string): Promise<AuthResult> =>
            dispatchAuthWhisper(await auth.completePasswordReset(newPassword)),
        [auth, dispatchAuthWhisper],
    );

    const logout = useCallback(async () => {
        // XP/share prompt cleanup is driven by the user-change useEffect below;
        // AuthContext just clears the auth state.
        setSharePromptEvent(null);
        await auth.logout();
    }, [auth]);

    const updateAvatar = (url: string) => {
        updateState({ avatarUrl: normalizeAvatarUrl(url) || undefined });
        triggerWhisper("Visage captured.");
    };

    const isFollowingUser = (targetUserId?: string | null, username?: string): boolean => {
        const following = state.following || [];
        if (following.length === 0) return false;

        const userIdKey = buildFollowUserIdKey(targetUserId);
        const normalizedUsername = normalizeFollowKey(username);

        return following.some((entry) => {
            const normalizedEntry = normalizeFollowKey(entry);
            if (!normalizedEntry) return false;
            if (userIdKey && normalizedEntry === userIdKey) return true;
            if (!normalizedUsername) return false;
            return normalizedEntry === normalizedUsername;
        });
    };

    // Shadow Follow Logic
    const toggleFollowUser = async (target: { userId?: string | null; username: string }): Promise<AuthResult> => {
        const normalizedUsername = (target.username || '').trim();
        if (!normalizedUsername) {
            return { ok: false, message: 'Takip edilecek kullanici adi gecersiz.' };
        }

        const normalizedCurrentName = (user?.name || '').trim().toLowerCase();
        const normalizedTargetName = normalizedUsername.toLowerCase();
        if (target.userId && user?.id && target.userId === user.id) {
            return { ok: false, message: 'Kendini takip edemezsin.' };
        }
        if (!target.userId && normalizedCurrentName && normalizedCurrentName === normalizedTargetName) {
            return { ok: false, message: 'Kendini takip edemezsin.' };
        }

        const userIdKey = buildFollowUserIdKey(target.userId);
        let didFollow = false;
        let didSyncFollowInsert = false;

        setState((prev) => {
            const prevFollowing = [...(prev.following || [])];
            const nextMarks = [...(prev.marks || [])];
            const wasFollowing = prevFollowing.some((entry) => {
                const normalizedEntry = normalizeFollowKey(entry);
                if (!normalizedEntry) return false;
                if (userIdKey && normalizedEntry === userIdKey) return true;
                return normalizedEntry === normalizedTargetName;
            });

            if (wasFollowing) {
                didFollow = false;
                const updatedFollowing = prevFollowing.filter((entry) => {
                    const normalizedEntry = normalizeFollowKey(entry);
                    if (userIdKey && normalizedEntry === userIdKey) return false;
                    return normalizedEntry !== normalizedTargetName;
                });
                if (user) {
                    persistUserXpStateToLocal(user.email, { ...prev, following: updatedFollowing, marks: nextMarks });
                }
                return {
                    ...prev,
                    following: updatedFollowing,
                    marks: nextMarks
                };
            }

            didFollow = true;
            const followEntry = userIdKey || normalizedUsername;
            const updatedFollowing = [...prevFollowing, followEntry];
            const dedupedFollowing = Array.from(new Set(updatedFollowing.map((entry) => entry.trim()).filter(Boolean)));
            let unlockedMarks = nextMarks;
            if (dedupedFollowing.length >= 5) {
                unlockedMarks = tryUnlockMark('quiet_following', unlockedMarks);
            }
            if (user) {
                persistUserXpStateToLocal(user.email, { ...prev, following: dedupedFollowing, marks: unlockedMarks });
            }
            return {
                ...prev,
                following: dedupedFollowing,
                marks: unlockedMarks
            };
        });

        let syncWarning: string | null = null;
        if (isSupabaseLive() && supabase && user?.id && target.userId && canWriteFollowRef.current) {
            if (didFollow) {
                const { error } = await supabase
                    .from('user_follows')
                    .upsert(
                        [
                            {
                                follower_user_id: user.id,
                                followed_user_id: target.userId
                            }
                        ],
                        { onConflict: 'follower_user_id,followed_user_id', ignoreDuplicates: true }
                    );

                if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canWriteFollowRef.current = false;
                    } else {
                        console.error('[XP] failed to sync follow insert', error);
                        syncWarning = 'Takip kaydedildi, cloud senkronu basarisiz.';
                    }
                } else {
                    didSyncFollowInsert = true;
                }
            } else {
                const { error } = await supabase
                    .from('user_follows')
                    .delete()
                    .eq('follower_user_id', user.id)
                    .eq('followed_user_id', target.userId);

                if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canWriteFollowRef.current = false;
                    } else {
                        console.error('[XP] failed to sync follow delete', error);
                        syncWarning = 'Takipten cikarma kaydedildi, cloud senkronu basarisiz.';
                    }
                }
            }
        }

        if (didFollow) {
            if (didSyncFollowInsert && target.userId) {
                const actorLabel =
                    (user?.name || user?.fullName || user?.username || user?.email.split('@')[0] || '').trim() ||
                    normalizedUsername;
                void sendEngagementNotification({
                    kind: 'follow',
                    targetUserId: target.userId,
                    actorLabel
                }).then((result) => {
                    if (!result.ok) {
                        console.warn('[XP] follow notification failed', result.message);
                    }
                });
            }
            triggerWhisper(`Shadowing ${normalizedUsername}.`);
            return { ok: true, message: syncWarning || `${normalizedUsername} takip edildi.` };
        }

        triggerWhisper(`Unfollowed ${normalizedUsername}.`);
        return { ok: true, message: syncWarning || `${normalizedUsername} takipten cikarildi.` };
    };

    const awardShareXP = (platform: 'instagram' | 'tiktok' | 'x', trigger: ShareRewardTrigger): AuthResult => {
        const today = getToday();

        if (trigger === 'comment') {
            const hasCommentToday = state.dailyRituals.some((ritual) => ritual.date === today);
            if (!hasCommentToday) {
                return { ok: false, message: 'Yorum paylasim bonusu icin once bugun yorum yaz.' };
            }
        }

        if (trigger === 'streak') {
            const isStreakCompletedToday = state.streak > 0 && state.lastStreakDate === today;
            if (!isStreakCompletedToday) {
                return { ok: false, message: 'Streak paylasim bonusu icin once bugunku rituelini tamamla.' };
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

        const platformLabel = platform === 'x' ? 'X' : platform === 'tiktok' ? 'TikTok' : 'Instagram';
        const triggerLabel = trigger === 'streak' ? 'streak paylasimi' : 'yorum paylasimi';
        return {
            ok: true,
            message: `${platformLabel} ${triggerLabel} kaydedildi. +${SHARE_REWARD_XP} XP`
        };
    };

    // Trigger Whisper
    const triggerWhisper = (message: string) => {
        setWhisper(message);
        setTimeout(() => setWhisper(null), 4000);
    };

    // Unlock Logic
    const tryUnlockMark = (markId: string, currentMarks: string[]): string[] => {
        if (!currentMarks.includes(markId)) {
            const markDef = MAJOR_MARKS.find(m => m.id === markId);
            const msg = markDef?.whisper || "Mark unlocked.";
            triggerWhisper(msg);
            return [...currentMarks, markId];
        }
        return currentMarks;
    };

    // --- EFFECT: Global Level Up Detection ---
    // Collect all crossed leagues in a queue so transitions are not skipped.
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
            triggerWhisper("The orbit is changing.");
        }

        previousLeagueIndexRef.current = currentLeagueIndex;
    }, [isXpHydrated, state.totalXP]);

    // Display one queued transition at a time.
    useEffect(() => {
        if (levelUpEvent || levelUpQueue.length === 0) return;
        const [next, ...rest] = levelUpQueue;
        setLevelUpEvent(next);
        setLevelUpQueue(rest);
    }, [levelUpEvent, levelUpQueue]);

    // 1. Daily Login & Persistence
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

            // Mark: Eternal
            const leagueIndex = getLeagueIndexFromXp(prev.totalXP);
            const currentLeague = LEAGUE_NAMES[leagueIndex];
            if (currentLeague === 'Eternal') currentMarks = tryUnlockMark('eternal_mark', currentMarks);
            if (newActiveDays.length >= 14) currentMarks = tryUnlockMark('daybreaker', currentMarks);
            if (newActiveDays.length >= 30) currentMarks = tryUnlockMark('legacy', currentMarks);

            // Streak Maintenance
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
                    streak: newStreak
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
        triggerWhisper("Welcome back.");
    }, [state.lastLoginDate]);

    // 2. Dwell Time
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
    }, [state.dailyDwellXP, state.lastDwellDate]);

    // 3. Ritual Submission
    const submitRitual = (
        movieId: number,
        text: string,
        _rating: number,
        genre: string,
        title?: string,
        posterPath?: string
    ): AuthResult => {
        const moderation = moderateComment(text, { maxChars: 180, maxEmojiCount: 6, maxEmojiRatio: 0.2 });
        if (!moderation.ok) {
            const message = moderation.message || 'Yorum gonderilemedi.';
            triggerWhisper(message);
            return { ok: false, message };
        }

        const sanitizedText = text.trim();
        const today = getToday();
        if (state.dailyRituals.some(r => r.date === today && r.movieId === movieId)) {
            triggerWhisper("Memory stored.");
            return { ok: false, message: 'Bu filme bugun zaten yorum yazildi.' };
        }

        const length = sanitizedText.length;
        let earnedXP = 15;
        if (length === 180) earnedXP = 50;

        // Streak Logic
        let newStreak = state.streak;
        let nonConsecutive = state.nonConsecutiveCount;

        const hasdoneRitualToday = state.dailyRituals.some(r => r.date === today);
        // Streak is day-based, not comment-count based: only first ritual of the day can increase streak.
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

        // --- MARK CHECKS ---
        if (state.dailyRituals.length === 0) currentMarks = tryUnlockMark('first_mark', currentMarks);
        if (length === 180) currentMarks = tryUnlockMark('180_exact', currentMarks);
        if (length < 40) currentMarks = tryUnlockMark('minimalist', currentMarks);
        if (length >= LONG_FORM_RITUAL_THRESHOLD) currentMarks = tryUnlockMark('deep_diver', currentMarks);

        if (nonConsecutive >= 10) currentMarks = tryUnlockMark('no_rush', currentMarks);
        if (newStreak >= 3) currentMarks = tryUnlockMark('daily_regular', currentMarks);
        if (newStreak >= 5) currentMarks = tryUnlockMark('held_for_five', currentMarks);
        if (newStreak >= 7) currentMarks = tryUnlockMark('seven_quiet_days', currentMarks);

        // Define newRitual early for use in checks
        const newRitual: RitualLog = {
            id: Date.now().toString(),
            date: today,
            movieId,
            movieTitle: title || KNOWN_MOVIES_BY_ID.get(movieId)?.title || 'Unknown Title',
            text: sanitizedText,
            genre,
            rating: _rating,
            posterPath: posterPath || KNOWN_MOVIES_BY_ID.get(movieId)?.posterPath
        };
        const knownMovie = KNOWN_MOVIES_BY_ID.get(movieId);

        if (!newUniqueGenres.includes(genre)) {
            newUniqueGenres.push(genre);
            if (newUniqueGenres.length >= 10) currentMarks = tryUnlockMark('wide_lens', currentMarks);
            if (newUniqueGenres.length >= 3) currentMarks = tryUnlockMark('genre_discovery', currentMarks);
        }

        // Check for 'One Genre Devotion' (20 in one genre)
        const allRituals = [newRitual, ...(state.dailyRituals || [])];
        if (user?.email) {
            persistUserRitualBackupToLocal(user.email, allRituals);
        }
        if (allRituals.length >= 20) currentMarks = tryUnlockMark('ritual_marathon', currentMarks);
        if (allRituals.length >= 50) currentMarks = tryUnlockMark('archive_keeper', currentMarks);

        const exact180Count = allRituals.filter((ritual) => ritual.text.length === 180).length;
        if (exact180Count >= 3) currentMarks = tryUnlockMark('precision_loop', currentMarks);

        const genreCount = allRituals.filter(r => r.genre === genre).length;
        if (genreCount >= 20) currentMarks = tryUnlockMark('one_genre_devotion', currentMarks);

        const latestFiveGenres = allRituals
            .slice(0, 5)
            .map((ritual) => ritual.genre?.trim().toLowerCase())
            .filter((value): value is string => Boolean(value));
        if (latestFiveGenres.length === 5 && new Set(latestFiveGenres).size === 5) {
            currentMarks = tryUnlockMark('genre_nomad', currentMarks);
        }

        if (knownMovie?.year && knownMovie.year < 1990) currentMarks = tryUnlockMark('classic_soul', currentMarks);
        if (typeof knownMovie?.voteAverage === 'number' && knownMovie.voteAverage <= 7.9) {
            currentMarks = tryUnlockMark('hidden_gem', currentMarks);
        }

        const hour = new Date().getHours();
        if (hour >= 0 && hour < 1) currentMarks = tryUnlockMark('midnight_ritual', currentMarks);
        if (hour >= 5 && hour < 7) currentMarks = tryUnlockMark('watched_on_time', currentMarks);

        if (state.dailyRituals.length === 0) currentMarks = tryUnlockMark('mystery_solver', currentMarks);

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
            date: today
        });

        if (isSupabaseLive() && supabase && user?.id && canWriteRitualRef.current) {
            const leagueForInsert = LEAGUE_NAMES[getLeagueIndexFromXp(newTotalXP)];
            void (async () => {
                const { data: sessionData } = await supabase.auth.getSession();
                const sessionUser = sessionData.session?.user;

                if (!sessionUser?.id) {
                    triggerWhisper("Ritual yerelde kaydedildi. Cloud icin tekrar giris yap.");
                    return;
                }

                const nowIso = new Date().toISOString();
                const ritualInsertPayloads: Array<Record<string, string | null>> = [
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        timestamp: nowIso,
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        timestamp: nowIso,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        timestamp: nowIso,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        timestamp: nowIso
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        created_at: nowIso,
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        created_at: nowIso,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        created_at: nowIso
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        poster_path: newRitual.posterPath || null,
                        text: newRitual.text,
                        league: leagueForInsert,
                        year: knownMovie?.year ? String(knownMovie.year) : null
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text,
                        league: leagueForInsert
                    },
                    {
                        user_id: sessionUser.id,
                        author: user.name || sessionUser.email?.split('@')[0] || 'Observer',
                        movie_title: newRitual.movieTitle,
                        text: newRitual.text
                    }
                ];

                let insertError: { code?: string | null; message?: string | null } | null = null;

                for (const payload of ritualInsertPayloads) {
                    const { error } = await supabase
                        .from('rituals')
                        .insert([payload]);
                    if (!error) {
                        insertError = null;
                        break;
                    }
                    insertError = error;
                    if (!isSupabaseCapabilityError(error)) {
                        break;
                    }
                }

                if (insertError) {
                    if (isSupabaseCapabilityError(insertError)) {
                        canWriteRitualRef.current = false;
                        triggerWhisper("Cloud ritual sync devre disi. Yerel kayitla devam ediliyor.");
                        return;
                    }
                    console.error('[Ritual] Failed to sync ritual:', insertError);
                    const lowered = (insertError.message || '').toLowerCase();
                    if (lowered.includes('permission') || lowered.includes('policy') || lowered.includes('jwt')) {
                        triggerWhisper("Cloud izni reddedildi. Cikis-giris yapip tekrar dene.");
                    } else if (lowered.includes('rate limit') || lowered.includes('too many')) {
                        triggerWhisper("Cok hizli gonderim algilandi. Biraz bekleyip tekrar dene.");
                    } else {
                        triggerWhisper("Ritual kaydedildi ama cloud senkronu basarisiz oldu.");
                    }
                }
            })();
        }

        return { ok: true, message: 'Yorum kaydedildi.' };
    };

    const deleteRitual = (ritualId: string) => {
        if (!ritualId) return;
        const normalizedId = String(ritualId);
        const exists = (state.dailyRituals || []).some((ritual) => String(ritual.id) === normalizedId);
        if (!exists) return;

        setState((prev) => {
            const currentRituals = prev.dailyRituals || [];
            const remaining = currentRituals.filter((ritual) => String(ritual.id) !== normalizedId);
            const updated = { ...prev, dailyRituals: remaining };
            if (user) {
                persistUserXpStateToLocal(user.email, updated);
            }
            return updated;
        });
        triggerWhisper("Ritual erased.");
    };

    // 4. Social
    const echoRitual = (ritualId: string) => {
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
    };

    const receiveEcho = (movieTitle = "Unknown Ritual") => {
        const newReceived = (state.echoesReceived || 0) + 1;
        let currentMarks = [...(state.marks || [])];

        if (newReceived >= 1) currentMarks = tryUnlockMark('first_echo', currentMarks);
        if (newReceived >= 1) currentMarks = tryUnlockMark('echo_receiver', currentMarks);
        if (newReceived >= 5) currentMarks = tryUnlockMark('influencer', currentMarks);
        if (newReceived >= 5) currentMarks = tryUnlockMark('resonator', currentMarks);

        // Add to history
        const newLog: EchoLog = {
            id: Date.now().toString(),
            movieTitle,
            date: new Date().toLocaleDateString()
        };

        updateState((prev) => ({
            ...applyXPDelta(prev, 3, 'echo_received'),
            marks: currentMarks,
            echoesReceived: newReceived,
            echoHistory: [newLog, ...(state.echoHistory || [])].slice(0, 10), // Keep last 10
        }));

        // Debug whisper?
        // triggerWhisper("Your voice echoed. +3 XP");
    };

    // Featured Marks Logic
    const toggleFeaturedMark = (markId: string) => {
        let current = [...(state.featuredMarks || [])];
        if (current.includes(markId)) {
            current = current.filter(id => id !== markId);
        } else {
            if (current.length < 3) {
                current.push(markId);
            } else {
                // Optional: Replace first? or block.
                // Let's block for now or maybe just behave as toggle if full requires uncheck.
                // Or simplistic: pop first and push new.
                current.shift();
                current.push(markId);
            }
        }
        updateState({ featuredMarks: current });
    };

    // Debug Tools
    const debugAddXP = (amount: number) => {
        setState(prev => {
            const updated = { ...prev, totalXP: prev.totalXP + amount };
            if (user) {
                persistUserXpStateToLocal(user.email, updated);
            }
            return updated;
        });
    };

    useEffect(() => {
        if (!user || !isXpHydrated) return;

        persistUserXpStateToLocal(user.email, state);

        const stateForCloud = compactStateForPersistence(state);

        if (!isSupabaseLive() || !supabase || !user.id || !canWriteProfileStateRef.current) return;

        void supabase
            .from('profiles')
            .upsert(
                {
                    user_id: user.id,
                    email: user.email,
                    display_name: state.username || state.fullName || user.name,
                    xp_state: stateForCloud,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            )
            .then(({ error }) => {
                if (error) {
                    if (isSupabaseCapabilityError(error)) {
                        canWriteProfileStateRef.current = false;
                    } else {
                        console.error('[XP] failed to upsert profile state', error);
                    }
                }
            });
    }, [isXpHydrated, state, user]);

    const debugUnlockMark = (markId: string) => {
        const updated = tryUnlockMark(markId, state.marks);
        updateState({ marks: updated });
    };

    const updateIdentity = (bio: string, avatarId: string) => {
        updateState({ bio, avatarId });
        triggerWhisper("Identity shifted.");
    };

    const updatePersonalInfo = async (profile: RegistrationProfileInput): Promise<AuthResult> => {
        if (!user) {
            return { ok: false, message: 'Oturum bulunamadi.' };
        }

        const normalizedProfile: RegistrationProfileInput = {
            fullName: (profile.fullName || '').trim(),
            username: (profile.username || '').trim(),
            gender: profile.gender,
            birthDate: (profile.birthDate || '').trim()
        };

        if (!normalizedProfile.fullName || normalizedProfile.fullName.length < 2) {
            return { ok: false, message: 'Isim en az 2 karakter olmali.' };
        }
        if (!USERNAME_REGEX.test(normalizedProfile.username)) {
            return { ok: false, message: 'Kullanici adi 3-20 karakter olmali (harf, rakam, _).' };
        }
        if (!REGISTRATION_GENDERS.includes(normalizedProfile.gender)) {
            return { ok: false, message: 'Cinsiyet secimi gecersiz.' };
        }
        if (!normalizedProfile.birthDate) {
            return { ok: false, message: 'Dogum tarihi gerekli.' };
        }

        const birthDate = new Date(`${normalizedProfile.birthDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
            return { ok: false, message: 'Dogum tarihi gecersiz.' };
        }

        updateState({
            fullName: normalizedProfile.fullName,
            username: normalizedProfile.username,
            gender: normalizedProfile.gender,
            birthDate: normalizedProfile.birthDate
        });

        const displayName = normalizedProfile.fullName || normalizedProfile.username || user.name;
        auth.mergeSessionUser({
            name: displayName,
            fullName: normalizedProfile.fullName,
            username: normalizedProfile.username,
            gender: normalizedProfile.gender,
            birthDate: normalizedProfile.birthDate,
        });

        if (isSupabaseLive() && supabase) {
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: normalizedProfile.fullName,
                    name: normalizedProfile.fullName,
                    username: normalizedProfile.username,
                    gender: normalizedProfile.gender,
                    birth_date: normalizedProfile.birthDate
                }
            });

            if (error) {
                return {
                    ok: true,
                    message: `Profil guncellendi fakat cloud metadata senkronu basarisiz: ${normalizeAuthError(error.message)}`
                };
            }
        }

        triggerWhisper("Identity shifted.");
        return { ok: true, message: 'Profil bilgileri guncellendi.' };
    };

    const redeemInviteCode = (code: string): AuthResult => {
        const validationMessage = getInviteCodeValidationMessage(code);
        if (validationMessage) {
            return { ok: false, message: validationMessage };
        }

        return {
            ok: false,
            message: 'Davet kodu icin sunucu onayi gerekiyor.'
        };
    };

    const inviteCode = String(state.referralCode || '').trim().toUpperCase();
    const inviteLink = buildInviteLink(inviteCode);
    const invitedByCode = state.invitedBy || null;
    const inviteClaimsCount = state.referralCount || 0;
    const inviteRewardsEarned = inviteClaimsCount * INVITER_REWARD_XP;
    const claimInviteCode = async (code: string): Promise<AuthResult> => {
        const normalizedCode = code.trim().toUpperCase();
        const validationMessage = getInviteCodeValidationMessage(normalizedCode);
        if (validationMessage) {
            return { ok: false, message: validationMessage };
        }

        if (!isSupabaseLive() || !supabase) {
            return {
                ok: false,
                message: 'Davet kodu su anda kullanilamiyor.'
            };
        }

        try {
            const result = await claimInviteCodeViaApi(normalizedCode, getReferralDeviceKey());
            if (!result.ok || !result.data) {
                return {
                    ok: false,
                    message: resolveInviteClaimFailureMessage(result.errorCode, result.message)
                };
            }

            const inviteeRewardXp = Math.max(
                0,
                Number(result.data.inviteeRewardXp || INVITEE_REWARD_XP)
            );

            setState((prev) => {
                const updated = {
                    ...prev,
                    invitedBy: normalizedCode,
                    ...applyXPDelta(prev, inviteeRewardXp, 'invite_accepted'),
                };
                if (user) {
                    persistUserXpStateToLocal(user.email, updated);
                }
                return updated;
            });

            triggerWhisper(`Invite accepted. +${inviteeRewardXp} XP`);
            return {
                ok: true,
                message: 'Davet kodu kabul edildi.'
            };
        } catch (error) {
            return {
                ok: false,
                message: resolveInviteClaimFailureMessage(
                    'SERVER_ERROR',
                    error instanceof Error ? error.message : undefined
                )
            };
        }
    };

    const leagueIndex = getLeagueIndexFromXp(state.totalXP);
    const leagueName = LEAGUE_NAMES[leagueIndex];
    const leagueInfo = LEAGUES_DATA[leagueName];
    const currentLevelStart = leagueIndex * LEVEL_THRESHOLD;
    const progressPercentage = Math.min(100, Math.max(0, ((state.totalXP - currentLevelStart) / LEVEL_THRESHOLD) * 100));
    const nextLevelXP = currentLevelStart + LEVEL_THRESHOLD;

    return (
        <XPContext.Provider value={{
            xp: state.totalXP,
            league: leagueName,
            leagueInfo,
            levelUpEvent,
            closeLevelUp: () => setLevelUpEvent(null),
            streakCelebrationEvent,
            closeStreakCelebration: () => setStreakCelebrationEvent(null),
            sharePromptEvent,
            dismissSharePrompt,
            progressPercentage,
            nextLevelXP,
            whisper,
            dailyRituals: state.dailyRituals || [],
            dailyRitualsCount: state.dailyRituals ? state.dailyRituals.length : 0,
            marks: state.marks || [],
            featuredMarks: state.featuredMarks || [],
            toggleFeaturedMark,
            daysPresent: state.activeDays ? state.activeDays.length : 0,
            streak: state.streak || 0,
            echoHistory: state.echoHistory || [],
            following: state.following || [],
            isFollowingUser,
            fullName: state.fullName || '',
            username: state.username || '',
            gender: state.gender || '',
            birthDate: state.birthDate || '',
            bio: state.bio,
            avatarId: state.avatarId,
            updateIdentity,
            updatePersonalInfo,
            toggleFollowUser,
            awardShareXP,
            applyQuizProgress,
            inviteCode,
            inviteLink,
            invitedByCode,
            inviteClaimsCount,
            inviteRewardsEarned,
            inviteRewardConfig: {
                inviterXp: INVITER_REWARD_XP,
                inviteeXp: INVITEE_REWARD_XP
            },
            claimInviteCode,
            submitRitual,
            deleteRitual,
            echoRitual,
            receiveEcho,
            debugAddXP,
            debugUnlockMark,
            user,
            authMode,
            isPasswordRecoveryMode,
            login,
            requestPasswordReset,
            completePasswordReset,
            loginWithGoogle,
            loginWithApple,
            logout,
            avatarUrl: state.avatarUrl,
            updateAvatar,
            redeemInviteCode,
            isPremium
        }}>
            {children}
        </XPContext.Provider>
    );
};

export const XPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthProvider>
        <XPProviderInner>{children}</XPProviderInner>
    </AuthProvider>
);

export const useXP = () => {
    const context = useContext(XPContext);
    if (!context) {
        throw new Error('useXP must be used within an XPProvider');
    }
    return context;
};
