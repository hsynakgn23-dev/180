import { createPrivateKey, createSign } from 'node:crypto';
import { parseAppleJwsPayload, verifyAppleSignedJwsPayload } from './appleSignedData.js';

type StorePurchaseProvider = 'apple' | 'google';

type LiveVerificationInput = {
  provider: StorePurchaseProvider;
  productId: string;
  receipt: string;
  purchaseToken?: string | null;
  transactionId?: string | null;
  expectedBundleId?: string | null;
  expectedPackageName?: string | null;
};

export type LiveWalletTopupVerification =
  | {
      ok: true;
      verificationKind: 'apple_app_store_api' | 'google_play_api';
      purchaseDate: string | null;
      transactionRef: string;
      bundleId?: string | null;
      packageName?: string | null;
      originalTransactionId?: string | null;
      transactionId?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

const APP_STORE_PRODUCTION_URL = 'https://api.storekit.itunes.apple.com';
const APP_STORE_SANDBOX_URL = 'https://api.storekit-sandbox.itunes.apple.com';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const normalizeText = (value: unknown, maxLength = 4000): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeMultilineSecret = (value: unknown): string =>
  normalizeText(value, 24_000).replace(/\\n/g, '\n');

const decodeBase64Utf8 = (value: unknown): string => {
  const text = normalizeText(value, 48_000);
  if (!text) return '';
  try {
    return Buffer.from(text, 'base64').toString('utf8');
  } catch {
    return '';
  }
};

const base64UrlEncode = (value: string | Buffer): string =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const toIsoDate = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const text = normalizeText(value, 160);
  if (!text) return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    const date = new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const createJwt = (input: {
  algorithm: 'ES256' | 'RS256';
  keyId?: string | null;
  privateKeyPem: string;
  payload: Record<string, unknown>;
}): string => {
  const header: Record<string, unknown> = {
    alg: input.algorithm,
    typ: 'JWT',
  };
  if (input.keyId) header.kid = input.keyId;

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(input.payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('SHA256');
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(
    input.algorithm === 'ES256'
      ? {
          key: createPrivateKey(input.privateKeyPem),
          dsaEncoding: 'ieee-p1363',
        }
      : createPrivateKey(input.privateKeyPem)
  );
  return `${unsignedToken}.${base64UrlEncode(signature)}`;
};

const getAppleConfig = (): {
  issuerId: string;
  keyId: string;
  privateKeyPem: string;
  environment: 'production' | 'sandbox' | 'both';
} | null => {
  const issuerId = normalizeText(
    process.env.MOBILE_IAP_APPLE_ISSUER_ID ||
      process.env.APPLE_APP_STORE_ISSUER_ID ||
      process.env.APP_STORE_CONNECT_ISSUER_ID,
    120
  );
  const keyId = normalizeText(
    process.env.MOBILE_IAP_APPLE_KEY_ID ||
      process.env.APPLE_APP_STORE_KEY_ID ||
      process.env.APP_STORE_CONNECT_KEY_ID,
    120
  );
  const privateKeyPem = normalizeMultilineSecret(
    process.env.MOBILE_IAP_APPLE_PRIVATE_KEY ||
      process.env.APPLE_APP_STORE_PRIVATE_KEY ||
      process.env.APP_STORE_CONNECT_PRIVATE_KEY
  );
  if (!issuerId || !keyId || !privateKeyPem) return null;

  const environmentRaw =
    normalizeText(
      process.env.MOBILE_IAP_APPLE_ENVIRONMENT ||
        process.env.MOBILE_IAP_APPLE_ENV ||
        process.env.APPLE_APP_STORE_ENVIRONMENT,
      40
    ).toLowerCase();
  const environment =
    environmentRaw === 'production' || environmentRaw === 'sandbox' ? environmentRaw : 'both';
  return {
    issuerId,
    keyId,
    privateKeyPem,
    environment,
  };
};

const getGoogleConfig = (): {
  clientEmail: string;
  privateKeyPem: string;
} | null => {
  const rawJson =
    normalizeMultilineSecret(
      process.env.MOBILE_IAP_GOOGLE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ) ||
    decodeBase64Utf8(
      process.env.MOBILE_IAP_GOOGLE_SERVICE_ACCOUNT_JSON_B64 ||
        process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64 ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64
    );
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      const clientEmail = normalizeText(parsed.client_email, 240);
      const privateKeyPem = normalizeMultilineSecret(parsed.private_key);
      if (clientEmail && privateKeyPem) {
        return {
          clientEmail,
          privateKeyPem,
        };
      }
    } catch {
      // Fall through to discrete env vars so a malformed JSON blob does not block recovery.
    }
  }

  const clientEmail = normalizeText(
    process.env.MOBILE_IAP_GOOGLE_CLIENT_EMAIL ||
      process.env.GOOGLE_PLAY_CLIENT_EMAIL ||
      process.env.GOOGLE_CLIENT_EMAIL,
    240
  );
  const privateKeyPem = normalizeMultilineSecret(
    process.env.MOBILE_IAP_GOOGLE_PRIVATE_KEY ||
      process.env.GOOGLE_PLAY_PRIVATE_KEY ||
      process.env.GOOGLE_PRIVATE_KEY
  );
  if (!clientEmail || !privateKeyPem) return null;
  return {
    clientEmail,
    privateKeyPem,
  };
};

let googleAccessTokenCache:
  | {
      accessToken: string;
      expiresAtMs: number;
    }
  | null = null;

