import { MAX_AVATAR_DATA_URL_LENGTH } from '../../lib/avatarUpload.js';
import type { RitualLog, XPState } from './types.js';
import {
    mergeRitualLogs,
    normalizeRitualLog,
    normalizeXPState,
    STORAGE_RECOVERY_KEYS,
} from './state.js';

export const USER_XP_STORAGE_KEY_PREFIX = '180_xp_data_';
export const USER_RITUAL_BACKUP_KEY_PREFIX = '180_ritual_backup_';

export const getUserXpStorageKey = (email: string): string =>
    `${USER_XP_STORAGE_KEY_PREFIX}${(email || '').trim().toLowerCase()}`;

export const getLegacyUserXpStorageKey = (email: string): string =>
    `${USER_XP_STORAGE_KEY_PREFIX}${email}`;

export const getUserRitualBackupKey = (email: string): string =>
    `${USER_RITUAL_BACKUP_KEY_PREFIX}${(email || '').trim().toLowerCase()}`;

export const compactStateForPersistence = (state: XPState): XPState => {
    if (!state.avatarUrl || state.avatarUrl.length <= MAX_AVATAR_DATA_URL_LENGTH) {
        return state;
    }
    return {
        ...state,
        avatarUrl: undefined
    };
};

export const persistUserRitualBackupToLocal = (email: string, rituals: RitualLog[]) => {
    if (!email) return;
    const key = getUserRitualBackupKey(email);
    const normalized = mergeRitualLogs(rituals).slice(0, 800);

    const attempt = (limit: number): boolean => {
        try {
            localStorage.setItem(key, JSON.stringify(normalized.slice(0, limit)));
            return true;
        } catch {
            return false;
        }
    };

    if (attempt(800)) return;
    if (attempt(400)) return;
    if (attempt(200)) return;

    console.warn('[XP] ritual backup persistence failed.');
};

export const persistUserXpStateToLocal = (email: string, state: XPState) => {
    if (!email) return;
    persistUserRitualBackupToLocal(email, state.dailyRituals || []);

    const primaryKey = getUserXpStorageKey(email);
    const legacyKey = getLegacyUserXpStorageKey(email);

    const writePayload = (payloadState: XPState, options?: { dropLegacyBeforeWrite?: boolean }): boolean => {
        try {
            if (options?.dropLegacyBeforeWrite && legacyKey !== primaryKey) {
                localStorage.removeItem(legacyKey);
            }
            localStorage.setItem(primaryKey, JSON.stringify(payloadState));
            if (legacyKey !== primaryKey) {
                localStorage.removeItem(legacyKey);
            }
            return true;
        } catch {
            return false;
        }
    };

    if (writePayload(state)) return;
    if (writePayload(state, { dropLegacyBeforeWrite: true })) return;

    const compactState = compactStateForPersistence(state);
    if (compactState !== state && writePayload(compactState, { dropLegacyBeforeWrite: true })) {
        console.warn('[XP] local persistence compacted by removing oversized avatar payload.');
        return;
    }

    // Recovery path for quota pressure: drop heavy cache keys and retry compact payload.
    for (const key of STORAGE_RECOVERY_KEYS) {
        try {
            localStorage.removeItem(key);
        } catch {
            // ignore
        }
    }

    try {
        localStorage.removeItem(primaryKey);
    } catch {
        // ignore
    }
    if (legacyKey !== primaryKey) {
        try {
            localStorage.removeItem(legacyKey);
        } catch {
            // ignore
        }
    }

    if (writePayload(compactState, { dropLegacyBeforeWrite: true })) {
        console.warn('[XP] local persistence recovered after cache cleanup.');
        return;
    }

    console.warn('[XP] local persistence failed; state could not be written.');
};

export const readUserXpStateFromLocal = (email: string): XPState | null => {
    if (!email) return null;
    const primaryKey = getUserXpStorageKey(email);
    const legacyKey = getLegacyUserXpStorageKey(email);
    const keys = legacyKey === primaryKey ? [primaryKey] : [primaryKey, legacyKey];

    for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        try {
            const parsed = JSON.parse(stored) as Partial<XPState>;
            const normalized = normalizeXPState(parsed);
            if (key !== primaryKey) {
                persistUserXpStateToLocal(email, normalized);
            }
            return normalized;
        } catch {
            localStorage.removeItem(key);
        }
    }

    return null;
};

export const readUserRitualBackupFromLocal = (email: string): RitualLog[] => {
    if (!email) return [];
    const key = getUserRitualBackupKey(email);
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as RitualLog[];
        if (!Array.isArray(parsed)) return [];
        return mergeRitualLogs(parsed.map((ritual) => normalizeRitualLog(ritual)));
    } catch {
        localStorage.removeItem(key);
        return [];
    }
};
