import { createHash } from 'node:crypto';
import { findReelTopupPackByProductId } from '../../src/domain/progressionEconomy.js';
import { verifyLiveWalletTopupPurchase } from './storeProviderVerification.js';

export type StorePurchaseProvider = 'apple' | 'google';

type VerifyWalletTopupPurchaseInput = {
  provider: string;
  productId: string;
  receipt: string;
  purchaseToken?: string | null;
  transactionId?: string | null;
  appBundleIdIOS?: string | null;
  originalTransactionIdentifierIOS?: string | null;
  packageNameAndroid?: string | null;
  purchaseState?: unknown;
  signatureAndroid?: string | null;
  store?: string | null;
  platform?: string | null;
};

type VerifiedPurchaseMetadata = {
  bundleId?: string | null;
  packageName?: string | null;
  originalTransactionId?: string | null;
  purchaseTokenHash: string;
  store?: string | null;
  transactionId?: string | null;
};

export type VerifiedWalletTopupPurchase =
  | {
      ok: true;
      provider: StorePurchaseProvider;
      productId: string;
      purchaseDate: string | null;
      transactionRef: string;
      verificationKind: 'apple_app_store_api' | 'google_play_api';
      metadata: VerifiedPurchaseMetadata;
    }
  | {
      ok: false;
      error: string;
    };

const DEFAULT_APPLE_BUNDLE_ID = 'com.absolutecinema';
const DEFAULT_ANDROID_PACKAGE_NAME = 'com.hsyna.absolutecinema';

const normalizeText = (value: unknown, maxLength = 4000): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeProvider = (value: unknown): StorePurchaseProvider | null => {
  const provider = normalizeText(value, 20).toLowerCase();
  if (provider === 'apple' || provider === 'google') return provider;
  return null;
};

const hashValue = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

const resolveAppleBundleId = (): string =>
  normalizeText(
    process.env.MOBILE_IAP_APPLE_BUNDLE_ID ||
      process.env.APPLE_APP_STORE_BUNDLE_ID ||
      process.env.APP_STORE_CONNECT_BUNDLE_ID ||
      process.env.EXPO_PUBLIC_IAP_APPLE_BUNDLE_ID,
    240
  ) || DEFAULT_APPLE_BUNDLE_ID;

const resolveAndroidPackageName = (): string =>
  normalizeText(
    process.env.MOBILE_IAP_GOOGLE_PACKAGE_NAME ||
      process.env.GOOGLE_PLAY_PACKAGE_NAME ||
      process.env.ANDROID_PACKAGE_NAME ||
      process.env.EXPO_PUBLIC_IAP_GOOGLE_PACKAGE_NAME,
    240
  ) || DEFAULT_ANDROID_PACKAGE_NAME;

export const verifyWalletTopupPurchase = async (
  input: VerifyWalletTopupPurchaseInput
): Promise<VerifiedWalletTopupPurchase> => {
  const provider = normalizeProvider(input.provider);
  const productId = normalizeText(input.productId, 160);
  if (!provider) {
    return { ok: false, error: 'Invalid provider.' };
  }
  if (!productId || !findReelTopupPackByProductId(productId)) {
    return { ok: false, error: 'Unknown productId.' };
  }

  const receipt = normalizeText(input.receipt);
  const purchaseToken = normalizeText(input.purchaseToken || receipt);
  const transactionId = normalizeText(input.transactionId, 240);
  const store = normalizeText(input.store, 40) || null;

  if (!receipt && !purchaseToken && !transactionId) {
    return { ok: false, error: 'Missing receipt data.' };
  }

  const liveVerification = await verifyLiveWalletTopupPurchase({
    provider,
    productId,
    receipt,
    purchaseToken: purchaseToken || null,
    transactionId: transactionId || null,
    expectedBundleId: resolveAppleBundleId(),
    expectedPackageName: resolveAndroidPackageName(),
  });

  if (!liveVerification) {
    return {
      ok: false,
      error: provider === 'apple'
        ? 'Apple verification is not configured.'
        : 'Google Play verification is not configured.',
    };
  }

  if (!liveVerification.ok) {
    return { ok: false, error: liveVerification.error };
  }

  return {
    ok: true,
    provider,
    productId,
    purchaseDate: liveVerification.purchaseDate,
    transactionRef: liveVerification.transactionRef,
    verificationKind: liveVerification.verificationKind,
    metadata: {
      bundleId: liveVerification.bundleId || null,
      packageName: liveVerification.packageName || null,
      originalTransactionId: liveVerification.originalTransactionId || null,
      purchaseTokenHash: hashValue(purchaseToken || receipt || transactionId || productId),
      store,
      transactionId: liveVerification.transactionId || transactionId || null,
    },
  };
};
