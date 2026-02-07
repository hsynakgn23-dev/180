import React, { useState } from 'react';
import { useXP } from '../../context/XPContext';

export const LoginView: React.FC = () => {
    const { login, loginWithGoogle, loginAsControl, authMode } = useXP();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [controlPin, setControlPin] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isControlLoading, setIsControlLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const configuredControlPin = (import.meta.env.VITE_CONTROL_ADMIN_PIN || '').trim();
    const hasConfiguredControlPin = configuredControlPin.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            const result = await login(email, password, isRegistering);
            if (!result.ok) {
                setErrorMessage(result.message || 'Giris basarisiz.');
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

        try {
            const result = await loginWithGoogle();
            if (!result.ok) {
                setErrorMessage(result.message || 'Google girisi basarisiz.');
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleControlLogin = async () => {
        if (isControlLoading) return;
        if (!hasConfiguredControlPin) {
            setErrorMessage('Kontrol girisi devre disi. VITE_CONTROL_ADMIN_PIN gerekli.');
            setStatusMessage('');
            return;
        }
        setIsControlLoading(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            const result = await loginAsControl(controlPin);
            if (!result.ok) {
                setErrorMessage(result.message || 'Kontrol girisi basarisiz.');
                return;
            }
            if (result.message) {
                setStatusMessage(result.message);
            }
            setControlPin('');
        } finally {
            setIsControlLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#121212] flex flex-col items-center justify-center animate-fade-in p-6 overflow-hidden">
            <div className="w-full max-w-sm flex flex-col items-center">
                <div className="mb-12 text-center pointer-events-none select-none">
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-sage mb-4 drop-shadow-sm opacity-90">
                        180
                    </h1>
                    <p className="text-[#E5E4E2] font-medium tracking-[0.4em] text-xs uppercase opacity-60">
                        Absolute Cinema
                    </p>
                    <div className="mt-6 text-[10px] font-bold text-sage/70 tracking-widest border-b border-sage/10 pb-1 inline-block uppercase">
                        CINEMA LOG
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 animate-slide-up bg-white/5 p-8 rounded-xl border border-white/5 backdrop-blur-sm">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ornek@email.com"
                            className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="minimum 6 karakter"
                            className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                            minLength={6}
                            required
                        />
                    </div>

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
                        className="w-full bg-sage text-[#121212] font-bold py-3 uppercase tracking-[0.2em] rounded-md hover:bg-[#9AB06B] transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Please wait...' : isRegistering ? 'Kayit Ol' : 'Giris Yap'}
                    </button>

                    <div className="flex items-center gap-4 my-2">
                        <div className="h-px bg-white/10 flex-1"></div>
                        <span className="text-[9px] uppercase tracking-widest text-gray-600">OR</span>
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
                            {isGoogleLoading ? 'Yonlendiriliyor...' : 'Google ile Devam Et'}
                        </button>
                    ) : (
                        <div className="text-[10px] text-gray-500 text-center border border-white/10 rounded px-3 py-2">
                            Supabase auth tanimli degil, local login modu aktif.
                        </div>
                    )}

                    <div className="mt-1 border border-[#8A9A5B]/20 bg-[#8A9A5B]/5 rounded-md p-4">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-sage/80 mb-2">
                            Control Access
                        </p>
                        <div className="flex flex-col gap-2">
                            <input
                                type="password"
                                value={controlPin}
                                onChange={(e) => setControlPin(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleControlLogin();
                                    }
                                }}
                                placeholder="Admin control PIN"
                                className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-2.5 text-xs text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={handleControlLogin}
                                disabled={isControlLoading || !hasConfiguredControlPin}
                                className="w-full bg-[#8A9A5B] text-[#121212] font-bold py-2.5 uppercase tracking-[0.2em] text-[10px] rounded-md hover:bg-[#9AB06B] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isControlLoading ? 'Please wait...' : 'Admin Girisi'}
                            </button>
                        </div>
                        <p className="text-[9px] text-[#E5E4E2]/45 mt-2">
                            Uyelik gerektirmeyen kontrol oturumu.
                        </p>
                        {!hasConfiguredControlPin && (
                            <p className="text-[9px] text-red-300/85 mt-1">
                                PIN tanimli degil. `.env` icine `VITE_CONTROL_ADMIN_PIN` ekleyip dev server'i yeniden baslat.
                            </p>
                        )}
                    </div>

                    <div className="text-center mt-4">
                        <p className="text-[10px] text-gray-500 cursor-pointer hover:text-sage transition-colors" onClick={() => setIsRegistering(!isRegistering)}>
                            {isRegistering ? "Hesabin var mi? Giris Yap" : "Hesabin yok mu? Kayit Ol"}
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};
