import { createPrivateKey, createSign } from 'node:crypto';
import { parseAppleJwsPayload, verifyAppleSignedJwsPayload } from './appleSignedData.js';
import { type SubscriptionPlan } from './subscriptionAccess.js';

type SubscriptionPurchaseProvider = 'apple' | 'google' | 'stripe';

type VerifySubscriptionPurchaseInput = {
  provider: string;
  productId: string;
  plan: SubscriptionPlan;
  receipt: string;
  purchaseToken?: string | null;
  transactionId?: string | null;
  userId?: string | null;
};

type VerificationFailure = {
  ok: false;
  error: string;
  status: number;
};

type VerificationException = Error & {
  status?: number;
};

type VerificationSuccess = {
  ok: true;
  provider: SubscriptionPurchaseProvider;
  purchaseDate: string | null;
  expiresAt: string | null;
  transactionRef: string;
  providerSubscriptionId: string;
  verificationKind:
    | 'apple_app_store_api'
    | 'google_play_subscription_api'
    | 'google_play_product_api'
    | 'stripe_checkout_session'
    | 'stripe_subscription';
  metadata: {
    bundleId?: string | null;
    packageName?: string | null;
    originalTransactionId?: string | null;
    transactionId?: string | null;
    purchaseToken?: string | null;
    orderId?: string | null;
    stripeSessionId?: string | null;
    stripeSubscriptionId?: string | null;
  };
};

export type VerifiedSubscriptionPurchase = VerificationFailure | VerificationSuccess;

type ProductKind = 'subscription' | 'one_time';

const DEFAULT_APPLE_BUNDLE_ID = 'com.absolutecinema';
const DEFAULT_ANDROID_PACKAGE_NAME = 'com.hsyna.absolutecinema';
const APP_STORE_PRODUCTION_URL = 'https://api.storekit.itunes.apple.com';
const APP_STORE_SANDBOX_URL = 'https://api.storekit-sandbox.itunes.apple.com';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const STRIPE_API_BASE_URL = 'https://api.stripe.com';

const STRIPE_ENV_BY_PRODUCT_ID: Record<string, { priceEnv: string[]; productEnv: string[] }> = {
  'com.absolutecinema.premium.monthly': {
    priceEnv: ['MOBILE_IAP_STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID_PREMIUM_MONTHLY'],
    productEnv: ['MOBILE_IAP_STRIPE_PRODUCT_ID_MONTHLY', 'STRIPE_PRODUCT_ID_PREMIUM_MONTHLY'],
  },
  'com.absolutecinema.premium.annual': {
    priceEnv: ['MOBILE_IAP_STRIPE_PRICE_ID_ANNUAL', 'STRIPE_PRICE_ID_PREMIUM_ANNUAL'],
    productEnv: ['MOBILE_IAP_STRIPE_PRODUCT_ID_ANNUAL', 'STRIPE_PRODUCT_ID_PREMIUM_ANNUAL'],
  },
  'com.absolutecinema.premium.supporter': {
    priceEnv: ['MOBILE_IAP_STRIPE_PRICE_ID_SUPPORTER', 'STRIPE_PRICE_ID_PREMIUM_SUPPORTER'],
    productEnv: ['MOBILE_IAP_STRIPE_PRODUCT_ID_SUPPORTER', 'STRIPE_PRODUCT_ID_PREMIUM_SUPPORTER'],
  },
};

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeProvider = (value: unknown): SubscriptionPurchaseProvider | null => {
  const provider = normalizeText(value, 20).toLowerCase();
  if (provider === 'apple' || provider === 'google' || provider === 'stripe') return provider;
  return null;
};

const resolveProductKind = (plan: SubscriptionPlan): ProductKind =>
  plan === 'supporter' ? 'one_time' : 'subscription';

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

const toEpochMs = (value: unknown): number => {
  const iso = toIsoDate(value);
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
};

const isFutureDate = (value: unknown): boolean => {
  const ms = toEpochMs(value);
  return Number.isFinite(ms) && ms > Date.now();
};

