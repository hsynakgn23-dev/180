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
                        label: 'Gmail',
                        value: '180absolutecinema@gmail.com',
                        href: 'mailto:180absolutecinema@gmail.com'
                    },
                    {
                        kind: 'link',
                        label: 'X',
                        value: 'x.com/180absolutecnma',
                        href: 'https://x.com/180absolutecnma'
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
                            <p className="text-sm text-[#E5E4E2]/80 leading-relaxed mb-4">
                                {activeInfo.body}
                            </p>
                            {activeInfo.points.length > 0 && (
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

