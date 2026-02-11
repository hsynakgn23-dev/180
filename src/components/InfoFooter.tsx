import React, { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

type InfoSection = 'manifesto' | 'rules' | 'contact';

type InfoPoint =
    | {
          kind: 'text';
          value: string;
      }
    | {
          kind: 'link';
          label: string;
          value: string;
          href: string;
      };

interface InfoFooterProps {
    className?: string;
    panelWrapperClassName?: string;
    footerClassName?: string;
}

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
    const isContactPanelOpen = activeInfoSection === 'contact';

    const activeInfo = useMemo(() => {
        if (activeInfoSection === 'manifesto') {
            return {
                title: text.landing.manifestoTitle,
                body: text.landing.manifestoBody,
                points: text.landing.manifestoPoints.map<InfoPoint>((value) => ({
                    kind: 'text',
                    value
                }))
            };
        }
        if (activeInfoSection === 'rules') {
            return {
                title: text.landing.rulesTitle,
                body: text.landing.rulesBody,
                points: text.landing.rulesPoints.map<InfoPoint>((value) => ({
                    kind: 'text',
                    value
                }))
            };
        }
        if (activeInfoSection === 'contact') {
            return {
                title: text.landing.footerContact,
                body: '',
                points: [
                    {
                        kind: 'link',
                        label: 'X',
                        value: '@180absolutecnma',
                        href: 'https://x.com/180absolutecnma'
                    },
                    {
                        kind: 'link',
                        label: 'Instagram',
                        value: '@180absolutecinema',
                        href: 'https://www.instagram.com/180absolutecinema/'
                    },
                    {
                        kind: 'link',
                        label: 'TikTok',
                        value: '@180absolutecinema',
                        href: 'https://www.tiktok.com/@180absolutecinema'
                    }
                ] as InfoPoint[]
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
                            {isContactPanelOpen ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {activeInfo.points
                                        .filter(
                                            (point): point is Extract<InfoPoint, { kind: 'link' }> =>
                                                point.kind === 'link'
                                        )
                                        .map((point) => (
                                            <a
                                                key={point.label}
                                                href={point.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group rounded-lg border border-sage/30 bg-black/30 px-4 py-3 hover:border-sage hover:bg-sage/10 transition-colors"
                                            >
                                                <span className="flex items-center gap-3">
                                                    <span className="text-sage">{renderSocialIcon(point.label)}</span>
                                                    <span className="flex flex-col text-left leading-tight">
                                                        <span className="text-[10px] uppercase tracking-[0.18em] text-white/70 group-hover:text-white transition-colors">
                                                            {point.label}
                                                        </span>
                                                        <span className="text-xs text-sage/90 group-hover:text-sage transition-colors">
                                                            {point.value}
                                                        </span>
                                                    </span>
                                                </span>
                                            </a>
                                        ))}
                                </div>
                            ) : (
                                activeInfo.points.length > 0 && (
                                <ul className="space-y-2">
                                    {activeInfo.points.map((point, index) => (
                                        <li
                                            key={`${point.kind}-${index}`}
                                            className="text-xs sm:text-sm text-[#E5E4E2]/70 leading-relaxed flex items-start gap-2"
                                        >
                                            <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-sage/80 shrink-0" />
                                            {point.kind === 'link' ? (
                                                <a
                                                    href={point.href}
                                                    target={point.href.startsWith('http') ? '_blank' : undefined}
                                                    rel={point.href.startsWith('http') ? 'noreferrer' : undefined}
                                                    className="text-sage hover:text-[#9AB06B] underline underline-offset-2 break-all"
                                                >
                                                    {point.label}: {point.value}
                                                </a>
                                            ) : (
                                                <span>{point.value}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                )
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
                    <button
                        type="button"
                        onClick={() => toggleInfoSection('contact')}
                        className={`transition-colors ${
                            activeInfoSection === 'contact' ? 'text-sage' : 'hover:text-sage'
                        }`}
                    >
                        {text.landing.footerContact}
                    </button>
                </div>
            </footer>
        </div>
    );
};
