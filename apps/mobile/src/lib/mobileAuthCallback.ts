import { isSupabaseLive, supabase } from './supabase';

type MobileAuthCallbackResult = {
  matched: boolean;
  ok: boolean;
  recoveryMode: boolean;
  message: string;
  method: 'none' | 'set_session' | 'exchange_code';
};

type SessionLike = {
  access_token?: string | null;
  refresh_token?: string | null;
};

const normalizeText = (value: unknown, maxLength = 1000): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const parseUrlToParams = (rawUrl: string): URLSearchParams => {
  try {
    const parsed = new URL(rawUrl);
    const merged = new URLSearchParams(parsed.search || '');
    const hash = String(parsed.hash || '').replace(/^#/, '').trim();
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      for (const [key, value] of hashParams.entries()) {
        if (!merged.has(key)) merged.set(key, value);
      }
    }
    return merged;
  } catch {
    const queryIndex = rawUrl.indexOf('?');
    const hashIndex = rawUrl.indexOf('#');
    const searchSegment =
      queryIndex >= 0
        ? rawUrl.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
        : '';
    const hashSegment = hashIndex >= 0 ? rawUrl.slice(hashIndex + 1) : '';
    const merged = new URLSearchParams(searchSegment);
    if (hashSegment) {
      const hashParams = new URLSearchParams(hashSegment);
      for (const [key, value] of hashParams.entries()) {
        if (!merged.has(key)) merged.set(key, value);
      }
    }
    return merged;
  }
};

const normalizeCallbackMessage = (value: string, fallback: string): string => {
  const text = normalizeText(value, 220);
  return text || fallback;
};

const isAuthCallbackPayload = (params: URLSearchParams): boolean =>
  Boolean(
    normalizeText(params.get('access_token')) ||
      normalizeText(params.get('refresh_token')) ||
      normalizeText(params.get('code')) ||
      normalizeText(params.get('error')) ||
      normalizeText(params.get('error_description')) ||
      normalizeText(params.get('type'))
  );

const hasSessionTokens = (session: SessionLike | null | undefined): boolean =>
  Boolean(normalizeText(session?.access_token) && normalizeText(session?.refresh_token));

export const applyMobileAuthCallbackFromUrl = async (
  rawUrl: string | null | undefined
): Promise<MobileAuthCallbackResult> => {
  const normalizedUrl = normalizeText(rawUrl, 2000);
  if (!normalizedUrl) {
    return {
      matched: false,
      ok: false,
      recoveryMode: false,
      message: 'Auth callback URL yok.',
      method: 'none',
    };
  }

  const params = parseUrlToParams(normalizedUrl);
  if (!isAuthCallbackPayload(params)) {
    return {
      matched: false,
      ok: false,
      recoveryMode: false,
      message: 'Auth callback parametresi bulunmadi.',
      method: 'none',
    };
  }

  const type = normalizeText(params.get('type'), 64).toLowerCase();
  const recoveryMode = type === 'recovery';
  const callbackError =
    normalizeText(params.get('error_description'), 220) || normalizeText(params.get('error'), 120);
  if (callbackError) {
    return {
      matched: true,
      ok: false,
      recoveryMode,
      message: normalizeCallbackMessage(callbackError, 'Auth callback hatasi.'),
      method: 'none',
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      matched: true,
      ok: false,
      recoveryMode,
      message: 'Supabase baglantisi hazir degil.',
      method: 'none',
    };
  }

  const accessToken = normalizeText(params.get('access_token'), 2000);
  const refreshToken = normalizeText(params.get('refresh_token'), 2000);
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !hasSessionTokens(data.session)) {
      return {
        matched: true,
        ok: false,
        recoveryMode,
        message: normalizeCallbackMessage(error?.message || '', 'Oturum callback ile kurulamadi.'),
        method: 'set_session',
      };
    }
    return {
      matched: true,
      ok: true,
      recoveryMode,
      message: recoveryMode
        ? 'Sifre yenileme oturumu hazirlandi.'
        : 'OAuth oturumu basariyla acildi.',
      method: 'set_session',
    };
  }

  const authCode = normalizeText(params.get('code'), 600);
  if (authCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error || !hasSessionTokens(data.session)) {
      return {
        matched: true,
        ok: false,
        recoveryMode,
        message: normalizeCallbackMessage(error?.message || '', 'Auth code ile oturum acilamadi.'),
        method: 'exchange_code',
      };
    }
    return {
      matched: true,
      ok: true,
      recoveryMode,
      message: recoveryMode
        ? 'Sifre yenileme kodu dogrulandi.'
        : 'OAuth girisi tamamlandi.',
      method: 'exchange_code',
    };
  }

  return {
    matched: true,
    ok: false,
    recoveryMode,
    message: 'Auth callback icinde kullanilabilir token/code yok.',
    method: 'none',
  };
};

export type { MobileAuthCallbackResult };