const base64UrlEncode = (value: string | Buffer): string =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

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

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(input.payload))}`;
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

const resolveAppleBundleId = (): string =>
  normalizeText(
    process.env.MOBILE_IAP_APPLE_BUNDLE_ID ||
      process.env.APPLE_APP_STORE_BUNDLE_ID ||
      process.env.APP_STORE_CONNECT_BUNDLE_ID ||
      process.env.EXPO_PUBLIC_IAP_APPLE_BUNDLE_ID,
    240
  ) ||
  DEFAULT_APPLE_BUNDLE_ID;

const resolveAndroidPackageName = (): string =>
  normalizeText(
    process.env.MOBILE_IAP_GOOGLE_PACKAGE_NAME ||
      process.env.GOOGLE_PLAY_PACKAGE_NAME ||
      process.env.ANDROID_PACKAGE_NAME ||
      process.env.EXPO_PUBLIC_IAP_GOOGLE_PACKAGE_NAME,
    240
  ) || DEFAULT_ANDROID_PACKAGE_NAME;

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

  return {
    issuerId,
    keyId,
    privateKeyPem,
    environment:
      environmentRaw === 'production' || environmentRaw === 'sandbox'
        ? environmentRaw
        : 'both',
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
      const parsed = JSON.parse(rawJson);
      if (isRecord(parsed)) {
        const clientEmail = normalizeText(parsed.client_email, 240);
        const privateKeyPem = normalizeMultilineSecret(parsed.private_key);
        if (clientEmail && privateKeyPem) return { clientEmail, privateKeyPem };
      }
    } catch {
      // Fall through to discrete env vars.
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
  return { clientEmail, privateKeyPem };
};

const getStripeSecretKey = (): string =>
  normalizeText(process.env.MOBILE_IAP_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY, 240);

const resolveAppleEndpoints = (environment: 'production' | 'sandbox' | 'both'): string[] => {
  if (environment === 'production') return [APP_STORE_PRODUCTION_URL];
  if (environment === 'sandbox') return [APP_STORE_SANDBOX_URL];
  return [APP_STORE_PRODUCTION_URL, APP_STORE_SANDBOX_URL];
};

let googleAccessTokenCache:
  | {
      accessToken: string;
      expiresAtMs: number;
    }
  | null = null;

const fail = (status: number, error: string): VerificationFailure => ({
  ok: false,
  status,
  error,
});

const success = (value: Omit<VerificationSuccess, 'ok'>): VerificationSuccess => ({
  ok: true,
  ...value,
});

const buildVerificationException = (status: number, message: string): VerificationException => {
  const error = new Error(message) as VerificationException;
  error.status = status;
  return error;
};

const getThrownStatus = (error: unknown, fallback = 500): number => {
  const status = Number((error as { status?: unknown } | null | undefined)?.status);
  return Number.isFinite(status) ? status : fallback;
};

const normalizeStripeIdentifiers = (productId: string): Set<string> => {
  const identifiers = new Set<string>([productId]);
  const config = STRIPE_ENV_BY_PRODUCT_ID[productId];
  if (!config) return identifiers;

  for (const envKey of [...config.priceEnv, ...config.productEnv]) {
    const value = normalizeText(process.env[envKey], 240);
    if (value) identifiers.add(value);
  }

  return identifiers;
};

const collectStripeMetadataIdentifiers = (value: unknown): string[] => {
  if (!isRecord(value)) return [];
  return [
    normalizeText(value.productId, 240),
    normalizeText(value.product_id, 240),
    normalizeText(value.appProductId, 240),
    normalizeText(value.app_product_id, 240),
    normalizeText(value.lookupKey, 240),
    normalizeText(value.lookup_key, 240),
  ].filter(Boolean);
};

const doesStripeLineItemMatch = (lineItem: unknown, expectedIdentifiers: Set<string>): boolean => {
  if (!isRecord(lineItem)) return false;
  const price = isRecord(lineItem.price) ? lineItem.price : null;
  const product = price && isRecord(price.product) ? price.product : null;
  const priceProductId =
    price && typeof price.product === 'string' ? normalizeText(price.product, 240) : normalizeText(product?.id, 240);

  const candidates = [
    normalizeText(price?.id, 240),
    normalizeText(price?.lookup_key, 240),
    priceProductId,
    ...collectStripeMetadataIdentifiers(price?.metadata),
    ...collectStripeMetadataIdentifiers(product?.metadata),
  ];

  return candidates.some((candidate) => candidate && expectedIdentifiers.has(candidate));
};

const getStripeUserBinding = (value: unknown): string => {
  if (!isRecord(value)) return '';
  return (
    normalizeText(value.client_reference_id, 240) ||
    normalizeText(isRecord(value.metadata) ? value.metadata.userId : '', 240) ||
    normalizeText(isRecord(value.metadata) ? value.metadata.user_id : '', 240) ||
    normalizeText(isRecord(value.metadata) ? value.metadata.appUserId : '', 240) ||
    normalizeText(isRecord(value.metadata) ? value.metadata.app_user_id : '', 240)
  );
};

const validateUserBinding = (linkedUserId: string, expectedUserId: string): VerificationFailure | null => {
  if (!linkedUserId || !expectedUserId || linkedUserId === expectedUserId) return null;
  return fail(403, 'This purchase belongs to a different account.');
};

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
  if (!response.ok || !isRecord(payload) || !normalizeText(payload.access_token, 10_000)) {
    throw new Error(
      normalizeText(isRecord(payload) ? payload.error_description || payload.error : '', 240) ||
        'Google OAuth token request failed.'
    );
  }

  const accessToken = normalizeText(payload.access_token, 10_000);
  const expiresIn = Math.max(60, Number(payload.expires_in) || 3600);
  googleAccessTokenCache = {
    accessToken,
    expiresAtMs: nowMs + expiresIn * 1000,
  };
  return accessToken;
};

const getStripeAuthHeader = (): string =>
  `Basic ${Buffer.from(`${getStripeSecretKey()}:`, 'utf8').toString('base64')}`;

const fetchStripeObject = async (
  path: string,
  queryParams: Array<[string, string]> = []
): Promise<Record<string, unknown>> => {
  if (!getStripeSecretKey()) {
    throw new Error('Stripe verification is not configured.');
  }

  const url = new URL(`${STRIPE_API_BASE_URL}${path}`);
  for (const [key, value] of queryParams) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: getStripeAuthHeader(),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw buildVerificationException(
      response.status >= 500 ? 500 : 400,
      normalizeText(isRecord(payload) && isRecord(payload.error) ? payload.error.message : '', 240) ||
        `Stripe verification failed (${response.status}).`
    );
  }
  if (!isRecord(payload)) {
    throw new Error('Stripe returned an invalid response.');
  }

  return payload;
};

const fetchAppleSignedTransaction = async (
  transactionId: string,
  expectedBundleId: string
): Promise<Record<string, unknown>> => {
  const config = getAppleConfig();
  if (!config) {
    throw new Error('Apple verification is not configured.');
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
      bid: expectedBundleId || undefined,
    },
  });

  let lastError = 'Apple receipt could not be verified.';
  for (const baseUrl of resolveAppleEndpoints(config.environment)) {
    const response = await fetch(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      lastError =
        normalizeText(isRecord(payload) ? payload.errorMessage || payload.error : '', 240) ||
        `Apple verification failed (${response.status}).`;
      if (response.status === 404 && config.environment === 'both') continue;
      throw buildVerificationException(response.status >= 500 ? 500 : 400, lastError);
    }

    const decodedPayload = verifyAppleSignedJwsPayload(
      normalizeText(isRecord(payload) ? payload.signedTransactionInfo : '', 16_000)
    );
    return decodedPayload;
  }

  throw new Error(lastError);
};

const fetchLatestAppleHistoryTransaction = async (input: {
  anchorTransactionId: string;
  productId: string;
  expectedBundleId: string;
}): Promise<Record<string, unknown> | null> => {
  const config = getAppleConfig();
  if (!config) {
    throw new Error('Apple verification is not configured.');
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
      bid: input.expectedBundleId || undefined,
    },
  });

  for (const baseUrl of resolveAppleEndpoints(config.environment)) {
    let revision = '';
    for (let page = 0; page < 10; page += 1) {
      const url = new URL(`${baseUrl}/inApps/v2/history/${encodeURIComponent(input.anchorTransactionId)}`);
      url.searchParams.set('sort', 'DESCENDING');
      url.searchParams.set('revoked', 'false');
      url.searchParams.append('productId', input.productId);
      if (revision) url.searchParams.set('revision', revision);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 404 && config.environment === 'both') break;
        throw buildVerificationException(
          response.status >= 500 ? 500 : 400,
          normalizeText(isRecord(payload) ? payload.errorMessage || payload.error : '', 240) ||
            `Apple history verification failed (${response.status}).`
        );
      }

      const signedTransactions = Array.isArray(isRecord(payload) ? payload.signedTransactions : null)
        ? (payload.signedTransactions as unknown[])
        : [];

      for (const signedTransaction of signedTransactions) {
        let decodedPayload: Record<string, unknown>;
        try {
          decodedPayload = verifyAppleSignedJwsPayload(normalizeText(signedTransaction, 16_000));
        } catch {
          continue;
        }
        if (normalizeText(decodedPayload.bundleId, 240) !== input.expectedBundleId) continue;
        if (normalizeText(decodedPayload.productId, 160) !== input.productId) continue;
        if (toIsoDate(decodedPayload.revocationDate)) continue;
        return decodedPayload;
      }

      const hasMore = Boolean(isRecord(payload) ? payload.hasMore : false);
      revision = normalizeText(isRecord(payload) ? payload.revision : '', 240);
      if (!hasMore || !revision) break;
    }
  }

  return null;
};

const verifyApplePurchase = async (
  input: VerifySubscriptionPurchaseInput
): Promise<VerifiedSubscriptionPurchase> => {
  const expectedBundleId = resolveAppleBundleId();
  const parsedReceiptPayload = parseAppleJwsPayload(normalizeText(input.receipt, 16_000));
  const transactionId =
    normalizeText(input.transactionId, 240) ||
    normalizeText(parsedReceiptPayload?.transactionId, 240) ||
    normalizeText(parsedReceiptPayload?.originalTransactionId, 240) ||
    normalizeText(input.receipt, 240);

  if (!transactionId) {
    return fail(400, 'Apple transaction ID is required.');
  }

  try {
    const initialPayload = await fetchAppleSignedTransaction(transactionId, expectedBundleId);
    const bundleId = normalizeText(initialPayload.bundleId, 240);
    if (!bundleId || bundleId !== expectedBundleId) {
      return fail(400, 'Apple bundle ID mismatch.');
    }

    if (normalizeText(initialPayload.productId, 160) !== input.productId) {
      return fail(400, 'Apple product mismatch.');
    }

    const productKind = resolveProductKind(input.plan);
    const originalTransactionId =
      normalizeText(initialPayload.originalTransactionId, 240) ||
      normalizeText(initialPayload.transactionId, 240) ||
      transactionId;

    let verifiedPayload = initialPayload;
    if (productKind === 'subscription') {
      const latestPayload = await fetchLatestAppleHistoryTransaction({
        anchorTransactionId: originalTransactionId,
        productId: input.productId,
        expectedBundleId,
      });

      if (latestPayload) verifiedPayload = latestPayload;

      const expiresAt = toIsoDate(verifiedPayload.expiresDate);
      if (!expiresAt || !isFutureDate(expiresAt)) {
        return fail(400, 'Apple subscription is not active.');
      }
    } else if (toIsoDate(verifiedPayload.revocationDate)) {
      return fail(400, 'Apple purchase was revoked.');
    }

    const resolvedTransactionId =
      normalizeText(verifiedPayload.transactionId, 240) ||
      normalizeText(initialPayload.transactionId, 240) ||
      transactionId;
    const resolvedOriginalTransactionId =
      normalizeText(verifiedPayload.originalTransactionId, 240) || originalTransactionId;
    const providerSubscriptionId =
      productKind === 'subscription'
        ? `apple:${resolvedOriginalTransactionId}`
        : `apple:${resolvedTransactionId || resolvedOriginalTransactionId}`;

    return success({
      provider: 'apple',
      purchaseDate: toIsoDate(verifiedPayload.purchaseDate) || toIsoDate(initialPayload.purchaseDate),
      expiresAt: productKind === 'subscription' ? toIsoDate(verifiedPayload.expiresDate) : null,
      transactionRef: providerSubscriptionId,
      providerSubscriptionId,
      verificationKind: 'apple_app_store_api',
      metadata: {
        bundleId,
        originalTransactionId: resolvedOriginalTransactionId || null,
        transactionId: resolvedTransactionId || null,
      },
    });
  } catch (error) {
    return fail(getThrownStatus(error, 500), error instanceof Error ? error.message : 'Apple verification failed.');
  }
};

const verifyGoogleSubscriptionPurchase = async (
  input: VerifySubscriptionPurchaseInput
): Promise<VerifiedSubscriptionPurchase> => {
  const packageName = resolveAndroidPackageName();
  const purchaseToken = normalizeText(input.purchaseToken || input.receipt, 4000);
  if (!purchaseToken) {
    return fail(400, 'Google purchase token is required.');
  }

  try {
    const accessToken = await getGoogleAccessToken();
    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
        `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload)) {
      return fail(
        response.status >= 500 ? 500 : 400,
        normalizeText(isRecord(payload) && isRecord(payload.error) ? payload.error.message : '', 240) ||
          `Google verification failed (${response.status}).`
      );
    }

    const linkedUserId =
      normalizeText(
        isRecord(payload.externalAccountIdentifiers) ? payload.externalAccountIdentifiers.obfuscatedExternalAccountId : '',
        240
      ) ||
      normalizeText(
        isRecord(payload.externalAccountIdentifiers) ? payload.externalAccountIdentifiers.externalAccountId : '',
        240
      );
    const bindingError = validateUserBinding(linkedUserId, normalizeText(input.userId, 240));
    if (bindingError) return bindingError;

    const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems.filter(isRecord) : [];
    const latestItem =
      lineItems
        .filter((lineItem) => normalizeText(lineItem.productId, 160) === input.productId)
        .sort((left, right) => toEpochMs(right.expiryTime) - toEpochMs(left.expiryTime))[0] || null;

    if (!latestItem) {
      return fail(400, 'Google subscription product mismatch.');
    }

    const expiresAt = toIsoDate(latestItem.expiryTime);
    const subscriptionState = normalizeText(payload.subscriptionState, 120).toUpperCase();
    const activeState =
      subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
      subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
      (subscriptionState === 'SUBSCRIPTION_STATE_CANCELED' && isFutureDate(expiresAt));

    if (!expiresAt || !activeState || !isFutureDate(expiresAt)) {
      return fail(400, 'Google subscription is not active.');
    }

    const orderId = normalizeText(latestItem.latestSuccessfulOrderId, 240);
    return success({
      provider: 'google',
      purchaseDate: toIsoDate(payload.startTime),
      expiresAt,
      transactionRef: `google:${orderId || purchaseToken}`,
      providerSubscriptionId: `google:${purchaseToken}`,
      verificationKind: 'google_play_subscription_api',
      metadata: {
        packageName,
        purchaseToken,
        orderId: orderId || null,
        transactionId: orderId || null,
      },
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : 'Google verification failed.');
  }
};

