import {
  normalizeUserSettingsSnapshot,
  type UserSettingsSnapshot,
} from '../../../../src/domain/userSettings';
import {
  readUserSettingsFromCloud,
  syncUserSettingsToCloud,
} from '../../../../src/lib/userSettingsCloud';
import { readSupabaseSessionSafe, supabase } from './supabase';

type ReadMobileUserSettingsResult =
  | {
      ok: true;
      settings: UserSettingsSnapshot | null;
      source: 'cloud' | 'empty';
    }
  | {
      ok: false;
      settings: null;
      message: string;
    };

type SyncMobileUserSettingsResult =
  | {
      ok: true;
      settings: UserSettingsSnapshot;
    }
  | {
      ok: false;
      settings: UserSettingsSnapshot;
      message: string;
    };

export const readMobileUserSettingsFromCloud = async (): Promise<ReadMobileUserSettingsResult> => {
  const sessionResult = await readSupabaseSessionSafe();
  const userId = String(sessionResult.session?.user?.id || '').trim();
  if (!userId) {
    return {
      ok: false,
      settings: null,
      message: 'user_session_missing',
    };
  }
  // Cast needed: real SupabaseClient fluent types differ from our minimal interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return readUserSettingsFromCloud(supabase as any, userId);
};

export const syncMobileUserSettingsToCloud = async (
  settings: Partial<UserSettingsSnapshot>
): Promise<SyncMobileUserSettingsResult> => {
  const normalizedSettings = normalizeUserSettingsSnapshot(settings);
  const sessionResult = await readSupabaseSessionSafe();
  const userId = String(sessionResult.session?.user?.id || '').trim();
  if (!userId) {
    return {
      ok: false,
      settings: normalizedSettings,
      message: 'user_session_missing',
    };
  }
  // Cast needed: real SupabaseClient fluent types differ from our minimal interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return syncUserSettingsToCloud(supabase as any, userId, normalizedSettings);
};
