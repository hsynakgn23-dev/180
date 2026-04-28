import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { buildApiUrl } from '../lib/apiBase';
import { normalizeAvatarUrl } from '../lib/avatarUpload';
import { sendEngagementNotification } from '../lib/engagementNotificationApi';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import {
    claimInviteCodeViaApi,
    ensureInviteCodeViaApi,
    getReferralDeviceKey,
} from '../lib/referralApi';
import { isSupabaseLive, supabase } from '../lib/supabase';

import { useAuth } from './AuthContext';
import { useProgression } from './ProgressionContext';
import { normalizeAuthError } from './xpShared/auth';
import {
    applyXPDelta,
    buildFollowUserIdKey,
    buildInviteLink,
    INVITEE_REWARD_XP,
    INVITER_REWARD_XP,
    isSupabaseCapabilityError,
    normalizeFollowKey,
    REGISTRATION_GENDERS,
    USERNAME_REGEX,
} from './xpShared/state';
import type {
    AuthResult,
    RegistrationGender,
    RegistrationProfileInput,
} from './xpShared/types';

export type ProfileContextValue = {
    // Identity slice (mirrored from progression.state for convenience)
    bio: string;
    avatarId: string;
    avatarUrl?: string;
    fullName: string;
    username: string;
    gender: RegistrationGender | '';
    birthDate: string;
    following: string[];

    // Subscription
    isPremium: boolean;

    // Identity edits
    updateIdentity: (bio: string, avatarId: string) => void;
    updatePersonalInfo: (profile: RegistrationProfileInput) => Promise<AuthResult>;
    updateAvatar: (url: string) => void;

    // Follow
    isFollowingUser: (targetUserId?: string | null, username?: string) => boolean;
    toggleFollowUser: (target: {
        userId?: string | null;
        username: string;
    }) => Promise<AuthResult>;

    // Referral / invite
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
    redeemInviteCode: (code: string) => AuthResult;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const progression = useProgression();
    const { user } = auth;
    const {
        state,
        setState,
        updateState,
        triggerWhisper,
        tryUnlockMark,
        canWriteFollowRef,
        isXpHydrated,
    } = progression;

    const [isPremium, setIsPremium] = useState(false);

    // Subscription tier fetch
    useEffect(() => {
        if (!user) {
            setIsPremium(false);
            return;
        }
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
            } catch {
                /* fallback: stays false */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user]);

    // Referral / invite code sync
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

            updateState((prev) => {
                if (
                    String(prev.referralCode || '').trim().toUpperCase() === referralCode &&
                    Math.max(0, Number(prev.referralCount || 0)) === referralCount
                ) {
                    return {};
                }
                return { referralCode, referralCount };
            });
        };

        void syncInviteProgram();

        return () => {
            active = false;
        };
    }, [isXpHydrated, user?.email, user?.id]);

    const updateAvatar = useCallback(
        (url: string) => {
            updateState({ avatarUrl: normalizeAvatarUrl(url) || undefined });
            triggerWhisper('Visage captured.');
        },
        [updateState, triggerWhisper],
    );

    const updateIdentity = useCallback(
        (bio: string, avatarId: string) => {
            updateState({ bio, avatarId });
            triggerWhisper('Identity shifted.');
        },
        [updateState, triggerWhisper],
    );

    const isFollowingUser = useCallback(
        (targetUserId?: string | null, username?: string): boolean => {
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
        },
        [state.following],
    );

    const toggleFollowUser = useCallback(
        async (target: {
            userId?: string | null;
            username: string;
        }): Promise<AuthResult> => {
            const normalizedUsername = (target.username || '').trim();
            if (!normalizedUsername) {
                return { ok: false, message: 'Takip edilecek kullanici adi gecersiz.' };
            }

            const normalizedCurrentName = (user?.name || '').trim().toLowerCase();
            const normalizedTargetName = normalizedUsername.toLowerCase();
            if (target.userId && user?.id && target.userId === user.id) {
                return { ok: false, message: 'Kendini takip edemezsin.' };
            }
            if (
                !target.userId &&
                normalizedCurrentName &&
                normalizedCurrentName === normalizedTargetName
            ) {
                return { ok: false, message: 'Kendini takip edemezsin.' };
            }

            const userIdKey = buildFollowUserIdKey(target.userId);
            let didFollow = false;
            let didSyncFollowInsert = false;

            updateState((prev) => {
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
                    return {
                        following: updatedFollowing,
                        marks: nextMarks,
                    };
                }

                didFollow = true;
                const followEntry = userIdKey || normalizedUsername;
                const updatedFollowing = [...prevFollowing, followEntry];
                const dedupedFollowing = Array.from(
                    new Set(updatedFollowing.map((entry) => entry.trim()).filter(Boolean)),
                );
                let unlockedMarks = nextMarks;
                if (dedupedFollowing.length >= 5) {
                    unlockedMarks = tryUnlockMark('quiet_following', unlockedMarks);
                }
                return {
                    following: dedupedFollowing,
                    marks: unlockedMarks,
                };
            });

            let syncWarning: string | null = null;
            if (
                isSupabaseLive() &&
                supabase &&
                user?.id &&
                target.userId &&
                canWriteFollowRef.current
            ) {
                if (didFollow) {
                    const { error } = await supabase.from('user_follows').upsert(
                        [
                            {
                                follower_user_id: user.id,
                                followed_user_id: target.userId,
                            },
                        ],
                        {
                            onConflict: 'follower_user_id,followed_user_id',
                            ignoreDuplicates: true,
                        },
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
                        (
                            user?.name ||
                            user?.fullName ||
                            user?.username ||
                            user?.email.split('@')[0] ||
                            ''
                        ).trim() || normalizedUsername;
                    void sendEngagementNotification({
                        kind: 'follow',
                        targetUserId: target.userId,
                        actorLabel,
                    }).then((result) => {
                        if (!result.ok) {
                            console.warn('[XP] follow notification failed', result.message);
                        }
                    });
                }
                triggerWhisper(`Shadowing ${normalizedUsername}.`);
                return {
                    ok: true,
                    message: syncWarning || `${normalizedUsername} takip edildi.`,
                };
            }

            triggerWhisper(`Unfollowed ${normalizedUsername}.`);
            return {
                ok: true,
                message: syncWarning || `${normalizedUsername} takipten cikarildi.`,
            };
        },
        [user, updateState, tryUnlockMark, triggerWhisper, canWriteFollowRef],
    );

    const updatePersonalInfo = useCallback(
        async (profile: RegistrationProfileInput): Promise<AuthResult> => {
            if (!user) {
                return { ok: false, message: 'Oturum bulunamadi.' };
            }

            const normalizedProfile: RegistrationProfileInput = {
                fullName: (profile.fullName || '').trim(),
                username: (profile.username || '').trim(),
                gender: profile.gender,
                birthDate: (profile.birthDate || '').trim(),
            };

            if (!normalizedProfile.fullName || normalizedProfile.fullName.length < 2) {
                return { ok: false, message: 'Isim en az 2 karakter olmali.' };
            }
            if (!USERNAME_REGEX.test(normalizedProfile.username)) {
                return {
                    ok: false,
                    message: 'Kullanici adi 3-20 karakter olmali (harf, rakam, _).',
                };
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
                birthDate: normalizedProfile.birthDate,
            });

            const displayName =
                normalizedProfile.fullName || normalizedProfile.username || user.name;
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
                        birth_date: normalizedProfile.birthDate,
                    },
                });

                if (error) {
                    return {
                        ok: true,
                        message: `Profil guncellendi fakat cloud metadata senkronu basarisiz: ${normalizeAuthError(error.message)}`,
                    };
                }
            }

            triggerWhisper('Identity shifted.');
            return { ok: true, message: 'Profil bilgileri guncellendi.' };
        },
        [user, auth, updateState, triggerWhisper],
    );

    const getInviteCodeValidationMessage = useCallback(
        (code: string): string | null => {
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
        },
        [state.invitedBy, state.referralCode],
    );

    const resolveInviteClaimFailureMessage = useCallback(
        (errorCode?: string, fallbackMessage?: string): string => {
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
        },
        [],
    );

    const redeemInviteCode = useCallback(
        (code: string): AuthResult => {
            const validationMessage = getInviteCodeValidationMessage(code);
            if (validationMessage) {
                return { ok: false, message: validationMessage };
            }
            return {
                ok: false,
                message: 'Davet kodu icin sunucu onayi gerekiyor.',
            };
        },
        [getInviteCodeValidationMessage],
    );

    const claimInviteCode = useCallback(
        async (code: string): Promise<AuthResult> => {
            const normalizedCode = code.trim().toUpperCase();
            const validationMessage = getInviteCodeValidationMessage(normalizedCode);
            if (validationMessage) {
                return { ok: false, message: validationMessage };
            }

            if (!isSupabaseLive() || !supabase) {
                return {
                    ok: false,
                    message: 'Davet kodu su anda kullanilamiyor.',
                };
            }

            try {
                const result = await claimInviteCodeViaApi(normalizedCode, getReferralDeviceKey());
                if (!result.ok || !result.data) {
                    return {
                        ok: false,
                        message: resolveInviteClaimFailureMessage(result.errorCode, result.message),
                    };
                }

                const inviteeRewardXp = Math.max(
                    0,
                    Number(result.data.inviteeRewardXp || INVITEE_REWARD_XP),
                );

                // Atomic write: combine invitedBy + applyXPDelta in one setState
                // so the persistence effect captures both together.
                setState((prev) => ({
                    ...prev,
                    invitedBy: normalizedCode,
                    ...applyXPDelta(prev, inviteeRewardXp, 'invite_accepted'),
                }));

                triggerWhisper(`Invite accepted. +${inviteeRewardXp} XP`);
                return {
                    ok: true,
                    message: 'Davet kodu kabul edildi.',
                };
            } catch (error) {
                return {
                    ok: false,
                    message: resolveInviteClaimFailureMessage(
                        'SERVER_ERROR',
                        error instanceof Error ? error.message : undefined,
                    ),
                };
            }
        },
        [
            getInviteCodeValidationMessage,
            resolveInviteClaimFailureMessage,
            setState,
            triggerWhisper,
        ],
    );

    const inviteCode = String(state.referralCode || '').trim().toUpperCase();
    const inviteLink = buildInviteLink(inviteCode);
    const invitedByCode = state.invitedBy || null;
    const inviteClaimsCount = state.referralCount || 0;
    const inviteRewardsEarned = inviteClaimsCount * INVITER_REWARD_XP;

    const value = useMemo<ProfileContextValue>(
        () => ({
            bio: state.bio,
            avatarId: state.avatarId,
            avatarUrl: state.avatarUrl,
            fullName: state.fullName || '',
            username: state.username || '',
            gender: state.gender || '',
            birthDate: state.birthDate || '',
            following: state.following || [],
            isPremium,
            updateIdentity,
            updatePersonalInfo,
            updateAvatar,
            isFollowingUser,
            toggleFollowUser,
            inviteCode,
            inviteLink,
            invitedByCode,
            inviteClaimsCount,
            inviteRewardsEarned,
            inviteRewardConfig: {
                inviterXp: INVITER_REWARD_XP,
                inviteeXp: INVITEE_REWARD_XP,
            },
            claimInviteCode,
            redeemInviteCode,
        }),
        [
            state.bio,
            state.avatarId,
            state.avatarUrl,
            state.fullName,
            state.username,
            state.gender,
            state.birthDate,
            state.following,
            isPremium,
            updateIdentity,
            updatePersonalInfo,
            updateAvatar,
            isFollowingUser,
            toggleFollowUser,
            inviteCode,
            inviteLink,
            invitedByCode,
            inviteClaimsCount,
            inviteRewardsEarned,
            claimInviteCode,
            redeemInviteCode,
        ],
    );

    return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = (): ProfileContextValue => {
    const ctx = useContext(ProfileContext);
    if (!ctx) {
        throw new Error('useProfile must be used within a ProfileProvider');
    }
    return ctx;
};
