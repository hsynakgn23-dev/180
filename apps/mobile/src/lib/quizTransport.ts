import { MOBILE_API_BASE_URL_ERROR, resolveMobileApiUrl } from './mobileEnv';
import { fetchWithTimeout } from './network';
import { readSupabaseSessionSafe, supabase } from './supabase';

/**
 * quizTransport
 * -------------
 * Tek bir merkezi HTTP katmani. Tum quiz API'lari (daily / pool / rush) bunu
 * kullanir. Amacimiz:
 *  - Token suresi bitince (401) tek seferlik oturumu yenileyip istegi tekrarlamak.
 *  - Network / 5xx / timeout hatalarinda exponential backoff ile 3 kez denemek.
 *  - Her yazma (POST/PUT/PATCH/DELETE) istegine idempotency key eklemek. Boylece
 *    ayni cevap iki kez gitse bile sunucu duplicate'i tanimakla yukumlu olur.
 *  - Kullaniciya anlasilir Turkce hata mesaji dondurmek.
 */

const DEFAULT_READ_TIMEOUT_MS = 15000;
const DEFAULT_WRITE_TIMEOUT_MS = 20000;
const DEFAULT_MAX_ATTEMPTS = 3; // ilk deneme + 2 retry
const RETRY_BASE_DELAY_MS = 400;

export type QuizRequestInit = RequestInit;

export type QuizRequestOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
  /** Varsayilan 3 (ilk deneme + 2 retry). */
  maxAttempts?: number;
  /** Yazma istegi mi? POST/PUT/PATCH/DELETE icin true saymaliyiz. */
  isWrite?: boolean;
  /**
   * Ayni mantiksal cevap icin stabil bir key. Ayni key ile iki kez gonderirsek
   * backend tarafi ayni cevabi iki kez kaydetmemelidir. Backend hazir degilse
   * header zararsizdir, gormezden gelinir.
   */
  idempotencyKey?: string;
};

const isMethodWrite = (method: string | undefined): boolean => {
  const m = String(method || 'GET').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
};

/** Suanki access token. Yoksa bos string doner (401 riski). */
const readAccessToken = async (): Promise<string> => {
  const sessionResult = await readSupabaseSessionSafe();
  return String(sessionResult.session?.access_token || '').trim();
};

/** Supabase'i zorla yenile. Basarili olursa yeni token'i doner. */
const refreshAccessToken = async (): Promise<string> => {
  if (!supabase) return '';
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return '';
    return String(data.session?.access_token || '').trim();
  } catch {
    return '';
  }
};

/** Paylasilan auth header uretici — tum quiz API'larinin kullandigi tek fonksiyon. */
export const buildQuizAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await readAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const headersWithToken = (
  baseHeaders: Record<string, string>,
  token: string
): Record<string, string> => {
  const next = { ...baseHeaders };
  // Onceki Authorization'i temizle (hem 'Authorization' hem 'authorization').
  for (const key of Object.keys(next)) {
    if (key.toLowerCase() === 'authorization') delete next[key];
  }
  if (token) next.Authorization = `Bearer ${token}`;
  return next;
};

const normalizeHeadersInput = (
  headers: HeadersInit | undefined
): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const [key, value] of headers) {
      if (key) out[key] = String(value);
    }
    return out;
  }
  return { ...(headers as Record<string, string>) };
};

const synthesizeResponse = (status: number, error: string): Response =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const classifyError = (error: unknown): { retriable: boolean; message: string } => {
  const message =
    error instanceof Error && error.message ? error.message : 'Ag hatasi.';
  const lower = message.toLowerCase();
  // Abort / timeout / network failures tumunu retriable kabul ediyoruz.
  const retriable =
    lower.includes('abort') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed');
  return { retriable, message };
};

