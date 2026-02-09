/*
 * DESIGN LOCKED - DO NOT MODIFY WITHOUT EXPLICIT PERMISSION
 * This layout has been approved and locked by the user.
 */
import React, { useMemo, useState } from 'react';
import { SparkMark } from '../../components/icons/SparkMark';
import { GridMark } from '../../components/icons/GridMark';
import { SunMark } from '../../components/icons/SunMark';
import { useLanguage } from '../../context/LanguageContext';
import { SUPPORTED_LANGUAGE_OPTIONS } from '../../i18n/localization';

interface LandingPageProps {
    onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
    const { text, language, setLanguage } = useLanguage();
    const [activeInfoSection, setActiveInfoSection] = useState<'manifesto' | 'rules' | 'contact' | null>(null);
    const activeInfo = useMemo(() => {
        if (activeInfoSection === 'manifesto') {
            return {
                title: text.landing.manifestoTitle,
                body: text.landing.manifestoBody,
                points: text.landing.manifestoPoints
            };
        }
        if (activeInfoSection === 'rules') {
            return {
                title: text.landing.rulesTitle,
                body: text.landing.rulesBody,
                points: text.landing.rulesPoints
            };
        }
        if (activeInfoSection === 'contact') {
            return {
                title: text.landing.footerContact,
                body: '',
                points: [
                    'Gmail: 180absolutecinema@gmail.com',
                    'X: https://x.com/180absolutecnma'
                ]
            };
        }
        return null;
    }, [
        activeInfoSection,
        text.landing.footerContact,
        text.landing.manifestoBody,
        text.landing.manifestoPoints,
        text.landing.manifestoTitle,
        text.landing.rulesBody,
        text.landing.rulesPoints,
        text.landing.rulesTitle
    ]);

    const toggleInfoSection = (nextSection: 'manifesto' | 'rules' | 'contact') => {
        setActiveInfoSection((prev) => (prev === nextSection ? null : nextSection));
    };

    return (
        <div className="min-h-screen bg-[#121212] text-[#E5E4E2] font-sans selection:bg-sage selection:text-white overflow-x-hidden flex flex-col">
            <nav className="w-full z-50 px-6 py-8 flex justify-between items-center bg-[#121212]">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold tracking-tighter text-sage">180</span>
                    <span className="h-4 w-px bg-white/10 hidden md:block" />
                    <span className="text-xs tracking-[0.2em] font-medium text-white/40 hidden md:block">
                        {text.app.brandSubtitle.toUpperCase()}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1"
                        aria-label={text.settings.language}
                    >
                        {SUPPORTED_LANGUAGE_OPTIONS.map((option) => (
                            <button
                                key={option.code}
                                type="button"
                                onClick={() => setLanguage(option.code)}
                                title={option.label}
                                aria-label={option.label}
                                className={`px-2 py-1 text-[9px] uppercase tracking-[0.16em] rounded transition-colors ${
                                    language === option.code
                                        ? 'bg-sage/20 text-sage font-bold'
                                        : 'text-white/55 hover:text-sage'
                                }`}
                            >
                                {option.code}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onStart}
                        className="text-xs uppercase tracking-widest hover:text-white text-sage transition-colors font-bold"
                    >
                        {text.landing.login}
                    </button>
                </div>
            </nav>

            <main className="flex-grow flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-6 pt-12 pb-20 text-center">
                <div className="mb-8 flex flex-col items-center animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sage/20 bg-sage/5 mb-8">
                        <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest text-sage font-bold">{text.landing.refreshInfo}</span>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-white mb-6 leading-[0.9]">
                        {text.landing.titleLine1}
                        <br />
                        <span className="text-sage">{text.landing.titleLine2}</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-[#E5E4E2]/80 font-light leading-relaxed max-w-2xl mb-10">
                        {text.landing.subtitle}
                    </p>

                    <button
                        onClick={onStart}
                        className="px-10 py-4 bg-sage text-[#121212] font-bold uppercase tracking-widest text-xs rounded hover:bg-[#9AB06B] transition-all hover:shadow-[0_0_30px_rgba(163,177,138,0.4)] hover:scale-105 active:scale-95"
                    >
                        {text.landing.start}
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12 border-t border-white/10 pt-12 w-full max-w-3xl">
                    <div className="group flex flex-col items-center">
                        <div className="text-sage mb-4 p-3 bg-sage/10 rounded-full">
                            <SunMark className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">{text.landing.featureDailyTitle}</h3>
                        <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">
                            {text.landing.featureDailyText}
                        </p>
                    </div>
                    <div className="group flex flex-col items-center">
                        <div className="text-clay mb-4 p-3 bg-[#E5E4E2]/10 rounded-full">
                            <GridMark className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">{text.landing.featureCommentTitle}</h3>
                        <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">
                            {text.landing.featureCommentText}
                        </p>
                    </div>
                    <div className="group flex flex-col items-center">
                        <div className="text-purple-400 mb-4 p-3 bg-purple-500/10 rounded-full">
                            <SparkMark className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">{text.landing.featureProgressTitle}</h3>
                        <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">
                            {text.landing.featureProgressText}
                        </p>
                    </div>
                </div>
            </main>

            <div className="px-6 pb-4">
                <div className={`max-w-3xl mx-auto transition-all duration-300 overflow-hidden ${activeInfo ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    {activeInfo && (
                        <section className="rounded-xl border border-sage/25 bg-white/5 backdrop-blur-sm px-5 sm:px-6 py-5 sm:py-6 animate-fade-in">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <h3 className="text-sm sm:text-base font-bold tracking-[0.12em] uppercase text-sage">
                                    {activeInfo.title}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setActiveInfoSection(null)}
                                    className="text-[10px] uppercase tracking-[0.18em] text-white/40 hover:text-sage transition-colors"
                                >
                                    {text.landing.infoPanelClose}
                                </button>
                            </div>
                            <p className="text-sm text-[#E5E4E2]/80 leading-relaxed mb-4">
                                {activeInfo.body}
                            </p>
                            {activeInfo.points.length > 0 && (
                                <ul className="space-y-2">
                                    {activeInfo.points.map((point) => (
                                        <li key={point} className="text-xs sm:text-sm text-[#E5E4E2]/70 leading-relaxed flex items-start gap-2">
                                            <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-sage/80 shrink-0" />
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                </div>
            </div>

            <footer className="py-8 px-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20">
                <p>2026 180 Absolute Cinema</p>
                <div className="flex gap-6">
                    <button
                        type="button"
                        onClick={() => toggleInfoSection('manifesto')}
                        className={`transition-colors ${activeInfoSection === 'manifesto' ? 'text-sage' : 'hover:text-sage'}`}
                    >
                        {text.landing.footerManifesto}
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleInfoSection('rules')}
                        className={`transition-colors ${activeInfoSection === 'rules' ? 'text-sage' : 'hover:text-sage'}`}
                    >
                        {text.landing.footerRules}
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleInfoSection('contact')}
                        className={`transition-colors ${activeInfoSection === 'contact' ? 'text-sage' : 'hover:text-sage'}`}
                    >
                        {text.landing.footerContact}
                    </button>
                </div>
            </footer>
        </div>
    );
};
