
/* 
 * DESIGN LOCKED - DO NOT MODIFY WITHOUT EXPLICIT PERMISSION
 * This layout has been approved and locked by the user.
 * See LandingPage.locked.tsx for the backup.
 */
import React from 'react';
import { SparkMark } from '../../components/icons/SparkMark';
import { GridMark } from '../../components/icons/GridMark';
import { SunMark } from '../../components/icons/SunMark';

interface LandingPageProps {
    onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {

    return (
        <div className="min-h-screen bg-[#121212] text-[#E5E4E2] font-sans selection:bg-sage selection:text-white overflow-x-hidden flex flex-col">
            {/* Top Navigation */}
            <nav className="w-full z-50 px-6 py-8 flex justify-between items-center bg-[#121212]">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold tracking-tighter text-sage">180</span>
                    <span className="h-4 w-px bg-white/10 hidden md:block" />
                    <span className="text-xs tracking-[0.2em] font-medium text-white/40 hidden md:block">
                        ABSOLUTE CINEMA
                    </span>
                </div>
                <button
                    onClick={onStart}
                    className="text-xs uppercase tracking-widest hover:text-white text-sage transition-colors font-bold"
                >
                    Giriş Yap
                </button>
            </nav>

            {/* Main Content Area */}
            <main className="flex-grow flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-6 pt-12 pb-20 text-center">

                <div className="mb-8 flex flex-col items-center animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sage/20 bg-sage/5 mb-8">
                        <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest text-sage font-bold">Her Gün 00:00'da Yenilenir</span>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-white mb-6 leading-[0.9]">
                        GÜNLÜK<br />
                        <span className="text-sage">SİNEMA RİTÜELİ</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-[#E5E4E2]/80 font-light leading-relaxed max-w-2xl mb-10">
                        Her gün yeni 5 film. Birini izlemen diğer güne geçmen için yeterli.
                    </p>

                    <button
                        onClick={onStart}
                        className="px-10 py-4 bg-sage text-[#121212] font-bold uppercase tracking-widest text-xs rounded hover:bg-[#9AB06B] transition-all hover:shadow-[0_0_30px_rgba(163,177,138,0.4)] hover:scale-105 active:scale-95"
                    >
                        Başla
                    </button>
                </div>

                {/* Features Mini-Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12 border-t border-white/10 pt-12 w-full max-w-3xl">
                    <div className="group flex flex-col items-center">
                        <div className="text-sage mb-4 p-3 bg-sage/10 rounded-full">
                            <SunMark className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">Günlük 5'li</h3>
                        <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">
                            Her sabah yenilenen 5 filmlik özel seçki.
                        </p>
                    </div>
                    <div className="group flex flex-col items-center">
                        <div className="text-clay mb-4 p-3 bg-[#E5E4E2]/10 rounded-full">
                            <GridMark className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">180 Karakter</h3>
                        <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">
                            Uzun inceleme yok. Sadece özü anlat.
                        </p>
                    </div>
                    <div className="group flex flex-col items-center">
                        <div className="text-purple-400 mb-4 p-3 bg-purple-500/10 rounded-full">
                            <SparkMark className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">XP Sistemi</h3>
                        <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">
                            Figüran olarak başla, Yönetmen ol.
                        </p>
                    </div>
                </div>

            </main>

            <footer className="py-8 px-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20">
                <p>2026 180 Absolute Cinema</p>
                <div className="flex gap-6">
                    <button className="hover:text-sage transition-colors">Manifesto</button>
                    <button className="hover:text-sage transition-colors">Kurallar</button>
                    <button className="hover:text-sage transition-colors">İletişim</button>
                </div>
            </footer>
        </div>
    );
};
