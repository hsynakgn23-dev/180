import { NativeModules, Platform } from 'react-native';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { tr } from './tr';

export type AppLanguage = 'en' | 'tr' | 'es' | 'fr';
type DeepWiden<T> =
  T extends (...args: infer Args) => infer Return
    ? (...args: Args) => Return
    : T extends string
      ? string
      : T extends number
        ? number
        : T extends boolean
          ? boolean
          : T extends readonly unknown[]
            ? { readonly [K in keyof T]: DeepWiden<T[K]> }
            : T extends object
              ? { readonly [K in keyof T]: DeepWiden<T[K]> }
              : T;

export type MobileTranslations = DeepWiden<typeof tr>;

export const mobileTranslations: Record<AppLanguage, MobileTranslations> = { en, tr, es, fr };

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
