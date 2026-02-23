import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseLive, supabase } from './supabase';
import { resolveMobileReferralApiBase } from './mobileEnv';
import { fetchWithTimeout } from './network';

type ReferralApiErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_CODE'
  | 'INVITE_NOT_FOUND'
  | 'SELF_INVITE'
  | 'ALREADY_CLAIMED'
  | 'DEVICE_DAILY_LIMIT'
  | 'DEVICE_CODE_REUSE'
  | 'SERVER_ERROR';

type ReferralApiResponse<T> = {
  ok: boolean;
  data?: T;
  errorCode?: ReferralApiErrorCode;
  message?: string;
};

type ClaimInvitePayload = {
  code: string;
  inviterUserId: string | null;
  inviterRewardXp: number;
  inviteeRewardXp: number;
  claimCount: number;
};

type EnsureInviteCodePayload = {
  code: string;
  created: boolean;
  claimCount: number;
  inviteLink: string;
};

const REFERRAL_DEVICE_KEY_STORAGE = '180_referral_device_key_v1';

const normalizeText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeDeviceKey = (value: string): string =>
  value.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80);

const normalizeInviteCode = (value: unknown): string =>
  normalizeText(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');

const getApiUrl = (path: string): string => {
  const base = resolveMobileReferralApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const getAuthToken = async (): Promise<string | null> => {
  if (!isSupabaseLive() || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
};

const postReferralApi = async <T>(
  path: string,
  payload: Record<string, unknown>
): Promise<ReferralApiResponse<T>> => {
  const endpoint = getApiUrl(path);
  if (!endpoint) {
    return {
      ok: false,
      errorCode: 'SERVER_ERROR',
      message: 'Missing EXPO_PUBLIC_REFERRAL_API_BASE or derivable API base.'
    };
  }

  const accessToken = await getAuthToken();
  if (!accessToken) {
    return {
      ok: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Missing access token.'
    };
  }

  try {
    const response = await fetchWithTimeout({
      url: endpoint,
      timeoutMs: 10000,
      timeoutMessage: 'Referral API timeout',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      }
    });

    const rawBody = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: T;
      errorCode?: ReferralApiErrorCode;
      message?: string;
      error?: string;
    };

    if (!response.ok || rawBody.ok === false) {
      return {
        ok: false,
        errorCode: rawBody.errorCode || 'SERVER_ERROR',
        message: rawBody.message || rawBody.error || `HTTP ${response.status}`
      };
    }

    return {
      ok: true,
      data: rawBody.data
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error.';
    return {
      ok: false,
      errorCode: 'SERVER_ERROR',
      message: `${message} (${endpoint})`
    };
  }
};

export const getReferralDeviceKey = async (): Promise<string> => {
  const buildGeneratedDeviceKey = (): string => {
    const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
    const randomSuffix = maybeCrypto?.randomUUID
      ? maybeCrypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const normalized = normalizeDeviceKey(`dev-${randomSuffix}`);
    return normalized || `dev-${Date.now().toString(36)}-fallback`;
  };

  try {
    const existing = await AsyncStorage.getItem(REFERRAL_DEVICE_KEY_STORAGE);
    const normalizedExisting = normalizeDeviceKey(String(existing || ''));
    if (normalizedExisting) return normalizedExisting;

    const generated = buildGeneratedDeviceKey();
    await AsyncStorage.setItem(REFERRAL_DEVICE_KEY_STORAGE, generated);
    return generated;
  } catch {
    return buildGeneratedDeviceKey();
  }
};

export const claimInviteCodeViaApi = async (
  rawCode: string
): Promise<ReferralApiResponse<ClaimInvitePayload>> => {
  const inviteCode = normalizeInviteCode(rawCode);
  if (!inviteCode) {
    return {
      ok: false,
      errorCode: 'INVALID_CODE',
      message: 'Davet kodu gecersiz.',
    };
  }
  const deviceKey = await getReferralDeviceKey();
  return postReferralApi<ClaimInvitePayload>('/api/referral/claim', {
    code: inviteCode,
    deviceKey
  });
};

export const ensureInviteCodeViaApi = async (
  rawSeed: string
): Promise<ReferralApiResponse<EnsureInviteCodePayload>> => {
  const seed = normalizeText(rawSeed, 120) || `mobile-${Date.now().toString(36)}`;
  return postReferralApi<EnsureInviteCodePayload>('/api/referral/create', { seed });
};
