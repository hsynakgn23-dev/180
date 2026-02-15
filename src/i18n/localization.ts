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
export const PRIMARY_LANGUAGE: LanguageCode = 'en';

export const LANGUAGE_DICTIONARY = UI_DICTIONARY;

export type FormatParams = Record<string, string | number | null | undefined>;

export const isLanguageCode = (value: unknown): value is LanguageCode =>
    value === 'tr' || value === 'en' || value === 'es' || value === 'fr';

export const SUPPORTED_LANGUAGE_OPTIONS: ReadonlyArray<{ code: LanguageCode; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' }
];

type RegistrationGenderOptionValue = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

const REGISTRATION_GENDER_LABELS: Record<LanguageCode, Record<RegistrationGenderOptionValue, string>> = {
    tr: {
        female: 'Kadın',
        male: 'Erkek',
        non_binary: 'Non-binary',
        prefer_not_to_say: 'Belirtmek istemiyorum'
    },
    en: {
        female: 'Female',
        male: 'Male',
        non_binary: 'Non-binary',
        prefer_not_to_say: 'Prefer not to say'
    },
    es: {
        female: 'Mujer',
        male: 'Hombre',
        non_binary: 'No binario',
        prefer_not_to_say: 'Prefiero no decirlo'
    },
    fr: {
        female: 'Femme',
        male: 'Homme',
        non_binary: 'Non binaire',
        prefer_not_to_say: 'Je préfère ne pas le dire'
    }
};

export const getRegistrationGenderOptions = (
    language: LanguageCode
): Array<{ value: RegistrationGenderOptionValue; label: string }> => {
    const labels = REGISTRATION_GENDER_LABELS[language];
    return [
        { value: 'female', label: labels.female },
        { value: 'male', label: labels.male },
        { value: 'non_binary', label: labels.non_binary },
        { value: 'prefer_not_to_say', label: labels.prefer_not_to_say }
    ];
};

export const getRegistrationGenderLabel = (
    language: LanguageCode,
    value: RegistrationGenderOptionValue
): string => {
    return REGISTRATION_GENDER_LABELS[language][value];
};

export const formatTemplate = (template: string, params?: FormatParams): string => {
    if (!params) return template;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, rawKey: string) => {
        const key = rawKey as keyof FormatParams;
        const value = params[key];
        return value === null || value === undefined ? '' : String(value);
    });
};

export const getDictionaryForLanguage = (language: LanguageCode) => UI_DICTIONARY[language] || UI_DICTIONARY[PRIMARY_LANGUAGE];

export const getMarkCopy = (language: LanguageCode, markId: string): MarkCopy => {
    const section = MARK_DICTIONARY[language] || MARK_DICTIONARY[PRIMARY_LANGUAGE];
    return (
        section[markId] || {
            title: markId,
            description: '',
            whisper: UI_DICTIONARY[language]?.xp.markUnlockedFallback || UI_DICTIONARY[PRIMARY_LANGUAGE].xp.markUnlockedFallback
        }
    );
};

export const getMarkCategoryLabel = (language: LanguageCode, category: string): string => {
    return MARK_CATEGORY_DICTIONARY[language]?.[category] || MARK_CATEGORY_DICTIONARY[PRIMARY_LANGUAGE][category] || category;
};

export const getLeagueCopy = (language: LanguageCode, leagueKey: string): LeagueCopy | undefined => {
    return LEAGUE_DICTIONARY[language]?.[leagueKey] || LEAGUE_DICTIONARY[PRIMARY_LANGUAGE][leagueKey];
};
