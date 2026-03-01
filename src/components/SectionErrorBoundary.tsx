import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
    LANGUAGE_STORAGE_KEY,
    PRIMARY_LANGUAGE,
    isLanguageCode,
    type LanguageCode
} from '../i18n/localization';

type SectionErrorBoundaryProps = {
    title: string;
    fallbackMessage?: string;
    children?: ReactNode;
};

type SectionErrorBoundaryState = {
    hasError: boolean;
};

const SECTION_ERROR_COPY: Record<LanguageCode, string> = {
    en: 'This module is temporarily unavailable. Refresh to retry.',
    tr: 'Bu modül geçici olarak kullanılamıyor. Yenileyip tekrar dene.',
    es: 'Este modulo no esta disponible temporalmente. Recarga para volver a intentarlo.',
    fr: 'Ce module est temporairement indisponible. Actualise pour reessayer.'
};

const getSectionErrorLanguage = (): LanguageCode => {
    if (typeof window === 'undefined') return PRIMARY_LANGUAGE;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(storedLanguage) ? storedLanguage : PRIMARY_LANGUAGE;
};

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
    public state: SectionErrorBoundaryState = {
        hasError: false
    };

    public static getDerivedStateFromError(): SectionErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[SectionErrorBoundary] ${this.props.title}`, error, info);
    }

    public render() {
        if (this.state.hasError) {
            const fallbackMessage = this.props.fallbackMessage || SECTION_ERROR_COPY[getSectionErrorLanguage()];
            return (
                <section className="max-w-6xl mx-auto mb-10 rounded-xl border border-red-400/25 bg-red-500/5 px-5 py-6">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-red-200 mb-2">{this.props.title}</h3>
                    <p className="text-xs text-red-100/80">
                        {fallbackMessage}
                    </p>
                </section>
            );
        }

        return this.props.children;
    }
}
