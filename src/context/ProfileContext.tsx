import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { buildApiUrl } from '../lib/apiBase.js';
import { normalizeAvatarUrl } from '../lib/avatarUpload.js';
import { sendEngagementNotification } from '../lib/engagementNotificationApi.js';
import { fetchWithAuth } from '../lib/fetchWithAuth.js';
import { claimInviteCodeViaApi } from '../lib/referralApi.js';
import { isSupabaseLive, supabase } from '../lib/supabase.js';
import { mutateFollow } from '../lib/supabase/progression.js';

import { useAuth } from './AuthContext.js';
import { useProgression } from './ProgressionContext.js';
import { normalizeAuthError } from './xpShared/auth.js';
import {
    buildFollowUserIdKey,
    normalizeFollowKey,
    REGISTRATION_GENDERS,
    USERNAME_REGEX,
} from './xpShared/state.js';
import type {
    AuthResult,
    RegistrationGender,
    RegistrationProfileInput,
} from './xpShared/types.js';

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

type ProfileFields = Pick<
    ProfileContextValue,
    'bio' | 'avatarId' | 'avatarUrl' | 'fullName' | 'username' | 'gender' | 'birthDate' | 'following'
>;

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);
const EMPTY_FOLLOWING: string[] = [];
const INVITE_CODE = '';
const INVITE_LINK = '';
const INVITED_BY_CODE: string | null = null;
const INVITE_CLAIMS_COUNT = 0;
const INVITE_REWARDS_EARNED = 0;
const INVITE_REWARD_CONFIG = { inviterXp: 0, inviteeXp: 0 };

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const progression = useProgression();
    const { user, mergeSessionUser } = auth;
    const {
        state,
        updateState,
        triggerWhisper,
        tryUnlockMark,
        canWriteFollowRef,
    } = progression;

    const userId = user?.id || '';
    const userEmail = user?.email || '';
    const userName = user?.name || '';
    const userFullName = user?.fullName || '';
    const userUsername = user?.username || '';
    const userSessionKey = userId || userEmail;
    const [isPremium, setIsPremium] = useState(false);

    // Subscription tier fetch
    useEffect(() => {
        if (!userSessionKey) {
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
    }, [userSessionKey]);

    const following = useMemo(() => state.following || EMPTY_FOLLOWING, [state.following]);

    const profileFields = useMemo<ProfileFields>(
        () => ({
            bio: state.bio,
            avatarId: state.avatarId,
            avatarUrl: state.avatarUrl,
            fullName: state.fullName || '',
            username: state.username || '',
            gender: state.gender || '',
            birthDate: state.birthDate || '',
            following,
        }),
        [
            state.bio,
            state.avatarId,
            state.avatarUrl,
            state.fullName,
            state.username,
            state.gender,
            state.birthDate,
            following,
        ],
    );

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
        [following],
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

            const normalizedCurrentName = userName.trim().toLowerCase();
            const normalizedTargetName = normalizedUsername.toLowerCase();
            if (target.userId && userId && target.userId === userId) {
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
            if (userId && target.userId && canWriteFollowRef.current) {
                const result = await mutateFollow({
                    followerUserId: userId,
                    followedUserId: target.userId,
                    shouldFollow: didFollow,
                });

                if (result.ok) {
                    didSyncFollowInsert = didFollow;
                } else if (result.error) {
                    if (result.capabilityBlocked) {
                        canWriteFollowRef.current = false;
                    } else if (didFollow) {
                        console.error('[XP] failed to sync follow insert', result.error);
                        syncWarning = 'Takip kaydedildi, cloud senkronu basarisiz.';
                    } else {
                        console.error('[XP] failed to sync follow delete', result.error);
                        syncWarning = 'Takipten cikarma kaydedildi, cloud senkronu basarisiz.';
                    }
                }
            }

            if (didFollow) {
                if (didSyncFollowInsert && target.userId) {
                    const actorLabel =
                        (
                            userName ||
                            userFullName ||
                            userUsername ||
                            userEmail.split('@')[0] ||
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
        [
            userId,
            userEmail,
            userName,
            userFullName,
            userUsername,
            updateState,
            tryUnlockMark,
            triggerWhisper,
            canWriteFollowRef,
        ],
    );

    const updatePersonalInfo = useCallback(
        async (profile: RegistrationProfileInput): Promise<AuthResult> => {
            if (!userEmail) {
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
                normalizedProfile.fullName || normalizedProfile.username || userName;
            mergeSessionUser({
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
        [userEmail, userName, mergeSessionUser, updateState, triggerWhisper],
    );

    const getInviteCodeValidationMessage = useCallback((code: string): string | null => {
        const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        if (!normalizedCode || normalizedCode.length < 6) {
            return 'Gecersiz hediye kodu.';
        }
        return null;
    }, []);

    const resolveInviteClaimFailureMessage = useCallback(
        (errorCode?: string, fallbackMessage?: string): string => {
            switch (String(errorCode || '').toUpperCase()) {
                case 'UNAUTHORIZED':
                    return 'Hediye kodu kullanmak icin once giris yapmalisin.';
                case 'INVALID_CODE':
                    return 'Gecersiz hediye kodu.';
                case 'CODE_NOT_FOUND':
                    return 'Hediye kodu bulunamadi.';
                case 'CODE_REVOKED':
                    return 'Bu hediye kodu iptal edilmis.';
                case 'CODE_EXPIRED':
                    return 'Bu hediye kodunun suresi dolmus.';
                case 'CODE_EXHAUSTED':
                    return 'Bu hediye kodunun kullanim hakki bitmis.';
                case 'ALREADY_REDEEMED':
                    return 'Bu hediye kodu bu hesapta zaten kullanilmis.';
                case 'WALLET_UPDATE_FAILED':
                    return 'Bilet hediyesi hesaba eklenemedi.';
                case 'SUBSCRIPTION_UPDATE_FAILED':
                    return 'Premium hediyesi hesaba eklenemedi.';
                default:
                    return fallbackMessage || 'Hediye kodu uygulanamadi.';
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
                message: 'Hediye kodu icin sunucu onayi gerekiyor.',
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
                    message: 'Hediye kodu su anda kullanilamiyor.',
                };
            }

            try {
                const result = await claimInviteCodeViaApi(normalizedCode);
                if (!result.ok || !result.data) {
                    return {
                        ok: false,
                        message: resolveInviteClaimFailureMessage(result.errorCode, result.message),
                    };
                }

                const value = Math.max(0, Number(result.data.value || 0));
                const successMessage =
                    result.data.giftType === 'premium'
                        ? `Premium hediye kodu uygulandi. +${value} gun.`
                        : `Bilet hediye kodu uygulandi. +${value} bilet.`;

                triggerWhisper('Gift code redeemed.');
                return {
                    ok: true,
                    message: successMessage,
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
            triggerWhisper,
        ],
    );

    const value = useMemo<ProfileContextValue>(
        () => ({
            ...profileFields,
            isPremium,
            updateIdentity,
            updatePersonalInfo,
            updateAvatar,
            isFollowingUser,
            toggleFollowUser,
            inviteCode: INVITE_CODE,
            inviteLink: INVITE_LINK,
            invitedByCode: INVITED_BY_CODE,
            inviteClaimsCount: INVITE_CLAIMS_COUNT,
            inviteRewardsEarned: INVITE_REWARDS_EARNED,
            inviteRewardConfig: INVITE_REWARD_CONFIG,
            claimInviteCode,
            redeemInviteCode,
        }),
        [
            profileFields,
            isPremium,
            updateIdentity,
            updatePersonalInfo,
            updateAvatar,
            isFollowingUser,
            toggleFollowUser,
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
