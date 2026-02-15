import React, { useEffect, useMemo, useState } from 'react';
import { useXP, type RegistrationGender } from '../../context/XPContext';
import { useLanguage } from '../../context/LanguageContext';
import { getRegistrationGenderOptions } from '../../i18n/localization';
import { trackEvent } from '../../lib/analytics';

export const LoginView: React.FC = () => {
    const {
        login,
        loginWithGoogle,
        requestPasswordReset,
        completePasswordReset,
        isPasswordRecoveryMode,
        authMode
    } = useXP();
    const { text, language } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState<RegistrationGender>('prefer_not_to_say');
    const [birthDate, setBirthDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const todayIso = new Date().toISOString().split('T')[0];
    const isResettingPassword = isPasswordRecoveryMode;
    const isPasswordOnlyFlow = isForgotPassword || isResettingPassword;
    const modeBadge = isResettingPassword
        ? text.login.modeResetPassword
        : isForgotPassword
            ? text.login.modeForgotPassword
            : isRegistering
                ? text.login.modeRegister
                : text.login.modeLogin;
    const formTitle = isResettingPassword
        ? text.login.resetPasswordForm
        : isForgotPassword
            ? text.login.forgotPasswordForm
            : isRegistering
                ? text.login.registerForm
                : text.login.loginForm;
    const formInfo = isResettingPassword
        ? text.login.resetPasswordInfo
        : isForgotPassword
            ? text.login.forgotPasswordInfo
            : isRegistering
                ? text.login.registerInfo
                : text.login.loginInfo;
    const genderOptions = useMemo<Array<{ value: RegistrationGender; label: string }>>(
        () => getRegistrationGenderOptions(language),
        [language]
    );

    useEffect(() => {
        if (!isPasswordRecoveryMode) return;
        setIsRegistering(false);
        setIsForgotPassword(false);
        setStatusMessage('');
        setErrorMessage('');
    }, [isPasswordRecoveryMode]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = '180_analytics_auth_view_seen_v1';
        if (window.sessionStorage.getItem(key) === '1') return;
        window.sessionStorage.setItem(key, '1');
        trackEvent('auth_view', { authMode });
    }, [authMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setErrorMessage('');
        setStatusMessage('');
        const flow = isResettingPassword
            ? 'reset_password'
            : isForgotPassword
                ? 'forgot_password'
                : isRegistering
                    ? 'register'
                    : 'login';
        trackEvent('auth_submit', { flow, method: 'password', authMode });

        try {
            if (isResettingPassword) {
                if (password.length < 6) {
                    setErrorMessage(text.login.passwordPlaceholder);
                    trackEvent('auth_failure', { flow, method: 'password', reason: 'password_too_short' });
                    return;
                }
                if (password !== confirmPassword) {
                    setErrorMessage(text.login.passwordMismatch);
                    trackEvent('auth_failure', { flow, method: 'password', reason: 'password_mismatch' });
                    return;
                }

                const result = await completePasswordReset(password);
                if (!result.ok) {
                    setErrorMessage(result.message || text.login.resetPasswordFailed);
                    return;
                }
                setStatusMessage(result.message || text.login.resetPasswordSuccess);
                setConfirmPassword('');
                setPassword('');
                return;
            }

            if (isForgotPassword) {
                const result = await requestPasswordReset(email);
                if (!result.ok) {
                    setErrorMessage(result.message || text.login.forgotPasswordFailed);
                    return;
                }
                setStatusMessage(result.message || text.login.forgotPasswordSuccess);
                return;
            }

            const result = await login(
                email,
                password,
                isRegistering,
                isRegistering
                    ? {
                        fullName,
                        username,
                        gender,
                        birthDate
                    }
                    : undefined
            );
            if (!result.ok) {
                setErrorMessage(result.message || text.login.loginFailed);
                return;
            }
            if (result.message) {
                setStatusMessage(result.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogle = async () => {
        if (isGoogleLoading) return;
        setIsGoogleLoading(true);
        setErrorMessage('');
        setStatusMessage('');
        trackEvent('oauth_start', { provider: 'google', authMode });

        try {
            const result = await loginWithGoogle();
            if (!result.ok) {
                setErrorMessage(result.message || text.login.googleFailed);
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const switchToLogin = () => {
        setIsRegistering(false);
        setIsForgotPassword(false);
        setErrorMessage('');
        setStatusMessage('');
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#121212] flex flex-col items-center justify-center animate-fade-in p-6 overflow-hidden">
            <div className="w-full max-w-sm flex flex-col items-center">
                <div className="mb-12 text-center pointer-events-none select-none">
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-sage mb-4 drop-shadow-sm opacity-90">
                        180
                    </h1>
                    <p className="text-[#E5E4E2] font-medium tracking-[0.4em] text-xs uppercase opacity-60">
                        {text.app.brandSubtitle}
                    </p>
                    <div className="mt-6 text-[10px] font-bold text-sage/70 tracking-widest border-b border-sage/10 pb-1 inline-block uppercase">
                        {modeBadge}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 animate-slide-up bg-white/5 p-8 rounded-xl border border-white/5 backdrop-blur-sm">
                    {!isPasswordOnlyFlow && (
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 p-1 bg-[#141414]">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRegistering(false);
                                    setIsForgotPassword(false);
                                    setErrorMessage('');
                                    setStatusMessage('');
                                }}
                                className={`px-3 py-2 text-[10px] uppercase tracking-[0.18em] rounded transition-colors font-bold ${!isRegistering ? 'bg-sage text-[#121212]' : 'text-gray-400 hover:text-sage'}`}
                            >
                                {text.login.modeLogin}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRegistering(true);
                                    setIsForgotPassword(false);
                                    setErrorMessage('');
                                    setStatusMessage('');
                                }}
                                className={`px-3 py-2 text-[10px] uppercase tracking-[0.18em] rounded transition-colors font-bold ${isRegistering ? 'bg-clay text-[#121212]' : 'text-gray-400 hover:text-clay'}`}
                            >
                                {text.login.modeRegister}
                            </button>
                        </div>
                    )}

                    {isForgotPassword && !isResettingPassword && (
                        <button
                            type="button"
                            onClick={switchToLogin}
                            className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] rounded transition-colors font-bold border border-white/10 text-gray-300 hover:text-sage hover:border-sage/40"
                        >
                            {text.login.backToLogin}
                        </button>
                    )}

                    <div className="text-left">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-sage/80 font-bold">
                            {formTitle}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            {formInfo}
                        </p>
                    </div>

                    {isRegistering && !isPasswordOnlyFlow && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">{text.login.fullName}</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder={text.login.fullNamePlaceholder}
                                    className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-clay outline-none rounded-md placeholder-sage/30 transition-colors"
                                    minLength={2}
                                    required={isRegistering}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">{text.login.username}</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                                    placeholder={text.login.usernamePlaceholder}
                                    className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-clay outline-none rounded-md placeholder-sage/30 transition-colors"
                                    pattern="[A-Za-z0-9_]{3,20}"
                                    title="3-20 chars: letters, numbers, underscore"
                                    required={isRegistering}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">{text.login.gender}</label>
                                    <select
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value as RegistrationGender)}
                                        className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-clay outline-none rounded-md"
                                    >
                                        {genderOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">{text.login.birthDate}</label>
                                    <input
                                        type="date"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        max={todayIso}
                                        className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-clay outline-none rounded-md"
                                        required={isRegistering}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {!isResettingPassword && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">{text.login.email}</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={text.login.emailPlaceholder}
                                className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                                autoFocus
                                required={!isResettingPassword}
                            />
                        </div>
                    )}

                    {!isForgotPassword && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">
                                {isResettingPassword ? text.login.newPassword : text.login.password}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isResettingPassword ? text.login.newPasswordPlaceholder : text.login.passwordPlaceholder}
                                className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                                minLength={6}
                                required={!isForgotPassword}
                            />
                        </div>
                    )}

                    {isResettingPassword && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">{text.login.confirmNewPassword}</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={text.login.confirmNewPasswordPlaceholder}
                                className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                                minLength={6}
                                required={isResettingPassword}
                            />
                        </div>
                    )}

                    {!isRegistering && !isPasswordOnlyFlow && authMode === 'supabase' && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsForgotPassword(true);
                                setErrorMessage('');
                                setStatusMessage('');
                            }}
                            className="text-left text-[10px] uppercase tracking-[0.18em] text-sage/80 hover:text-sage transition-colors"
                        >
                            {text.login.forgotPasswordLink}
                        </button>
                    )}

                    {errorMessage && (
                        <div className="text-[10px] tracking-[0.16em] uppercase text-red-400/90 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
                            {errorMessage}
                        </div>
                    )}

                    {statusMessage && (
                        <div className="text-[10px] tracking-[0.16em] uppercase text-sage/90 border border-sage/20 bg-sage/10 rounded px-3 py-2">
                            {statusMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full font-bold py-3 uppercase tracking-[0.2em] rounded-md transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed ${isRegistering ? 'bg-clay text-[#121212] hover:bg-[#b78374]' : 'bg-sage text-[#121212] hover:bg-[#9AB06B]'}`}
                    >
                        {isSubmitting
                            ? text.login.submitLoading
                            : isResettingPassword
                                ? text.login.submitResetPassword
                                : isForgotPassword
                                    ? text.login.submitForgotPassword
                                    : isRegistering
                                        ? text.login.submitRegister
                                        : text.login.submitLogin}
                    </button>

                    {!isPasswordOnlyFlow && (
                        <>
                            <div className="flex items-center gap-4 my-2">
                                <div className="h-px bg-white/10 flex-1"></div>
                                <span className="text-[9px] uppercase tracking-widest text-gray-600">{text.login.or}</span>
                                <div className="h-px bg-white/10 flex-1"></div>
                            </div>

                            {authMode === 'supabase' ? (
                                <button
                                    type="button"
                                    onClick={handleGoogle}
                                    disabled={isGoogleLoading}
                                    className="w-full bg-white/10 text-[#E5E4E2] font-bold py-3 uppercase tracking-[0.15em] text-xs rounded-md hover:bg-white/15 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <div className="w-3 h-3 bg-current rounded-full opacity-50"></div>
                                    {isGoogleLoading ? text.login.googleRedirecting : text.login.googleContinue}
                                </button>
                            ) : (
                                <div className="text-[10px] text-gray-500 text-center border border-white/10 rounded px-3 py-2">
                                    {text.login.localAuthInfo}
                                </div>
                            )}
                        </>
                    )}
                </form>
            </div>
        </div>
    );
};
