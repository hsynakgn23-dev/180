import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { resolveMobileReferralApiBase } from './mobileEnv';
import { fetchWithTimeout } from './network';

type GiftCodeType = 'tickets' | 'premium';

type ReferralApiErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_CODE'
  | 'CODE_NOT_FOUND'
  | 'CODE_REVOKED'
  | 'CODE_EXPIRED'
  | 'CODE_EXHAUSTED'
  | 'ALREADY_REDEEMED'
  | 'WALLET_UPDATE_FAILED'
  | 'SUBSCRIPTION_UPDATE_FAILED'
  | 'REFERRAL_PROGRAM_DISABLED'
  | 'SERVER_ERROR';

type ReferralApiResponse<T> = {
  ok: boolean;
  data?: T;
  errorCode?: ReferralApiErrorCode;
  message?: string;
};

type ClaimInvitePayload = {
  code: string;
  giftType: GiftCodeType;
  value: number;
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

const REFERRAL_CLAIMED_CODE_STORAGE = '180_gift_code_redeemed_code_v1';

const normalizeText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeGiftCode = (value: unknown): string =>
  normalizeText(value, 80).toUpperCase().replace(/[^A-Z0-9-]/g, '');

const getApiUrl = (path: string): string => {
  const base = resolveMobileReferralApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const AUTH_TOKEN_TIMEOUT_MS = 3000;

const getAuthToken = async (): Promise<string | null> => {
  if (!isSupabaseLive() || !supabase) return null;
  try {
    const sessionResult = await Promise.race([
      readSupabaseSessionSafe(),
      new Promise<{ session: null; clearedInvalidSession: false; error: null }>((resolve) =>
        setTimeout(() => resolve({ session: null, clearedInvalidSession: false, error: null }), AUTH_TOKEN_TIMEOUT_MS)
      ),
    ]);
    return sessionResult.session?.access_token || null;
  } catch {
    return null;
  }
};

const normalizeErrorCode = (value: unknown): ReferralApiErrorCode => {
  const code = String(value || '').trim().toUpperCase();
  switch (code) {
    case 'UNAUTHORIZED':
    case 'INVALID_CODE':
    case 'CODE_NOT_FOUND':
    case 'CODE_REVOKED':
    case 'CODE_EXPIRED':
    case 'CODE_EXHAUSTED':
    case 'ALREADY_REDEEMED':
    case 'WALLET_UPDATE_FAILED':
    case 'SUBSCRIPTION_UPDATE_FAILED':
    case 'REFERRAL_PROGRAM_DISABLED':
      return code;
    default:
      return 'SERVER_ERROR';
  }
};

const postGiftRedeemApi = async (
  code: string
): Promise<ReferralApiResponse<ClaimInvitePayload>> => {
  const endpoint = getApiUrl('/api/gift-redeem');
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
      timeoutMessage: 'Gift code API timeout',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ code })
      }
    });

    const rawBody = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      code?: string;
      giftType?: GiftCodeType;
      value?: number;
      errorCode?: string;
      message?: string;
      error?: string;
    };

    if (!response.ok || rawBody.ok === false) {
      return {
        ok: false,
        errorCode: normalizeErrorCode(rawBody.errorCode || rawBody.error),
        message: rawBody.message || rawBody.error || `HTTP ${response.status}`
      };
    }

    const giftType = rawBody.giftType === 'premium' ? 'premium' : 'tickets';
    const value = Math.max(0, Math.floor(Number(rawBody.value) || 0));
    return {
      ok: true,
      data: {
        code: normalizeGiftCode(rawBody.code || code),
        giftType,
        value,
        inviterUserId: null,
        inviterRewardXp: 0,
        inviteeRewardXp: 0,
        claimCount: 0,
      }
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

export const getReferralDeviceKey = async (): Promise<string> => 'gift-code-only';

export const claimInviteCodeViaApi = async (
  rawCode: string
): Promise<ReferralApiResponse<ClaimInvitePayload>> => {
  const giftCode = normalizeGiftCode(rawCode);
  if (!giftCode || giftCode.length < 6) {
    return {
      ok: false,
      errorCode: 'INVALID_CODE',
      message: 'Hediye kodu gecersiz.',
    };
  }
  return postGiftRedeemApi(giftCode);
};

export const ensureInviteCodeViaApi = async (
  _rawSeed: string
): Promise<ReferralApiResponse<EnsureInviteCodePayload>> => ({
  ok: false,
  errorCode: 'REFERRAL_PROGRAM_DISABLED',
  message: 'Friend invite program is disabled.'
});

export const persistClaimedInviteCode = async (code: string): Promise<void> => {
  try {
    const normalized = normalizeGiftCode(code);
    if (normalized) {
      await AsyncStorage.setItem(REFERRAL_CLAIMED_CODE_STORAGE, normalized);
    }
  } catch {
    // ignore storage failures
  }
};

export const readPersistedClaimedInviteCode = async (): Promise<string | null> => {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_CLAIMED_CODE_STORAGE);
    const normalized = normalizeGiftCode(stored);
    return normalized || null;
  } catch {
    return null;
  }
};
