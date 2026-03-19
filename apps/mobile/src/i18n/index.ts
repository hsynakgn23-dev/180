import { NativeModules, Platform } from 'react-native';
import { en } from './en';
import { tr } from './tr';

export type AppLanguage = 'en' | 'tr' | 'es' | 'fr';

const translations = { en, tr } as const;

/** Returns the device's primary language code mapped to a supported AppLanguage.  */
export const getDeviceLanguage = (): AppLanguage => {
  try {
    const locale: string =
      Platform.OS === 'ios'
        ? String(
            NativeModules.SettingsManager?.settings?.AppleLocale ??
            NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
            ''
          )
        : String(NativeModules.I18nManager?.localeIdentifier ?? '');
    const primary = locale.split(/[-_]/)[0].toLowerCase();
    if (primary === 'tr') return 'tr';
    if (primary === 'es') return 'es';
    if (primary === 'fr') return 'fr';
  } catch {
    // locale detection not available
  }
  return 'en';
};

/** Returns the translation object for a given language. Falls back to Turkish. */
export const getTranslations = (language: AppLanguage): typeof tr => {
  if (language === 'en') return translations.en as unknown as typeof tr;
  // es/fr not fully translated yet — fall back to TR copy
  return translations.tr;
};

export { en, tr };
