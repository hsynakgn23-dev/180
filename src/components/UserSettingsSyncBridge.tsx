import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useXP } from '../context/XPContext';
import {
    THEME_CHANGE_EVENT,
    THEME_STORAGE_KEY,
    applyThemeMode,
    isThemeMode,
    resolveThemeMode,
    type ThemeMode
} from '../lib/themeMode';
import {
    readUserSettingsFromCloud,
    shouldSyncUserSettings,
    syncUserSettingsToCloud
} from '../lib/userSettingsCloud';
import { normalizeUserSettingsLanguage } from '../domain/userSettings';
import { supabase } from '../lib/supabase';

const readThemeModeFromStorage = (): ThemeMode => {
    if (typeof window === 'undefined') return 'midnight';
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(storedTheme) ? storedTheme : resolveThemeMode();
};

export const UserSettingsSyncBridge: React.FC = () => {
    const { user } = useXP();
    const { language, setLanguage } = useLanguage();
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => resolveThemeMode());
    const hasHydratedRemoteSettingsRef = useRef(false);
    const isApplyingRemoteSettingsRef = useRef(false);
    const releaseApplyTimerRef = useRef<number | null>(null);
    const lastSyncedSettingsRef = useRef<{ language: string; themeMode: ThemeMode } | null>(null);
    const latestLanguageRef = useRef(language);
    const latestThemeModeRef = useRef(themeMode);

    useEffect(() => {
        latestLanguageRef.current = language;
    }, [language]);

    useEffect(() => {
        latestThemeModeRef.current = themeMode;
    }, [themeMode]);

    useEffect(() => {
        const syncThemeMode = () => {
            setThemeMode(readThemeModeFromStorage());
        };

        syncThemeMode();

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== THEME_STORAGE_KEY) return;
            syncThemeMode();
        };

        const handleThemeChange = () => {
            syncThemeMode();
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
        };
    }, []);

    useEffect(() => {
        if (releaseApplyTimerRef.current !== null) {
            window.clearTimeout(releaseApplyTimerRef.current);
            releaseApplyTimerRef.current = null;
        }

        if (!user?.id) {
            hasHydratedRemoteSettingsRef.current = false;
            isApplyingRemoteSettingsRef.current = false;
            lastSyncedSettingsRef.current = null;
            return;
        }

        let active = true;
        hasHydratedRemoteSettingsRef.current = false;
        isApplyingRemoteSettingsRef.current = true;

        void readUserSettingsFromCloud(supabase as never, user.id).then((result) => {
            if (!active) return;

            if (result.ok && result.settings) {
                const nextLanguage = normalizeUserSettingsLanguage(
                    result.settings.language
                );
                const nextThemeMode = result.settings.themeMode || latestThemeModeRef.current;

                if (nextLanguage !== latestLanguageRef.current) {
                    setLanguage(nextLanguage);
                }
                if (nextThemeMode !== readThemeModeFromStorage()) {
                    applyThemeMode(nextThemeMode);
                }

                lastSyncedSettingsRef.current = {
                    language: nextLanguage,
                    themeMode: nextThemeMode
                };
            } else {
                lastSyncedSettingsRef.current = null;
            }

            hasHydratedRemoteSettingsRef.current = true;
            releaseApplyTimerRef.current = window.setTimeout(() => {
                isApplyingRemoteSettingsRef.current = false;
                releaseApplyTimerRef.current = null;
            }, 0);
        });

        return () => {
            active = false;
            if (releaseApplyTimerRef.current !== null) {
                window.clearTimeout(releaseApplyTimerRef.current);
                releaseApplyTimerRef.current = null;
            }
        };
    }, [setLanguage, user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        if (!hasHydratedRemoteSettingsRef.current) return;
        if (isApplyingRemoteSettingsRef.current) return;

        const nextSettings = {
            language,
            themeMode
        };

        if (!shouldSyncUserSettings(lastSyncedSettingsRef.current, nextSettings)) {
            return;
        }

        let cancelled = false;

        void syncUserSettingsToCloud(supabase as never, user.id, nextSettings).then((result) => {
            if (cancelled || !result.ok) return;
            lastSyncedSettingsRef.current = {
                language: result.settings.language,
                themeMode: result.settings.themeMode
            };
        });

        return () => {
            cancelled = true;
        };
    }, [language, themeMode, user?.id]);

    return null;
};
