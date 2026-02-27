import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type PushDeviceState = {
  expoPushToken: string;
  permissionStatus: string;
  projectId: string;
  platform: string;
  appVersion: string;
  appBuild: string;
  updatedAt: string;
};

type PushProfileState = {
  version: number;
  latestDeviceKey: string;
  updatedAt: string;
  devices: Record<string, PushDeviceState>;
};

export type PushProfileSyncInput = {
  expoPushToken: string;
  permissionStatus: string;
  projectId?: string | null;
};

export type PushProfileSyncResult =
  | {
      ok: true;
      deviceKey: string;
      deviceCount: number;
      syncedAt: string;
    }
  | {
      ok: false;
      reason: 'auth_required' | 'supabase_unavailable' | 'schema_missing' | 'unknown';
      message: string;
    };

const PUSH_DEVICE_KEY_STORAGE = '180_mobile_push_device_key_v1';
const MAX_DEVICES = 8;

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = normalizeText(error.code, 40).toUpperCase();
  const message = normalizeText(error.message, 220).toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501' || code === '42703') return true;
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('forbidden')
  );
};

const generateDeviceKey = (): string => {
  const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (maybeCrypto?.randomUUID) return `push-${maybeCrypto.randomUUID()}`;
  return `push-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const getPushDeviceKey = async (): Promise<string> => {
  try {
    const existing = normalizeText(await AsyncStorage.getItem(PUSH_DEVICE_KEY_STORAGE), 120);
    if (existing) return existing;
    const created = generateDeviceKey();
    await AsyncStorage.setItem(PUSH_DEVICE_KEY_STORAGE, created);
    return created;
  } catch {
    return generateDeviceKey();
  }
};

const parsePushProfileState = (value: unknown): PushProfileState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      version: 1,
      latestDeviceKey: '',
      updatedAt: '',
      devices: {},
    };
  }

  const state = value as Record<string, unknown>;
  const rawDevices = state.devices;
  const devices: Record<string, PushDeviceState> = {};

  if (rawDevices && typeof rawDevices === 'object' && !Array.isArray(rawDevices)) {
    for (const [rawKey, rawDevice] of Object.entries(rawDevices as Record<string, unknown>)) {
      const key = normalizeText(rawKey, 120);
      if (!key) continue;
      if (!rawDevice || typeof rawDevice !== 'object' || Array.isArray(rawDevice)) continue;
      const device = rawDevice as Record<string, unknown>;
      const expoPushToken = normalizeText(device.expoPushToken, 320);
      if (!expoPushToken) continue;

      devices[key] = {
        expoPushToken,
        permissionStatus: normalizeText(device.permissionStatus, 60) || 'unknown',
        projectId: normalizeText(device.projectId, 120),
        platform: normalizeText(device.platform, 20) || 'unknown',
        appVersion: normalizeText(device.appVersion, 40),
        appBuild: normalizeText(device.appBuild, 40),
        updatedAt: normalizeText(device.updatedAt, 80) || new Date(0).toISOString(),
      };
    }
  }

  const sorted = Object.entries(devices).sort((a, b) => {
    const aTime = Date.parse(a[1].updatedAt || '');
    const bTime = Date.parse(b[1].updatedAt || '');
    if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
    if (!Number.isFinite(aTime)) return 1;
    if (!Number.isFinite(bTime)) return -1;
    return bTime - aTime;
  });

  const trimmed = Object.fromEntries(sorted.slice(0, MAX_DEVICES));
  return {
    version: 1,
    latestDeviceKey: normalizeText(state.latestDeviceKey, 120),
    updatedAt: normalizeText(state.updatedAt, 80),
    devices: trimmed,
  };
};

const buildNextPushProfileState = (
  current: PushProfileState,
  input: {
    deviceKey: string;
    expoPushToken: string;
    permissionStatus: string;
    projectId: string | null;
    syncedAt: string;
  }
): PushProfileState => {
  const appVersion = normalizeText(Constants.expoConfig?.version, 40);
  const appBuild = normalizeText(Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode, 40);
  const devices = {
    ...current.devices,
    [input.deviceKey]: {
      expoPushToken: normalizeText(input.expoPushToken, 320),
      permissionStatus: normalizeText(input.permissionStatus, 60) || 'unknown',
      projectId: normalizeText(input.projectId, 120),
      platform: Platform.OS,
      appVersion,
      appBuild,
      updatedAt: input.syncedAt,
    },
  };

  const trimmed = Object.fromEntries(
    Object.entries(devices)
      .sort((a, b) => {
        const aTime = Date.parse(a[1].updatedAt || '');
        const bTime = Date.parse(b[1].updatedAt || '');
        if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
        if (!Number.isFinite(aTime)) return 1;
        if (!Number.isFinite(bTime)) return -1;
        return bTime - aTime;
      })
      .slice(0, MAX_DEVICES)
  );

  return {
    version: 1,
    latestDeviceKey: input.deviceKey,
    updatedAt: input.syncedAt,
    devices: trimmed,
  };
};

export const syncPushTokenToProfileState = async (
  input: PushProfileSyncInput
): Promise<PushProfileSyncResult> => {
  const expoPushToken = normalizeText(input.expoPushToken, 320);
  if (!expoPushToken) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Push token bos.',
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      reason: 'supabase_unavailable',
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 80);
  if (!userId) {
    return {
      ok: false,
      reason: 'auth_required',
      message: 'Push cloud sync icin once giris yap.',
    };
  }

  const userEmail = normalizeText(sessionResult.session?.user?.email, 200);
  const deviceKey = await getPushDeviceKey();
  const syncedAt = new Date().toISOString();

  const { data: currentRow, error: readError } = await supabase
    .from('profiles')
    .select('mobile_push_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError && !isSupabaseCapabilityError(readError)) {
    return {
      ok: false,
      reason: 'unknown',
      message: normalizeText(readError.message, 220) || 'Push profile state okunamadi.',
    };
  }

  if (readError && isSupabaseCapabilityError(readError)) {
    return {
      ok: false,
      reason: 'schema_missing',
      message: 'mobile_push_state kolonu eksik. SQL migration calistirilmali.',
    };
  }

  const currentState = parsePushProfileState(
    (currentRow as { mobile_push_state?: unknown } | null)?.mobile_push_state
  );
  const nextState = buildNextPushProfileState(currentState, {
    deviceKey,
    expoPushToken,
    permissionStatus: input.permissionStatus,
    projectId: input.projectId || null,
    syncedAt,
  });

  const { error: writeError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      email: userEmail || null,
      mobile_push_state: nextState,
      updated_at: syncedAt,
    },
    { onConflict: 'user_id' }
  );

  if (writeError) {
    if (isSupabaseCapabilityError(writeError)) {
      return {
        ok: false,
        reason: 'schema_missing',
        message: 'mobile_push_state kolonu eksik veya policy izni yok. SQL migration calistirilmali.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: normalizeText(writeError.message, 220) || 'Push profile state yazilamadi.',
    };
  }

  return {
    ok: true,
    deviceKey,
    deviceCount: Object.keys(nextState.devices).length,
    syncedAt,
  };
};