const getGoogleAccessToken = async (): Promise<string> => {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error('Google Play verification is not configured.');
  }

  const nowMs = Date.now();
  if (googleAccessTokenCache && googleAccessTokenCache.expiresAtMs - 30_000 > nowMs) {
    return googleAccessTokenCache.accessToken;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const assertion = createJwt({
    algorithm: 'RS256',
    privateKeyPem: config.privateKeyPem,
    payload: {
      iss: config.clientEmail,
      scope: GOOGLE_ANDROID_PUBLISHER_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    },
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(String(payload?.error_description || payload?.error || 'Google OAuth token request failed.'));
  }

  const expiresIn = Math.max(60, Number(payload.expires_in) || 3600);
  googleAccessTokenCache = {
    accessToken: String(payload.access_token),
    expiresAtMs: nowMs + expiresIn * 1000,
  };
  return googleAccessTokenCache.accessToken;
};

const resolveAppleEndpoints = (environment: 'production' | 'sandbox' | 'both'): string[] => {
  if (environment === 'production') return [APP_STORE_PRODUCTION_URL];
  if (environment === 'sandbox') return [APP_STORE_SANDBOX_URL];
  return [APP_STORE_PRODUCTION_URL, APP_STORE_SANDBOX_URL];
};

const verifyAppleWithStore = async (
  input: LiveVerificationInput
): Promise<LiveWalletTopupVerification | null> => {
  const config = getAppleConfig();
  if (!config) return null;

  const parsedReceiptPayload = parseAppleJwsPayload(input.receipt);
  const transactionId =
    normalizeText(input.transactionId, 240) ||
    normalizeText(parsedReceiptPayload?.transactionId, 240) ||
    normalizeText(parsedReceiptPayload?.originalTransactionId, 240);
  if (!transactionId) {
    return { ok: false, error: 'Apple transaction ID is required for live verification.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const token = createJwt({
    algorithm: 'ES256',
    keyId: config.keyId,
    privateKeyPem: config.privateKeyPem,
    payload: {
      iss: config.issuerId,
      iat: nowSec,
      exp: nowSec + 300,
      aud: 'appstoreconnect-v1',
      bid: normalizeText(input.expectedBundleId, 240) || undefined,
    },
  });

  let lastError = 'Apple receipt could not be verified.';
  for (const baseUrl of resolveAppleEndpoints(config.environment)) {
    const response = await fetch(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404 && config.environment === 'both') {
      continue;
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      lastError = String(payload?.errorMessage || payload?.error || `Apple verification failed (${response.status}).`);
      if (response.status === 404) continue;
      return { ok: false, error: lastError };
    }

    const signedTransactionInfo = normalizeText(payload?.signedTransactionInfo, 16_000);
    let transactionPayload: Record<string, unknown>;
    try {
      transactionPayload = verifyAppleSignedJwsPayload(signedTransactionInfo);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Apple signed transaction payload is invalid.',
      };
    }

    const bundleId = normalizeText(transactionPayload.bundleId, 240);
    if (input.expectedBundleId && bundleId !== input.expectedBundleId) {
      return { ok: false, error: 'Apple bundle ID mismatch.' };
    }

    const productId = normalizeText(transactionPayload.productId, 160);
    if (productId && productId !== input.productId) {
      return { ok: false, error: 'Apple product mismatch.' };
    }

    const resolvedTransactionId = normalizeText(transactionPayload.transactionId || transactionId, 240);
    const originalTransactionId = normalizeText(transactionPayload.originalTransactionId, 240) || null;
    return {
      ok: true,
      verificationKind: 'apple_app_store_api',
      purchaseDate: toIsoDate(transactionPayload.purchaseDate),
      transactionRef: `apple:${resolvedTransactionId || originalTransactionId || transactionId}`,
      bundleId: bundleId || input.expectedBundleId || null,
      originalTransactionId,
      transactionId: resolvedTransactionId || originalTransactionId || transactionId,
    };
  }

  return { ok: false, error: lastError };
};

const verifyGoogleWithStore = async (
  input: LiveVerificationInput
): Promise<LiveWalletTopupVerification | null> => {
  if (!getGoogleConfig()) return null;

  const purchaseToken = normalizeText(input.purchaseToken || input.receipt, 4000);
  const packageName = normalizeText(input.expectedPackageName, 240);
  if (!purchaseToken) {
    return { ok: false, error: 'Google purchase token is required for live verification.' };
  }
  if (!packageName) {
    return { ok: false, error: 'Google package name is required for live verification.' };
  }

  const accessToken = await getGoogleAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
    `/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      error: String(payload?.error?.message || payload?.error || `Google verification failed (${response.status}).`),
    };
  }

  const purchaseState = Number(payload?.purchaseState);
  if (Number.isFinite(purchaseState) && purchaseState !== 0) {
    return { ok: false, error: 'Google purchase is not completed.' };
  }

  const orderId = normalizeText(payload?.orderId || input.transactionId, 240);
  return {
    ok: true,
    verificationKind: 'google_play_api',
    purchaseDate: toIsoDate(payload?.purchaseTimeMillis || payload?.purchaseTime),
    transactionRef: `google:${orderId || purchaseToken}`,
    packageName,
    transactionId: orderId || null,
  };
};

export const verifyLiveWalletTopupPurchase = async (
  input: LiveVerificationInput
): Promise<LiveWalletTopupVerification | null> => {
  try {
    if (input.provider === 'apple') {
      return await verifyAppleWithStore(input);
    }
    return await verifyGoogleWithStore(input);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Store provider verification failed.',
    };
  }
};
