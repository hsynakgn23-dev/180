import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseLive, supabase } from './supabase';

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

const resolveApiBase = (): string => {
  const explicitBase = normalizeText(process.env.EXPO_PUBLIC_REFERRAL_API_BASE, 500);
  if (explicitBase) return explicitBase.replace(/\/+$/, '');

  const analyticsEndpoint = normalizeText(process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT, 500);
  if (analyticsEndpoint.includes('/api/analytics')) {
    return analyticsEndpoint.slice(0, analyticsEndpoint.indexOf('/api/analytics'));
  }

  const dailyEndpoint = normalizeText(process.env.EXPO_PUBLIC_DAILY_API_URL, 500);
  if (dailyEndpoint.includes('/api/daily')) {
    return dailyEndpoint.slice(0, dailyEndpoint.indexOf('/api/daily'));
  }

  return '';
};

const getApiUrl = (path: string): string => {
  const base = resolveApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const withTimeout = async (promise: Promise<Response>, timeoutMs = 10000): Promise<Response> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<Response>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Referral API timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
    const response = await withTimeout(
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      })
    );

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
  try {
    const existing = await AsyncStorage.getItem(REFERRAL_DEVICE_KEY_STORAGE);
    if (existing) return normalizeDeviceKey(existing);

    const generated = normalizeDeviceKey(
      `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    );
    await AsyncStorage.setItem(REFERRAL_DEVICE_KEY_STORAGE, generated);
    return generated;
  } catch {
    return normalizeDeviceKey(`dev-${Date.now().toString(36)}-fallback`);
  }
};

export const claimInviteCodeViaApi = async (
  rawCode: string
): Promise<ReferralApiResponse<ClaimInvitePayload>> => {
  const inviteCode = normalizeInviteCode(rawCode);
  const deviceKey = await getReferralDeviceKey();
  return postReferralApi<ClaimInvitePayload>('/api/referral/claim', {
    code: inviteCode,
    deviceKey
  });
};
