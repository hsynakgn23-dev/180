import React, { useState } from 'react';
import { useXP } from '../../context/XPContext';

export const LoginView: React.FC = () => {
    const { login } = useXP();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email?.trim() || '';
        if (trimmedEmail.length > 3) {
            // Mock authentication - ensure we pass a valid string
            login(trimmedEmail);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#121212] flex flex-col items-center justify-center animate-fade-in p-6 overflow-hidden">
            <div className="w-full max-w-sm flex flex-col items-center">
                {/* Logo */}
                <div className="mb-12 text-center pointer-events-none select-none">
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-sage mb-4 drop-shadow-sm opacity-90">
                        180
                    </h1>
                    <p className="text-[#E5E4E2] font-medium tracking-[0.4em] text-xs uppercase opacity-60">
                        Absolute Cinema
                    </p>
                    <div className="mt-6 text-[10px] font-bold text-sage/70 tracking-widest border-b border-sage/10 pb-1 inline-block uppercase">
                        SİNEMA GÜNLÜĞÜNÜ OLUŞTUR
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 animate-slide-up bg-white/5 p-8 rounded-xl border border-white/5 backdrop-blur-sm">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">E-Posta</label>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ornek@email.com"
                            className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                            autoFocus
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-[#E5E4E2]/50 font-bold ml-1">Şifre</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••"
                            className="w-full bg-[#121212] border border-[#E5E4E2]/10 p-3 text-sm text-[#E5E4E2] focus:border-sage outline-none rounded-md placeholder-sage/30 transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-sage text-[#121212] font-bold py-3 uppercase tracking-[0.2em] rounded-md hover:bg-[#9AB06B] transition-colors mt-2"
                    >
                        {isRegistering ? 'Kayıt Ol' : 'Giriş Yap'}
                    </button>

                    <div className="flex items-center gap-4 my-2">
                        <div className="h-px bg-white/10 flex-1"></div>
                        <span className="text-[9px] uppercase tracking-widest text-gray-600">VEYA</span>
                        <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    <button
                        type="button"
                        onClick={() => login(`google_user_${Math.floor(Math.random() * 1000)}@gmail.com`)}
                        className="w-full bg-white/10 text-[#E5E4E2] font-bold py-3 uppercase tracking-[0.15em] text-xs rounded-md hover:bg-white/15 transition-colors flex items-center justify-center gap-2"
                    >
                        <div className="w-3 h-3 bg-current rounded-full opacity-50"></div>
                        Google ile Devam Et
                    </button>

                    <div className="text-center mt-4">
                        <p className="text-[10px] text-gray-500 cursor-pointer hover:text-sage transition-colors" onClick={() => setIsRegistering(!isRegistering)}>
                            {isRegistering ? "Hesabın var mı? Giriş Yap" : "Hesabın yok mu? Kayıt Ol"}
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};
