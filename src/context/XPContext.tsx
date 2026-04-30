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

    const triggerWhisper = progression.triggerWhisper;
    const dismissSharePrompt = progression.dismissSharePrompt;

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
        dismissSharePrompt();
        await auth.logout();
    }, [auth, dismissSharePrompt]);

    return useMemo<XPContextType>(
        () => ({
            xp: progression.xp,
            league: progression.leagueName,
            leagueInfo: progression.leagueInfo,
            levelUpEvent: progression.levelUpEvent,
            closeLevelUp: progression.closeLevelUp,
            streakCelebrationEvent: progression.streakCelebrationEvent,
            closeStreakCelebration: progression.closeStreakCelebration,
            sharePromptEvent: progression.sharePromptEvent,
            dismissSharePrompt: progression.dismissSharePrompt,
            progressPercentage: progression.progressPercentage,
            nextLevelXP: progression.nextLevelXP,
            whisper: progression.whisper,
            dailyRituals: progression.dailyRituals,
            dailyRitualsCount: progression.dailyRitualsCount,
            marks: progression.marks,
            featuredMarks: progression.featuredMarks,
            toggleFeaturedMark: progression.toggleFeaturedMark,
            daysPresent: progression.daysPresent,
            streak: progression.streak,
            echoHistory: progression.echoHistory,
            following: profile.following,
            isFollowingUser: profile.isFollowingUser,
            fullName: profile.fullName,
            username: profile.username,
            gender: profile.gender,
            birthDate: profile.birthDate,
            bio: profile.bio,
            avatarId: profile.avatarId,
            updateIdentity: profile.updateIdentity,
            updatePersonalInfo: profile.updatePersonalInfo,
            toggleFollowUser: profile.toggleFollowUser,
            awardShareXP: progression.awardShareXP,
            applyQuizProgress: progression.applyQuizProgress,
            inviteCode: profile.inviteCode,
            inviteLink: profile.inviteLink,
            invitedByCode: profile.invitedByCode,
            inviteClaimsCount: profile.inviteClaimsCount,
            inviteRewardsEarned: profile.inviteRewardsEarned,
            inviteRewardConfig: profile.inviteRewardConfig,
            claimInviteCode: profile.claimInviteCode,
            submitRitual: progression.submitRitual,
            deleteRitual: progression.deleteRitual,
            echoRitual: progression.echoRitual,
            receiveEcho: progression.receiveEcho,
            debugAddXP: progression.debugAddXP,
            debugUnlockMark: progression.debugUnlockMark,
            user: auth.user,
            authMode: auth.authMode,
            isPasswordRecoveryMode: auth.isPasswordRecoveryMode,
            login,
            requestPasswordReset,
            completePasswordReset,
            loginWithGoogle,
            loginWithApple,
            logout,
            avatarUrl: profile.avatarUrl,
            updateAvatar: profile.updateAvatar,
            redeemInviteCode: profile.redeemInviteCode,
            isPremium: profile.isPremium,
        }),
        [
            auth,
            progression,
            profile,
            login,
            loginWithGoogle,
            loginWithApple,
            requestPasswordReset,
            completePasswordReset,
            logout,
        ],
    );
};
