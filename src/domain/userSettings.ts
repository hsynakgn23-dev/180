export type UserSettingsLanguage = 'en' | 'tr' | 'es' | 'fr';
export type UserSettingsThemeMode = 'midnight' | 'dawn';

/** Per-category push notification opt-out. false = disabled, undefined/true = enabled. */
export type PushPrefsSnapshot = {
  comment?: boolean;
  like?: boolean;
  follow?: boolean;
  daily_drop?: boolean;
  arena?: boolean;
  streak?: boolean;
};

export const DEFAULT_PUSH_PREFS: PushPrefsSnapshot = {
  comment: true,
  like: true,
  follow: true,
  daily_drop: true,
  arena: true,
  streak: true,
};

export type UserSettingsSnapshot = {
  language: UserSettingsLanguage;
  themeMode: UserSettingsThemeMode;
  pushPrefs: PushPrefsSnapshot;
};

export const DEFAULT_USER_SETTINGS_SNAPSHOT: UserSettingsSnapshot = {
  language: 'en',
  themeMode: 'midnight',
  pushPrefs: DEFAULT_PUSH_PREFS,
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

export const normalizePushPrefs = (
  value: unknown
): PushPrefsSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_PUSH_PREFS };
  }
  const raw = value as Record<string, unknown>;
  const normalized: PushPrefsSnapshot = { ...DEFAULT_PUSH_PREFS };
  for (const key of Object.keys(DEFAULT_PUSH_PREFS) as Array<keyof PushPrefsSnapshot>) {
    if (key in raw) normalized[key] = raw[key] !== false;
  }
  return normalized;
};

export const normalizeUserSettingsSnapshot = (
  value: Partial<UserSettingsSnapshot> | null | undefined
): UserSettingsSnapshot => ({
  language: normalizeUserSettingsLanguage(value?.language),
  themeMode: normalizeUserSettingsThemeMode(value?.themeMode),
  pushPrefs: normalizePushPrefs(value?.pushPrefs),
});

export const normalizeUserSettingsCloudRow = (
  value: {
    language?: unknown;
    theme_mode?: unknown;
    push_prefs?: unknown;
  } | null | undefined
): UserSettingsSnapshot =>
  normalizeUserSettingsSnapshot({
    language: value?.language as UserSettingsLanguage | undefined,
    themeMode: value?.theme_mode as UserSettingsThemeMode | undefined,
    pushPrefs: normalizePushPrefs(value?.push_prefs),
  });

export const areUserSettingsSnapshotsEqual = (
  left: UserSettingsSnapshot | null | undefined,
  right: UserSettingsSnapshot | null | undefined
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.language === right.language &&
    left.themeMode === right.themeMode &&
    JSON.stringify(left.pushPrefs) === JSON.stringify(right.pushPrefs)
  );
};
