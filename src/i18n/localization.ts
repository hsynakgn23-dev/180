import {
    LEAGUE_DICTIONARY,
    MARK_CATEGORY_DICTIONARY,
    MARK_DICTIONARY,
    UI_DICTIONARY,
    type LanguageCode,
    type MarkCopy,
    type LeagueCopy
} from './dictionary';

export type { LanguageCode };

export const LANGUAGE_STORAGE_KEY = '180_lang_pref';
export const LANGUAGE_CHANGE_EVENT = 'app-language-change';

export const LANGUAGE_DICTIONARY = UI_DICTIONARY;

export type FormatParams = Record<string, string | number | null | undefined>;

export const isLanguageCode = (value: unknown): value is LanguageCode =>
    value === 'tr' || value === 'en';

export const formatTemplate = (template: string, params?: FormatParams): string => {
    if (!params) return template;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, rawKey: string) => {
        const key = rawKey as keyof FormatParams;
        const value = params[key];
        return value === null || value === undefined ? '' : String(value);
    });
};

export const getDictionaryForLanguage = (language: LanguageCode) => UI_DICTIONARY[language];

export const getMarkCopy = (language: LanguageCode, markId: string): MarkCopy => {
    const section = MARK_DICTIONARY[language];
    return (
        section[markId] || {
            title: markId,
            description: '',
            whisper: UI_DICTIONARY[language].xp.markUnlockedFallback
        }
    );
};

export const getMarkCategoryLabel = (language: LanguageCode, category: string): string => {
    return MARK_CATEGORY_DICTIONARY[language][category] || category;
};

export const getLeagueCopy = (language: LanguageCode, leagueKey: string): LeagueCopy | undefined => {
    return LEAGUE_DICTIONARY[language][leagueKey];
};

