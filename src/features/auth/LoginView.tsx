import React, { useState } from 'react';
import { useXP, type RegistrationGender } from '../../context/XPContext';

const GENDER_OPTIONS: Array<{ value: RegistrationGender; label: string }> = [
    { value: 'female', label: 'Kadin' },
    { value: 'male', label: 'Erkek' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'prefer_not_to_say', label: 'Belirtmek istemiyorum' }
];

export const LoginView: React.FC = () => {
    const { login, loginWithGoogle, authMode } = useXP();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState<RegistrationGender>('prefer_not_to_say');
    const [birthDate, setBirthDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const todayIso = new Date().toISOString().split('T')[0];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
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
                        {isRegistering ? 'NEW MEMBER FORM' : 'MEMBER LOGIN'}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 animate-slide-up bg-white/5 p-8 rounded-xl border border-white/5 backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 p-1 bg-[#141414]">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegistering(false);
                                setErrorMessage('');
                                setStatusMessage('');
                            }}
                            className={`px-3 py-2 text-[10px] uppercase tracking-[0.18em] rounded transition-colors font-bold ${!isRegistering ? 'bg-sage text-[#121212]' : 'text-gray-400 hover:text-sage'}`}
                        >
                            Uye Girisi
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegistering(true);
                                setErrorMessage('');
                                setStatusMessage('');
                            }}
                            className={`px-3 py-2 text-[10px] uppercase tracking-[0.18em] rounded transition-colors font-bold ${isRegistering ? 'bg-clay text-[#121212]' : 'text-gray-400 hover:text-clay'}`}
                        >
                            Yeni Uyelik
                        </button>
                    </div>

                    <div className="text-left">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-sage/80 font-bold">
                            {isRegistering ? 'Kayit Formu' : 'Giris Formu'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            {isRegistering
                                ? 'Kullanici adi, cinsiyet ve dogum tarihi profiline kaydedilir.'
                                : 'Mevcut hesabinla giris yap.'}
                        </p>
                    </div>

                    {isRegistering && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">Isim Soyisim</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Ad Soyad"
                                    className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-clay outline-none rounded-md placeholder-sage/30 transition-colors"
                                    minLength={2}
                                    required={isRegistering}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">Kullanici Adi</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                                    placeholder="ornek_kullanici"
                                    className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-clay outline-none rounded-md placeholder-sage/30 transition-colors"
                                    pattern="[A-Za-z0-9_]{3,20}"
                                    title="3-20 karakter: harf, rakam veya alt cizgi"
                                    required={isRegistering}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">Cinsiyet</label>
                                    <select
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value as RegistrationGender)}
                                        className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-clay outline-none rounded-md"
                                    >
                                        {GENDER_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">Dogum Tarihi</label>
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
                        className={`w-full font-bold py-3 uppercase tracking-[0.2em] rounded-md transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed ${isRegistering ? 'bg-clay text-[#121212] hover:bg-[#b78374]' : 'bg-sage text-[#121212] hover:bg-[#9AB06B]'}`}
                    >
                        {isSubmitting ? 'Please wait...' : isRegistering ? 'Kayit Ol' : 'Giris Yap'}
                    </button>

                    {!isRegistering && (
                        <>
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
                        </>
                    )}
                </form>
            </div>
        </div>
    );
};