/**
 * Response govdesini tuketmeden `retriable` flag'ini okur.
 * Orijinal response cagiran tarafa dondurulecekse tuketilmis olmamalidir; bu
 * yuzden clone uzerinde .json() cagiriyoruz ve clone'u geri veriyoruz.
 */
const peekRetriableFlag = async (
  response: Response
): Promise<{ retriable: boolean | null; clonedResponse: Response }> => {
  try {
    const clone = response.clone();
    const body = (await clone.json().catch(() => null)) as
      | { retriable?: unknown }
      | null;
    if (body && typeof body.retriable === 'boolean') {
      return { retriable: body.retriable, clonedResponse: response };
    }
  } catch {
    // yoksay
  }
  return { retriable: null, clonedResponse: response };
};

const generateIdempotencyKey = (): string => {
  // RN uyumlu basit bir UUID-ish. Kriptografik guven araniyor degil; duplicate
  // tespiti icin yeterli.
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${Date.now().toString(16)}-${rand()}-${rand()}`;
};

/**
 * Ana transport. Standart `fetch` gibi Response doner; ancak retry, auth-refresh,
 * timeout ve idempotency otomatik yonetilir. Cagri tarafi `response.ok` + JSON
 * gibi aynen calismaya devam eder.
 */
export const quizRequest = async (
  path: string,
  init: QuizRequestInit = {},
  options: QuizRequestOptions = {}
): Promise<Response> => {
  const url = resolveMobileApiUrl(path);
  if (!url) {
    return synthesizeResponse(503, MOBILE_API_BASE_URL_ERROR);
  }

  const isWrite = options.isWrite ?? isMethodWrite(init.method);
  const timeoutMs =
    options.timeoutMs ?? (isWrite ? DEFAULT_WRITE_TIMEOUT_MS : DEFAULT_READ_TIMEOUT_MS);
  const timeoutMessage = options.timeoutMessage || 'Istek zaman asimina ugradi.';
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  const callerHeaders = normalizeHeadersInput(init.headers);
  let currentToken = await readAccessToken();
  let didRefreshAuth = false;

  // Idempotency: yazma istekleri icin baslangicta bir key sec; tum retry'lerde
  // ayni key kullanilir.
  const idempotencyKey = isWrite
    ? options.idempotencyKey || generateIdempotencyKey()
    : null;

  let lastError: { retriable: boolean; message: string } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers = headersWithToken(callerHeaders, currentToken);
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

    const finalInit: RequestInit = { ...init, headers };

    let response: Response;
    try {
      response = await fetchWithTimeout({
        url,
        init: finalInit,
        timeoutMs,
        timeoutMessage,
      });
    } catch (error) {
      const classified = classifyError(error);
      lastError = classified;
      if (classified.retriable && attempt < maxAttempts) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(3, attempt - 1));
        continue;
      }
      return synthesizeResponse(0, classified.message);
    }

    // 401 -> tek seferlik token refresh denemesi, sonra ayni slotta tekrar dene.
    if (response.status === 401 && !didRefreshAuth) {
      didRefreshAuth = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        currentToken = refreshed;
        // Bu denemeyi "sayma" — attempt sayisi artmasin diye geri al.
        attempt -= 1;
        continue;
      }
      // Refresh basarisiz: 401'i yukari ver, kullanici yeniden giris yapmali.
      return response;
    }

    // 5xx retriable — biraz bekle, yeniden dene.
    // Ancak backend cevap govdesinde acik sekilde `retriable: false` diyorsa
    // (ornegin server_config_error) retry atmanin anlami yok; hemen cik.
    if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts) {
      const { retriable: bodyRetriable, clonedResponse } = await peekRetriableFlag(response);
      if (bodyRetriable === false) {
        return clonedResponse;
      }
      lastError = { retriable: true, message: `Sunucu hatasi (${response.status}).` };
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(3, attempt - 1));
      continue;
    }

    return response;
  }

  return synthesizeResponse(
    0,
    lastError?.message || 'Istek basarisiz oldu.'
  );
};
