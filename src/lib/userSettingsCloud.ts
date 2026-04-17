import {
  normalizeUserSettingsCloudRow,
  normalizeUserSettingsSnapshot,
  type UserSettingsSnapshot,
} from '../domain/userSettings';

type UserSettingsQueryBuilder = {
  select: (columns: string) => UserSettingsQueryBuilder;
  eq: (column: string, value: string) => UserSettingsQueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  upsert: (
    value: Record<string, unknown>,
    options?: {
      onConflict?: string;
    }
  ) => UserSettingsQueryBuilder;
};

type UserSettingsSupabaseClientLike = {
  from: (table: string) => UserSettingsQueryBuilder;
};

type ReadUserSettingsResult =
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

type SyncUserSettingsResult =
  | {
      ok: true;
      settings: UserSettingsSnapshot;
    }
  | {
      ok: false;
      settings: UserSettingsSnapshot;
      message: string;
    };

const USER_SETTINGS_SELECT = 'language, theme_mode';

const resolveUserSettingsErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || 'user_settings_sync_failed');
};

const buildUserSettingsPayload = (userId: string, settings: UserSettingsSnapshot) => ({
  user_id: userId,
  language: settings.language,
  theme_mode: settings.themeMode,
});

export const readUserSettingsFromCloud = async (
  client: UserSettingsSupabaseClientLike | null | undefined,
  userId: string
): Promise<ReadUserSettingsResult> => {
  const normalizedUserId = String(userId || '').trim();
  if (!client) {
    return {
      ok: false,
      settings: null,
      message: 'supabase_unavailable',
    };
  }
  if (!normalizedUserId) {
    return {
      ok: false,
      settings: null,
      message: 'user_id_missing',
    };
  }

  const { data, error } = await client
    .from('user_settings')
    .select(USER_SETTINGS_SELECT)
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      settings: null,
      message: resolveUserSettingsErrorMessage(error),
    };
  }

  if (!data) {
    return {
      ok: true,
      settings: null,
      source: 'empty',
    };
  }

  return {
    ok: true,
    settings: normalizeUserSettingsCloudRow(
      data as {
        language?: unknown;
        theme_mode?: unknown;
      }
    ),
    source: 'cloud',
  };
};

export const syncUserSettingsToCloud = async (
  client: UserSettingsSupabaseClientLike | null | undefined,
  userId: string,
  settings: UserSettingsSnapshot
): Promise<SyncUserSettingsResult> => {
  const normalizedUserId = String(userId || '').trim();
  const normalizedSettings = normalizeUserSettingsSnapshot(settings);

  if (!client) {
    return {
      ok: false,
      settings: normalizedSettings,
      message: 'supabase_unavailable',
    };
  }
  if (!normalizedUserId) {
    return {
      ok: false,
      settings: normalizedSettings,
      message: 'user_id_missing',
    };
  }

  const { data, error } = await client
    .from('user_settings')
    .upsert(buildUserSettingsPayload(normalizedUserId, normalizedSettings), {
      onConflict: 'user_id',
    })
    .select(USER_SETTINGS_SELECT)
    .single();

  if (error) {
    return {
      ok: false,
      settings: normalizedSettings,
      message: resolveUserSettingsErrorMessage(error),
    };
  }

  return {
    ok: true,
    settings: normalizeUserSettingsCloudRow(
      data as {
        language?: unknown;
        theme_mode?: unknown;
      }
    ),
  };
};
