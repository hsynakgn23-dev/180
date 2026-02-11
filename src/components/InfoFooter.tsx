import React, { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

type InfoSection = 'manifesto' | 'rules';

interface InfoFooterProps {
    className?: string;
    panelWrapperClassName?: string;
    footerClassName?: string;
}

const SOCIAL_LINKS = [
    {
        label: 'X',
        href: 'https://x.com/180absolutecnma'
    },
    {
        label: 'Instagram',
        href: 'https://www.instagram.com/180absolutecinema/'
    },
    {
        label: 'TikTok',
        href: 'https://www.tiktok.com/@180absolutecinema'
    }
] as const;

const renderSocialIcon = (label: string) => {
    if (label === 'X') {
        return (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                    d="M4 4h4.2l4.1 5.8L17 4h3l-6.2 7.3L20.3 20h-4.2l-4.6-6.4L6.4 20h-3l6.4-7.6L4 4z"
                    fill="currentColor"
                />
            </svg>
        );
    }

    if (label === 'Instagram') {
        return (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <rect
                    x="3.5"
                    y="3.5"
                    width="17"
                    height="17"
                    rx="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                />
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="17.25" cy="6.75" r="1.25" fill="currentColor" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
                d="M13.9 4c.7 2 2 3.4 4.1 4.1v3c-1.5-.1-2.9-.6-4.1-1.5v6.2a5.4 5.4 0 1 1-4.6-5.3v3.1a2.3 2.3 0 1 0 1.5 2.1V4h3.1z"
                fill="currentColor"
            />
        </svg>
    );
};

export const InfoFooter: React.FC<InfoFooterProps> = ({
    className = '',
    panelWrapperClassName = 'px-6 pb-4',
    footerClassName = 'py-8 px-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20'
}) => {
    const { text } = useLanguage();
    const [activeInfoSection, setActiveInfoSection] = useState<InfoSection | null>(null);

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
        return null;
    }, [
        activeInfoSection,
        text.landing.manifestoBody,
        text.landing.manifestoPoints,
        text.landing.manifestoTitle,
        text.landing.rulesBody,
        text.landing.rulesPoints,
        text.landing.rulesTitle
    ]);

    const toggleInfoSection = (nextSection: InfoSection) => {
        setActiveInfoSection((prev) => (prev === nextSection ? null : nextSection));
    };

    return (
        <div className={className}>
            <div className={panelWrapperClassName}>
                <div
                    className={`max-w-3xl mx-auto transition-all duration-300 overflow-hidden ${
                        activeInfo ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                >
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
                            {activeInfo.body && (
                                <p className="text-sm text-[#E5E4E2]/80 leading-relaxed mb-4">
                                    {activeInfo.body}
                                </p>
                            )}
                            {activeInfo.points.length > 0 && (
                                <ul className="space-y-2">
                                    {activeInfo.points.map((point, index) => (
                                        <li
                                            key={`${point}-${index}`}
                                            className="text-xs sm:text-sm text-[#E5E4E2]/70 leading-relaxed flex items-start gap-2"
                                        >
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

            <footer className={footerClassName}>
                <p>{new Date().getFullYear()} 180 Absolute Cinema</p>
                <div className="flex gap-6">
                    <button
                        type="button"
                        onClick={() => toggleInfoSection('manifesto')}
                        className={`transition-colors ${
                            activeInfoSection === 'manifesto' ? 'text-sage' : 'hover:text-sage'
                        }`}
                    >
                        {text.landing.footerManifesto}
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleInfoSection('rules')}
                        className={`transition-colors ${
                            activeInfoSection === 'rules' ? 'text-sage' : 'hover:text-sage'
                        }`}
                    >
                        {text.landing.footerRules}
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3">
                        {SOCIAL_LINKS.map((social) => (
                            <a
                                key={social.label}
                                href={social.href}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={social.label}
                                title={social.label}
                                className="rounded-md border border-white/15 bg-white/5 p-2 text-white/70 hover:text-sage hover:border-sage/50 hover:bg-sage/10 transition-colors"
                            >
                                {renderSocialIcon(social.label)}
                            </a>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
};
