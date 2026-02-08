import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
    LANGUAGE_DICTIONARY,
    LANGUAGE_STORAGE_KEY,
    LANGUAGE_CHANGE_EVENT,
    type FormatParams,
    formatTemplate,
    getDictionaryForLanguage,
    getLeagueCopy,
    getMarkCategoryLabel,
    getMarkCopy,
    isLanguageCode,
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
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(stored) ? stored : 'tr';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<LanguageCode>(() => getInitialLanguage());

    const setLanguage = (nextLanguage: LanguageCode) => {
        setLanguageState(nextLanguage);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: nextLanguage }));
    };

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== LANGUAGE_STORAGE_KEY) return;
            if (!isLanguageCode(event.newValue)) return;
            setLanguageState(event.newValue);
        };

        const handleLanguageEvent = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (!isLanguageCode(customEvent.detail)) return;
            setLanguageState(customEvent.detail);
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageEvent);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageEvent);
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
        [language, text]
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

