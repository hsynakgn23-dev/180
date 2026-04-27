export interface EchoLog {
    id: string;
    movieTitle: string;
    date: string;
}

export interface RitualLog {
    id: string;
    date: string;
    movieId: number;
    movieTitle: string;
    text: string;
    genre?: string;
    rating?: number;
    posterPath?: string;
}

export type RegistrationGender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

export interface XPState {
    totalXP: number;
    lastLoginDate: string | null;
    dailyDwellXP: number;
    lastDwellDate: string | null;
    dailyRituals: RitualLog[];
    marks: string[];
    featuredMarks: string[];
    activeDays: string[];
    uniqueGenres: string[];
    streak: number;
    lastStreakDate: string | null;
    echoesReceived: number;
    echoesGiven: number;
    echoHistory: EchoLog[];
    followers: number;
    following: string[];
    nonConsecutiveCount: number;
    fullName: string;
    username: string;
    gender: RegistrationGender | '';
    birthDate: string;
    bio: string;
    avatarId: string;
    avatarUrl?: string;
    lastShareRewardDate: string | null;
    referralCode: string;
    referralCount: number;
    invitedBy?: string;
}

export interface AuthResult {
    ok: boolean;
    message?: string;
}

export type ShareRewardTrigger = 'comment' | 'streak';

export interface SessionUser {
    id?: string;
    email: string;
    name: string;
    fullName?: string;
    username?: string;
    gender?: RegistrationGender | '';
    birthDate?: string;
}

export interface LeagueInfo {
    name: string;
    color: string;
    description: string;
}

export interface StreakCelebrationEvent {
    day: number;
    isMilestone: boolean;
}

export interface SharePromptEvent {
    id: string;
    preferredGoal: ShareRewardTrigger;
    commentPreview: string;
    streak: number;
    date: string;
}

export interface RegistrationProfileInput {
    fullName: string;
    username: string;
    gender: RegistrationGender;
    birthDate: string;
}

export type PendingRegistrationProfile = RegistrationProfileInput & { email: string };
