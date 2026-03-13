import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { resolveMobileWebBaseUrl } from './mobileEnv';
import { fetchWithTimeout } from './network';

type AccountDeletionErrorCode =
  | 'UNAUTHORIZED'
  | 'CONFIRMATION_REQUIRED'
  | 'SERVER_ERROR';

type AccountDeletionResponse<T> = {
  ok: boolean;
  data?: T;
  errorCode?: AccountDeletionErrorCode;
  message?: string;
  endpoint?: string;
};

export type MobileAccountDeletionResult = {
  deletedUserId: string;
  email: string;
  deletedAt: string;
};

const getAccountDeletionApiUrl = (): string => {
  const base = resolveMobileWebBaseUrl();
  if (!base) return '';
  return `${base}/api/account-delete`;
};

const getAuthToken = async (): Promise<string | null> => {
  if (!isSupabaseLive() || !supabase) return null;
  try {
    const sessionResult = await readSupabaseSessionSafe();
    return sessionResult.session?.access_token || null;
  } catch {
    return null;
  }
};

export const deleteMobileAccount = async (): Promise<
  AccountDeletionResponse<MobileAccountDeletionResult>
> => {
  const endpoint = getAccountDeletionApiUrl();
  if (!endpoint) {
    return {
      ok: false,
      errorCode: 'SERVER_ERROR',
      message: 'Hesap silme endpointi icin web base URL bulunamadi.',
      endpoint
    };
  }

  const accessToken = await getAuthToken();
  if (!accessToken) {
    return {
      ok: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Hesap silmek icin once giris yapman gerekiyor.',
      endpoint
    };
  }

  try {
    const response = await fetchWithTimeout({
      url: endpoint,
      timeoutMs: 15000,
      timeoutMessage: 'Hesap silme istegi zaman asimina ugradi.',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          confirm: true
        })
      }
    });

    const rawBody = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: MobileAccountDeletionResult;
      errorCode?: AccountDeletionErrorCode;
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
    return {
      ok: false,
      errorCode: 'SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Hesap silme istegi basarisiz.',
      endpoint
    };
  }
};
