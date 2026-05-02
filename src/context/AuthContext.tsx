import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { trackEvent } from '../lib/analytics.js';
import { isSupabaseLive, supabase } from '../lib/supabase.js';
import {
    buildAuthRedirectTo,
    clearRecoveryUrlState,
    consumePostAuthHash,
    getLegacyStoredUser,
    isPasswordRecoveryUrl,
    normalizeAuthError,
    rememberPostAuthHash,
    toSessionUser,
} from './xpShared/auth.js';
import { REGISTRATION_GENDERS, USERNAME_REGEX } from './xpShared/state.js';
import type {
    AuthResult,
    PendingRegistrationProfile,
    RegistrationProfileInput,
    SessionUser,
} from './xpShared/types.js';

export type AuthContextValue = {
    user: SessionUser | null;
    authMode: 'supabase' | 'local';
    isPasswordRecoveryMode: boolean;
    login: (
        email: string,
        password: string,
        isRegistering?: boolean,
        registrationProfile?: RegistrationProfileInput,
    ) => Promise<AuthResult>;
    loginWithGoogle: () => Promise<AuthResult>;
    loginWithApple: () => Promise<AuthResult>;
    requestPasswordReset: (email: string) => Promise<AuthResult>;
    completePasswordReset: (newPassword: string) => Promise<AuthResult>;
    logout: () => Promise<void>;
    /**
     * Returns and clears any pending registration profile captured by the
     * latest signup attempt. Consumed by ProgressionContext during hydrate
     * so freshly registered users land with their profile fields seeded.
     */
    consumePendingRegistration: () => PendingRegistrationProfile | null;
    /**
     * Merges a partial patch into the current session user. No-op if the
     * user is null. Used by profile flows that update display name etc.
     */
    mergeSessionUser: (patch: Partial<SessionUser>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<SessionUser | null>(() => getLegacyStoredUser());
    const sessionUserRef = useRef<SessionUser | null>(getLegacyStoredUser());
    const pendingRegistrationProfileRef = useRef<PendingRegistrationProfile | null>(null);
    const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(() =>
        isPasswordRecoveryUrl(),
    );
    const authMode: 'supabase' | 'local' = isSupabaseLive() && supabase ? 'supabase' : 'local';

    const setSessionUser = useCallback((nextUser: SessionUser | null) => {
        setUser(nextUser);
        sessionUserRef.current = nextUser;
        if (nextUser) {
            localStorage.setItem('180_user_session', JSON.stringify(nextUser));
        } else {
            localStorage.removeItem('180_user_session');
        }
    }, []);

    // Lifecycle: start on [setSessionUser], cleanup on unmount/dep-change
    // Auth reset: handled via Supabase SIGNED_OUT event
    // Background: no action (subscription auto-pauses)
    // Retry: none — auth state drives refresh
    useEffect(() => {
        if (!isSupabaseLive() || !supabase) {
            return;
        }

        let active = true;
        const applyAuthUser = (authUser: SupabaseUser | null) => {
            if (!active) return;
            const mapped = toSessionUser(authUser);
            setSessionUser(mapped);
        };

        void supabase.auth.getSession().then(({ data }) => {
            const sessionUser = data.session?.user ?? null;
            applyAuthUser(sessionUser);
        });

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecoveryMode(true);
            }
            if (event === 'SIGNED_OUT') {
                setIsPasswordRecoveryMode(false);
                applyAuthUser(null);
                return;
            }

            const sessionUser = session?.user ?? null;
            applyAuthUser(sessionUser);
            if (sessionUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                const postAuthHash = consumePostAuthHash();
                if (postAuthHash && typeof window !== 'undefined') {
                    window.location.hash = postAuthHash.replace(/^#/, '');
                }
            }
        });

        return () => {
            active = false;
            data.subscription.unsubscribe();
        };
    }, [setSessionUser]);

    const login = useCallback(
        async (
            email: string,
            password: string,
            isRegistering = false,
            registrationProfile?: RegistrationProfileInput,
        ): Promise<AuthResult> => {
            const normalizedEmail = (email || '').trim().toLowerCase();
            if (!normalizedEmail.includes('@')) {
                return { ok: false, message: 'Gecerli bir e-posta gir.' };
            }
            if ((password || '').length < 6) {
                return { ok: false, message: 'Sifre en az 6 karakter olmali.' };
            }

            const normalizedRegistration: RegistrationProfileInput | null = isRegistering
                ? {
                      fullName: (registrationProfile?.fullName || '').trim(),
                      username: (registrationProfile?.username || '').trim(),
                      gender: registrationProfile?.gender || 'prefer_not_to_say',
                      birthDate: (registrationProfile?.birthDate || '').trim(),
                  }
                : null;
            const flow = isRegistering ? 'register' : 'login';

            if (isRegistering) {
                if (
                    !normalizedRegistration?.fullName ||
                    normalizedRegistration.fullName.length < 2
                ) {
                    return { ok: false, message: 'Isim en az 2 karakter olmali.' };
                }
                if (!USERNAME_REGEX.test(normalizedRegistration.username)) {
                    return {
                        ok: false,
                        message: 'Kullanici adi 3-20 karakter olmali (harf, rakam, _).',
                    };
                }
                if (!REGISTRATION_GENDERS.includes(normalizedRegistration.gender)) {
                    return { ok: false, message: 'Cinsiyet secimi gecersiz.' };
                }
                if (!normalizedRegistration.birthDate) {
                    return { ok: false, message: 'Dogum tarihi gerekli.' };
                }

                const birthDate = new Date(`${normalizedRegistration.birthDate}T00:00:00`);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
                    return { ok: false, message: 'Dogum tarihi gecersiz.' };
                }
            }

            if (!isSupabaseLive() || !supabase) {
                if (normalizedRegistration) {
                    pendingRegistrationProfileRef.current = {
                        email: normalizedEmail,
                        ...normalizedRegistration,
                    };
                }

                const fallbackUser: SessionUser = {
                    email: normalizedEmail,
                    name:
                        normalizedRegistration?.fullName ||
                        normalizedEmail.split('@')[0] ||
                        'observer',
                    fullName: normalizedRegistration?.fullName || '',
                    username: normalizedRegistration?.username || '',
                    gender: normalizedRegistration ? normalizedRegistration.gender : '',
                    birthDate: normalizedRegistration?.birthDate || '',
                };
                setSessionUser(fallbackUser);
                trackEvent(isRegistering ? 'signup_success' : 'login_success', {
                    flow,
                    method: 'password',
                    authMode: 'local',
                });
                return {
                    ok: true,
                    message: 'Supabase kapali oldugu icin local session acildi.',
                    whisper: 'Welcome to the Ritual.',
                };
            }

            try {
                if (isRegistering) {
                    if (!normalizedRegistration) {
                        return { ok: false, message: 'Kayit bilgileri eksik.' };
                    }

                    pendingRegistrationProfileRef.current = {
                        email: normalizedEmail,
                        ...normalizedRegistration,
                    };

                    const { data, error } = await supabase.auth.signUp({
                        email: normalizedEmail,
                        password,
                        options: {
                            data: {
                                full_name: normalizedRegistration.fullName,
                                name: normalizedRegistration.fullName,
                                username: normalizedRegistration.username,
                                gender: normalizedRegistration.gender,
                                birth_date: normalizedRegistration.birthDate,
                            },
                        },
                    });

                    if (error) {
                        const reason = normalizeAuthError(error.message);
                        trackEvent('auth_failure', { flow, method: 'password', reason });
                        return { ok: false, message: reason };
                    }
                    if (data.session?.user) {
                        const mapped = toSessionUser(data.session.user);
                        if (mapped) {
                            setSessionUser(mapped);
                        }
                        trackEvent(
                            'signup_success',
                            {
                                flow,
                                method: 'password',
                                authMode: 'supabase',
                            },
                            {
                                userId: data.session.user.id,
                            },
                        );
                        return {
                            ok: true,
                            message: 'Kayit tamamlandi. Oturum acildi.',
                            whisper: 'Account created.',
                        };
                    }

                    setSessionUser(null);
                    trackEvent('signup_pending_confirmation', {
                        flow,
                        method: 'password',
                        authMode: 'supabase',
                    });
                    return {
                        ok: true,
                        message: 'Kayit tamamlandi. E-posta onayi sonrasi giris yap.',
                    };
                }

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });

                if (error) {
                    const reason = normalizeAuthError(error.message);
                    trackEvent('auth_failure', { flow, method: 'password', reason });
                    return { ok: false, message: reason };
                }
                const mapped = toSessionUser(data.user ?? data.session?.user ?? null);
                if (mapped) {
                    setSessionUser(mapped);
                }
                const resolvedUserId =
                    data.user?.id || data.session?.user?.id || mapped?.id || null;
                trackEvent(
                    'login_success',
                    {
                        flow,
                        method: 'password',
                        authMode: 'supabase',
                    },
                    {
                        userId: resolvedUserId,
                    },
                );
                return { ok: true, whisper: 'Welcome to the Ritual.' };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Login failed.';
                const reason = normalizeAuthError(message);
                trackEvent('auth_failure', { flow, method: 'password', reason });
                return { ok: false, message: reason };
            }
        },
        [setSessionUser],
    );

    const loginWithOAuthProvider = useCallback(
        async (provider: 'google' | 'apple'): Promise<AuthResult> => {
            if (!isSupabaseLive() || !supabase) {
                return { ok: false, message: 'Sosyal giris icin Supabase gerekli.' };
            }

            try {
                rememberPostAuthHash();
                const redirectTo = buildAuthRedirectTo();
                const { error } = await supabase.auth.signInWithOAuth({
                    provider,
                    options: { redirectTo },
                });

                if (error) return { ok: false, message: normalizeAuthError(error.message) };
                return { ok: true };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'OAuth login failed.';
                return { ok: false, message: normalizeAuthError(message) };
            }
        },
        [],
    );

    const loginWithGoogle = useCallback(
        (): Promise<AuthResult> => loginWithOAuthProvider('google'),
        [loginWithOAuthProvider],
    );

    const loginWithApple = useCallback(
        (): Promise<AuthResult> => loginWithOAuthProvider('apple'),
        [loginWithOAuthProvider],
    );

    const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            return { ok: false, message: 'E-posta gerekli.' };
        }

        if (!isSupabaseLive() || !supabase) {
            return { ok: false, message: 'Sifre sifirlama icin Supabase gerekli.' };
        }

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: buildAuthRedirectTo(),
            });
            if (error) return { ok: false, message: normalizeAuthError(error.message) };
            return {
                ok: true,
                message: 'Sifre yenileme baglantisi e-posta adresine gonderildi.',
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Password reset failed.';
            return { ok: false, message: normalizeAuthError(message) };
        }
    }, []);

    const completePasswordReset = useCallback(
        async (newPassword: string): Promise<AuthResult> => {
            const normalizedPassword = newPassword.trim();
            if (normalizedPassword.length < 6) {
                return { ok: false, message: 'Sifre en az 6 karakter olmali.' };
            }

            if (!isSupabaseLive() || !supabase) {
                return { ok: false, message: 'Sifre guncelleme icin Supabase gerekli.' };
            }

            try {
                const { error } = await supabase.auth.updateUser({ password: normalizedPassword });
                if (error) return { ok: false, message: normalizeAuthError(error.message) };

                setIsPasswordRecoveryMode(false);
                clearRecoveryUrlState();
                return {
                    ok: true,
                    message: 'Sifre guncellendi.',
                    whisper: 'Password updated.',
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Password update failed.';
                return { ok: false, message: normalizeAuthError(message) };
            }
        },
        [],
    );

    const logout = useCallback(async () => {
        if (isSupabaseLive() && supabase) {
            await supabase.auth.signOut();
        }
        setSessionUser(null);
        setIsPasswordRecoveryMode(false);
    }, [setSessionUser]);

    const consumePendingRegistration = useCallback((): PendingRegistrationProfile | null => {
        const pending = pendingRegistrationProfileRef.current;
        pendingRegistrationProfileRef.current = null;
        return pending;
    }, []);

    const mergeSessionUser = useCallback(
        (patch: Partial<SessionUser>) => {
            const current = sessionUserRef.current;
            if (!current) return;
            setSessionUser({ ...current, ...patch });
        },
        [setSessionUser],
    );

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            authMode,
            isPasswordRecoveryMode,
            login,
            loginWithGoogle,
            loginWithApple,
            requestPasswordReset,
            completePasswordReset,
            logout,
            consumePendingRegistration,
            mergeSessionUser,
        }),
        [
            user,
            authMode,
            isPasswordRecoveryMode,
            login,
            loginWithGoogle,
            loginWithApple,
            requestPasswordReset,
            completePasswordReset,
            logout,
            consumePendingRegistration,
            mergeSessionUser,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
};
