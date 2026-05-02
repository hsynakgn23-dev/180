import React, { useCallback, useMemo } from 'react';
export { getLeagueKeyByIndex, resolveLeagueInfo, resolveLeagueKey, resolveLeagueKeyFromXp } from '../domain/leagueSystem.js';

import { AuthProvider, useAuth } from './AuthContext.js';
import { ProgressionProvider, useProgression } from './ProgressionContext.js';
import { ProfileProvider, useProfile } from './ProfileContext.js';
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
} from './xpShared/types.js';

// Backward-compatible re-exports for existing consumers of XPContext.
export { LEAGUES_DATA, LEAGUE_NAMES } from './xpShared/state.js';
export type {
    LeagueInfo,
    RegistrationGender,
    SharePromptEvent,
    StreakCelebrationEvent,
} from './xpShared/types.js';

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

export const XPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthProvider>
        <ProgressionProvider>
            <ProfileProvider>{children}</ProfileProvider>
        </ProgressionProvider>
    </AuthProvider>
);

/**
 * Backward-compatible composite hook. Combines useAuth + useProgression +
 * useProfile into the legacy XPContextType shape, with auth method wrappers
 * that route AuthResult.whisper through progression.triggerWhisper. New code
 * should prefer the dedicated hooks (useAuth / useProgression / useProfile)
 * for tighter dependencies.
 */
export const useXP = (): XPContextType => {
    const auth = useAuth();
    const progression = useProgression();
    const profile = useProfile();

    const {
        user,
        authMode,
        isPasswordRecoveryMode,
        login: authLogin,
        requestPasswordReset: authRequestPasswordReset,
        completePasswordReset: authCompletePasswordReset,
        loginWithGoogle: authLoginWithGoogle,
        loginWithApple: authLoginWithApple,
        logout: authLogout,
    } = auth;
    const {
        xp,
        leagueName,
        leagueInfo,
        levelUpEvent,
        closeLevelUp,
        streakCelebrationEvent,
        closeStreakCelebration,
        sharePromptEvent,
        dismissSharePrompt,
        progressPercentage,
        nextLevelXP,
        whisper,
        dailyRituals,
        dailyRitualsCount,
        marks,
        featuredMarks,
        toggleFeaturedMark,
        daysPresent,
        streak,
        echoHistory,
        awardShareXP,
        applyQuizProgress,
        submitRitual,
        deleteRitual,
        echoRitual,
        receiveEcho,
        debugAddXP,
        debugUnlockMark,
        triggerWhisper,
    } = progression;
    const {
        following,
        isFollowingUser,
        fullName,
        username,
        gender,
        birthDate,
        bio,
        avatarId,
        updateIdentity,
        updatePersonalInfo,
        toggleFollowUser,
        inviteCode,
        inviteLink,
        invitedByCode,
        inviteClaimsCount,
        inviteRewardsEarned,
        inviteRewardConfig,
        claimInviteCode,
        avatarUrl,
        updateAvatar,
        redeemInviteCode,
        isPremium,
    } = profile;

    const dispatchAuthWhisper = useCallback(
        (result: AuthResult): AuthResult => {
            if (result.whisper) triggerWhisper(result.whisper);
            return result;
        },
        [triggerWhisper],
    );

    const login = useCallback(
        async (
            email: string,
            password: string,
            isRegistering?: boolean,
            registrationProfile?: RegistrationProfileInput,
        ): Promise<AuthResult> =>
            dispatchAuthWhisper(await authLogin(email, password, isRegistering, registrationProfile)),
        [authLogin, dispatchAuthWhisper],
    );

    const loginWithGoogle = useCallback(
        async (): Promise<AuthResult> => dispatchAuthWhisper(await authLoginWithGoogle()),
        [authLoginWithGoogle, dispatchAuthWhisper],
    );

    const loginWithApple = useCallback(
        async (): Promise<AuthResult> => dispatchAuthWhisper(await authLoginWithApple()),
        [authLoginWithApple, dispatchAuthWhisper],
    );

    const requestPasswordReset = useCallback(
        async (email: string): Promise<AuthResult> =>
            dispatchAuthWhisper(await authRequestPasswordReset(email)),
        [authRequestPasswordReset, dispatchAuthWhisper],
    );

    const completePasswordReset = useCallback(
        async (newPassword: string): Promise<AuthResult> =>
            dispatchAuthWhisper(await authCompletePasswordReset(newPassword)),
        [authCompletePasswordReset, dispatchAuthWhisper],
    );

    const logout = useCallback(async () => {
        dismissSharePrompt();
        await authLogout();
    }, [authLogout, dismissSharePrompt]);

    return useMemo<XPContextType>(
        () => ({
            xp,
            league: leagueName,
            leagueInfo,
            levelUpEvent,
            closeLevelUp,
            streakCelebrationEvent,
            closeStreakCelebration,
            sharePromptEvent,
            dismissSharePrompt,
            progressPercentage,
            nextLevelXP,
            whisper,
            dailyRituals,
            dailyRitualsCount,
            marks,
            featuredMarks,
            toggleFeaturedMark,
            daysPresent,
            streak,
            echoHistory,
            following,
            isFollowingUser,
            fullName,
            username,
            gender,
            birthDate,
            bio,
            avatarId,
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
            inviteRewardConfig,
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
            avatarUrl,
            updateAvatar,
            redeemInviteCode,
            isPremium,
        }),
        [
            xp,
            leagueName,
            leagueInfo,
            levelUpEvent,
            closeLevelUp,
            streakCelebrationEvent,
            closeStreakCelebration,
            sharePromptEvent,
            dismissSharePrompt,
            progressPercentage,
            nextLevelXP,
            whisper,
            dailyRituals,
            dailyRitualsCount,
            marks,
            featuredMarks,
            toggleFeaturedMark,
            daysPresent,
            streak,
            echoHistory,
            following,
            isFollowingUser,
            fullName,
            username,
            gender,
            birthDate,
            bio,
            avatarId,
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
            inviteRewardConfig,
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
            avatarUrl,
            updateAvatar,
            redeemInviteCode,
            isPremium,
        ],
    );
};
