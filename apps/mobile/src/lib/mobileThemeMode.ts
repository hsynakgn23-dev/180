import AsyncStorage from '@react-native-async-storage/async-storage';

export type MobileThemeMode = 'midnight' | 'dawn';

const MOBILE_THEME_STORAGE_KEY = '180_mobile_theme_pref';

export const isMobileThemeMode = (value: unknown): value is MobileThemeMode =>
  value === 'midnight' || value === 'dawn';

export const readStoredMobileThemeMode = async (): Promise<MobileThemeMode> => {
  try {
    const rawValue = await AsyncStorage.getItem(MOBILE_THEME_STORAGE_KEY);
    if (isMobileThemeMode(rawValue)) return rawValue;
  } catch {
    // no-op
  }
  return 'midnight';
};

export const writeStoredMobileThemeMode = async (mode: MobileThemeMode): Promise<void> => {
  try {
    await AsyncStorage.setItem(MOBILE_THEME_STORAGE_KEY, mode);
  } catch {
    // best effort persistence
  }
};

