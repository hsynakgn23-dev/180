export type ThemeMode = 'midnight' | 'dawn';

export const THEME_STORAGE_KEY = '180_theme_pref';

export const isThemeMode = (value: unknown): value is ThemeMode => {
    return value === 'midnight' || value === 'dawn';
};

export const resolveThemeMode = (): ThemeMode => {
    if (typeof window === 'undefined') return 'midnight';

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(stored)) return stored;

    return document.body.classList.contains('light-mode') ? 'dawn' : 'midnight';
};

export const applyThemeMode = (mode: ThemeMode): void => {
    if (typeof document === 'undefined') return;

    const isDawn = mode === 'dawn';
    document.body.classList.toggle('light-mode', isDawn);
    document.body.dataset.theme = mode;
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
};

