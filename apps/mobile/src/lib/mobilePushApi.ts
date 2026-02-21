import { isSupabaseLive, supabase } from './supabase';
import { resolveMobilePushApiBase } from './mobileEnv';
import { fetchWithTimeout } from './network';

type PushApiErrorCode =
  | 'UNAUTHORIZED'
  | 'PUSH_TOKEN_NOT_FOUND'
  | 'EXPO_PUSH_FAILED'
  | 'SERVER_ERROR';

type PushApiResponse<T> = {
  ok: boolean;
  data?: T;
  errorCode?: PushApiErrorCode;
  message?: string;
  endpoint?: string;
};

export type PushTestPayload = {
  title?: string;
  body?: string;
  deepLink?: string;
};

export type PushReceiptErrorSample = {
  id: string;
  message: string;
  details?: string;
};

export type PushTestResult = {
  sentCount: number;
  ticketCount: number;
  errorCount: number;
  ticketIdCount?: number;
  receiptStatus?: 'ok' | 'unavailable';
  receiptCheckedCount?: number;
  receiptOkCount?: number;
  receiptErrorCount?: number;
  receiptPendingCount?: number;
  receiptMessage?: string;
  receiptErrors?: PushReceiptErrorSample[];
};

const normalizeText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const getApiUrl = (path: string): string => {
  const base = resolveMobilePushApiBase();
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

const postPushApi = async <T>(
  path: string,
  payload: Record<string, unknown>
): Promise<PushApiResponse<T>> => {
  const endpoint = getApiUrl(path);
  if (!endpoint) {
    return {
      ok: false,
      errorCode: 'SERVER_ERROR',
      message: 'Missing EXPO_PUBLIC_PUSH_API_BASE or derivable API base.',
      endpoint
    };
  }

  const accessToken = await getAuthToken();
  if (!accessToken) {
    return {
      ok: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Missing access token.',
      endpoint
    };
  }

  try {
    const response = await fetchWithTimeout({
      url: endpoint,
      timeoutMs: 10000,
      timeoutMessage: 'Push API timeout',
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
      errorCode?: PushApiErrorCode;
      message?: string;
      error?: string;
    };

    if (!response.ok || rawBody.ok === false) {
      return {
        ok: false,
        errorCode: rawBody.errorCode || 'SERVER_ERROR',
        message: rawBody.message || rawBody.error || `HTTP ${response.status}`,
        endpoint
      };
    }

    return {
      ok: true,
      data: rawBody.data,
      endpoint
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push API network error.';
    return {
      ok: false,
      errorCode: 'SERVER_ERROR',
      message: `${message} (${endpoint})`,
      endpoint
    };
  }
};

export const sendPushTestNotification = async (
  payload: PushTestPayload = {}
): Promise<PushApiResponse<PushTestResult>> => {
  const body: Record<string, unknown> = {};
  const title = normalizeText(payload.title, 120);
  const messageBody = normalizeText(payload.body, 220);
  const deepLink = normalizeText(payload.deepLink, 500);

  if (title) body.title = title;
  if (messageBody) body.body = messageBody;
  if (deepLink) body.deepLink = deepLink;

  return postPushApi<PushTestResult>('/api/push/test', body);
};
