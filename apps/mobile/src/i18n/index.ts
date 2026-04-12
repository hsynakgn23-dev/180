import { NativeModules, Platform } from 'react-native';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { tr } from './tr';

export type AppLanguage = 'en' | 'tr' | 'es' | 'fr';
export type MobileTranslations = typeof tr;

export const mobileTranslations = { en, tr, es, fr } as const satisfies Record<AppLanguage, MobileTranslations>;

/** Returns the device's primary language code mapped to a supported AppLanguage. */
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

/** Returns the translation object for a given language. Falls back to English. */
export const getTranslations = (language: AppLanguage): MobileTranslations =>
  mobileTranslations[language] || mobileTranslations.en;

export { en, es, fr, tr };