const verifyGoogleOneTimePurchase = async (
  input: VerifySubscriptionPurchaseInput
): Promise<VerifiedSubscriptionPurchase> => {
  const packageName = resolveAndroidPackageName();
  const purchaseToken = normalizeText(input.purchaseToken || input.receipt, 4000);
  if (!purchaseToken) {
    return fail(400, 'Google purchase token is required.');
  }

  try {
    const accessToken = await getGoogleAccessToken();
    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
        `/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload)) {
      return fail(
        response.status >= 500 ? 500 : 400,
        normalizeText(isRecord(payload) && isRecord(payload.error) ? payload.error.message : '', 240) ||
          `Google verification failed (${response.status}).`
      );
    }

    const payloadProductId = normalizeText(payload.productId, 160);
    if (payloadProductId && payloadProductId !== input.productId) {
      return fail(400, 'Google product mismatch.');
    }

    const linkedUserId =
      normalizeText(payload.obfuscatedExternalAccountId, 240) || normalizeText(payload.obfuscatedExternalProfileId, 240);
    const bindingError = validateUserBinding(linkedUserId, normalizeText(input.userId, 240));
    if (bindingError) return bindingError;

    const purchaseState = Number(payload.purchaseState);
    if (!Number.isFinite(purchaseState) || purchaseState !== 0) {
      return fail(400, 'Google purchase is not completed.');
    }

    const refundableQuantity = payload.refundableQuantity == null ? null : Number(payload.refundableQuantity);
    if (refundableQuantity !== null && Number.isFinite(refundableQuantity) && refundableQuantity <= 0) {
      return fail(400, 'Google purchase was refunded.');
    }

    const orderId = normalizeText(payload.orderId, 240);
    return success({
      provider: 'google',
      purchaseDate: toIsoDate(payload.purchaseTimeMillis || payload.purchaseTime),
      expiresAt: null,
      transactionRef: `google:${orderId || purchaseToken}`,
      providerSubscriptionId: `google:${purchaseToken}`,
      verificationKind: 'google_play_product_api',
      metadata: {
        packageName,
        purchaseToken,
        orderId: orderId || null,
        transactionId: orderId || null,
      },
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : 'Google verification failed.');
  }
};

const validateStripeSubscriptionObject = (input: {
  subscription: Record<string, unknown>;
  productId: string;
  userId: string;
}): VerifiedSubscriptionPurchase => {
  const bindingError = validateUserBinding(getStripeUserBinding(input.subscription), input.userId);
  if (bindingError) return bindingError;

  const status = normalizeText(input.subscription.status, 80).toLowerCase();
  if (status !== 'active' && status !== 'trialing') {
    return fail(400, 'Stripe subscription is not active.');
  }

  const items =
    isRecord(input.subscription.items) && Array.isArray(input.subscription.items.data)
      ? input.subscription.items.data
      : [];
  if (!items.some((item) => doesStripeLineItemMatch(item, normalizeStripeIdentifiers(input.productId)))) {
    return fail(400, 'Stripe product mismatch.');
  }

  const subscriptionId = normalizeText(input.subscription.id, 240);
  const expiresAt = toIsoDate(input.subscription.current_period_end);
  if (!subscriptionId || !expiresAt || !isFutureDate(expiresAt)) {
    return fail(400, 'Stripe subscription is not active.');
  }

  return success({
    provider: 'stripe',
    purchaseDate: toIsoDate(input.subscription.created),
    expiresAt,
    transactionRef: `stripe:${subscriptionId}`,
    providerSubscriptionId: `stripe:${subscriptionId}`,
    verificationKind: 'stripe_subscription',
    metadata: {
      stripeSubscriptionId: subscriptionId,
      transactionId: subscriptionId,
    },
  });
};

const verifyStripeCheckoutSession = async (
  input: VerifySubscriptionPurchaseInput
): Promise<VerifiedSubscriptionPurchase> => {
  try {
    const session = await fetchStripeObject(`/v1/checkout/sessions/${encodeURIComponent(input.receipt)}`, [
      ['expand[]', 'subscription'],
    ]);

    const bindingError = validateUserBinding(getStripeUserBinding(session), normalizeText(input.userId, 240));
    if (bindingError) return bindingError;

    const lineItemsResponse = await fetchStripeObject(
      `/v1/checkout/sessions/${encodeURIComponent(input.receipt)}/line_items`,
      [['expand[]', 'data.price.product']]
    );
    const lineItems = Array.isArray(lineItemsResponse.data) ? lineItemsResponse.data : [];
    if (!lineItems.some((lineItem) => doesStripeLineItemMatch(lineItem, normalizeStripeIdentifiers(input.productId)))) {
      return fail(400, 'Stripe product mismatch.');
    }

    const sessionId = normalizeText(session.id, 240);
    if (!sessionId) {
      return fail(400, 'Stripe checkout session payload is invalid.');
    }

    if (resolveProductKind(input.plan) === 'subscription') {
      const subscription =
        isRecord(session.subscription)
          ? session.subscription
          : normalizeText(session.subscription, 240)
            ? await fetchStripeObject(`/v1/subscriptions/${encodeURIComponent(normalizeText(session.subscription, 240))}`, [
                ['expand[]', 'items.data.price.product'],
              ])
            : null;

      if (!subscription || !isRecord(subscription)) {
        return fail(400, 'Stripe subscription could not be loaded.');
      }

      const verifiedSubscription = validateStripeSubscriptionObject({
        subscription,
        productId: input.productId,
        userId: normalizeText(input.userId, 240),
      });
      if (!verifiedSubscription.ok) return verifiedSubscription;

      return success({
        provider: verifiedSubscription.provider,
        purchaseDate: verifiedSubscription.purchaseDate,
        expiresAt: verifiedSubscription.expiresAt,
        transactionRef: verifiedSubscription.transactionRef,
        providerSubscriptionId: verifiedSubscription.providerSubscriptionId,
        verificationKind: 'stripe_checkout_session',
        metadata: {
          ...verifiedSubscription.metadata,
          stripeSessionId: sessionId,
        },
      });
    }

    if (normalizeText(session.payment_status, 80).toLowerCase() !== 'paid') {
      return fail(400, 'Stripe checkout session is not paid.');
    }

    return success({
      provider: 'stripe',
      purchaseDate: toIsoDate(session.created),
      expiresAt: null,
      transactionRef: `stripe:${sessionId}`,
      providerSubscriptionId: `stripe:${sessionId}`,
      verificationKind: 'stripe_checkout_session',
      metadata: {
        stripeSessionId: sessionId,
        transactionId: sessionId,
      },
    });
  } catch (error) {
    return fail(getThrownStatus(error, 500), error instanceof Error ? error.message : 'Stripe verification failed.');
  }
};

const verifyStripeSubscription = async (
  input: VerifySubscriptionPurchaseInput
): Promise<VerifiedSubscriptionPurchase> => {
  try {
    const subscription = await fetchStripeObject(`/v1/subscriptions/${encodeURIComponent(input.receipt)}`, [
      ['expand[]', 'items.data.price.product'],
    ]);
    return validateStripeSubscriptionObject({
      subscription,
      productId: input.productId,
      userId: normalizeText(input.userId, 240),
    });
  } catch (error) {
    return fail(getThrownStatus(error, 500), error instanceof Error ? error.message : 'Stripe verification failed.');
  }
};

const verifyStripePurchase = async (
  input: VerifySubscriptionPurchaseInput
): Promise<VerifiedSubscriptionPurchase> => {
  if (!getStripeSecretKey()) {
    return fail(500, 'Stripe verification is not configured.');
  }

  const receipt = normalizeText(input.receipt, 240);
  if (!receipt) {
    return fail(400, 'Stripe receipt is required.');
  }
  if (receipt.startsWith('cs_')) {
    return verifyStripeCheckoutSession(input);
  }
  if (receipt.startsWith('sub_')) {
    return verifyStripeSubscription(input);
  }

  return fail(400, 'Unsupported Stripe receipt format.');
};

export const verifySubscriptionPurchase = async (
  input: VerifySubscriptionPurchaseInput
): Promise<VerifiedSubscriptionPurchase> => {
  const provider = normalizeProvider(input.provider);
  const productId = normalizeText(input.productId, 160);
  const receipt = normalizeText(input.receipt, 16_000);

  if (!provider) {
    return fail(400, 'Invalid provider.');
  }
  if (!productId) {
    return fail(400, 'Missing productId.');
  }
  if (!receipt) {
    return fail(400, 'Missing receipt data.');
  }

  const normalizedInput: VerifySubscriptionPurchaseInput = {
    ...input,
    provider,
    productId,
    receipt,
  };

  if (provider === 'apple') {
    if (!getAppleConfig()) return fail(500, 'Apple verification is not configured.');
    return verifyApplePurchase(normalizedInput);
  }

  if (provider === 'google') {
    if (!getGoogleConfig()) return fail(500, 'Google Play verification is not configured.');
    return resolveProductKind(input.plan) === 'subscription'
      ? verifyGoogleSubscriptionPurchase(normalizedInput)
      : verifyGoogleOneTimePurchase(normalizedInput);
  }

  return verifyStripePurchase(normalizedInput);
};
