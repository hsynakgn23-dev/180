import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    LANGUAGE_DICTIONARY,
    LANGUAGE_STORAGE_KEY,
    PRIMARY_LANGUAGE,
    type FormatParams,
    formatTemplate,
    getDictionaryForLanguage,
    getLeagueCopy,
    getMarkCategoryLabel,
    getMarkCopy,
    isLanguageCode,
    normalizeActiveLanguageCode,
    type LanguageCode
} from '../i18n/localization';

interface LanguageContextType {
    language: LanguageCode;
    setLanguage: (nextLanguage: LanguageCode) => void;
    text: ReturnType<typeof getDictionaryForLanguage>;
    format: (template: string, params?: FormatParams) => string;
    markCopy: (markId: string) => ReturnType<typeof getMarkCopy>;
    markCategory: (category: string) => string;
    leagueCopy: (leagueKey: string) => ReturnType<typeof getLeagueCopy>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getInitialLanguage = (): LanguageCode => {
    if (typeof window === 'undefined') return PRIMARY_LANGUAGE;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(storedLanguage) ? normalizeActiveLanguageCode(storedLanguage) : PRIMARY_LANGUAGE;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<LanguageCode>(() => getInitialLanguage());

    useEffect(() => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }, [language]);

    const setLanguage = useCallback((nextLanguage: LanguageCode) => {
        const normalizedLanguage = normalizeActiveLanguageCode(nextLanguage);
        setLanguageState(normalizedLanguage);
    }, []);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    // Lifecycle: start on [], cleanup on unmount/dep-change
    // Auth reset: not auth-scoped
    // Background: no action (storage subscription is browser-managed)
    // Retry: none — storage event-driven
    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== LANGUAGE_STORAGE_KEY) return;
            if (!isLanguageCode(event.newValue)) return;
            setLanguageState(normalizeActiveLanguageCode(event.newValue));
        };

        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const text = useMemo(() => getDictionaryForLanguage(language), [language]);

    const value = useMemo<LanguageContextType>(
        () => ({
            language,
            setLanguage,
            text,
            format: formatTemplate,
            markCopy: (markId: string) => getMarkCopy(language, markId),
            markCategory: (category: string) => getMarkCategoryLabel(language, category),
            leagueCopy: (leagueKey: string) => getLeagueCopy(language, leagueKey)
        }),
        [language, setLanguage, text]
    );

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export { LANGUAGE_DICTIONARY };
