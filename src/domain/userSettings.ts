export type UserSettingsLanguage = 'en' | 'tr' | 'es' | 'fr';
export type UserSettingsThemeMode = 'midnight' | 'dawn';

export type UserSettingsSnapshot = {
  language: UserSettingsLanguage;
  themeMode: UserSettingsThemeMode;
};

export const DEFAULT_USER_SETTINGS_SNAPSHOT: UserSettingsSnapshot = {
  language: 'en',
  themeMode: 'midnight',
};

const USER_SETTINGS_LANGUAGES = new Set<UserSettingsLanguage>(['en', 'tr', 'es', 'fr']);
const USER_SETTINGS_THEME_MODES = new Set<UserSettingsThemeMode>(['midnight', 'dawn']);

export const isUserSettingsLanguage = (value: unknown): value is UserSettingsLanguage =>
  typeof value === 'string' && USER_SETTINGS_LANGUAGES.has(value as UserSettingsLanguage);

export const isUserSettingsThemeMode = (value: unknown): value is UserSettingsThemeMode =>
  typeof value === 'string' && USER_SETTINGS_THEME_MODES.has(value as UserSettingsThemeMode);

export const normalizeUserSettingsLanguage = (value: unknown): UserSettingsLanguage => {
  const normalized = String(value || '').trim().toLowerCase();
  if (isUserSettingsLanguage(normalized)) {
    return normalized;
  }
  return DEFAULT_USER_SETTINGS_SNAPSHOT.language;
};

export const normalizeUserSettingsThemeMode = (value: unknown): UserSettingsThemeMode => {
  const normalized = String(value || '').trim().toLowerCase();
  if (isUserSettingsThemeMode(normalized)) {
    return normalized;
  }
  return DEFAULT_USER_SETTINGS_SNAPSHOT.themeMode;
};

export const normalizeUserSettingsSnapshot = (
  value: Partial<UserSettingsSnapshot> | null | undefined
): UserSettingsSnapshot => ({
  language: normalizeUserSettingsLanguage(value?.language),
  themeMode: normalizeUserSettingsThemeMode(value?.themeMode),
});

export const normalizeUserSettingsCloudRow = (
  value: {
    language?: unknown;
    theme_mode?: unknown;
  } | null | undefined
): UserSettingsSnapshot =>
  normalizeUserSettingsSnapshot({
    // normalizeUserSettingsLanguage/ThemeMode handle unknown → safe to cast here
    language: value?.language as UserSettingsLanguage | undefined,
    themeMode: value?.theme_mode as UserSettingsThemeMode | undefined,
  });

export const areUserSettingsSnapshotsEqual = (
  left: UserSettingsSnapshot | null | undefined,
  right: UserSettingsSnapshot | null | undefined
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.language === right.language && left.themeMode === right.themeMode;
};
