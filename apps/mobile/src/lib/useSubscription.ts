import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  requestPurchase,
  type Product,
  type Purchase,
} from 'expo-iap';
import { resolveMobileApiBaseUrl } from './mobileEnv';

export const IAP_PRODUCTS = {
  monthly: 'com.absolutecinema.premium.monthly',
  annual: 'com.absolutecinema.premium.annual',
  supporter: 'com.absolutecinema.premium.supporter.v2',
} as const;

export type IapPlan = keyof typeof IAP_PRODUCTS;
export type SubscriptionTier = 'free' | 'premium' | 'supporter';

const PLAN_TYPE: Record<IapPlan, 'subs' | 'in-app'> = {
  monthly: 'subs',
  annual: 'subs',
  supporter: 'in-app',
};

export type SubscriptionState = {
  tier: SubscriptionTier;
  currentPlan: IapPlan | null;
  isPremium: boolean;
  loading: boolean;
  products: Product[];
  purchasing: boolean;
  error: string | null;
};

const INITIAL: SubscriptionState = {
  tier: 'free',
  currentPlan: null,
  isPremium: false,
  loading: true,
  products: [],
  purchasing: false,
  error: null,
};

const normalizeTier = (value: unknown): SubscriptionTier =>
  value === 'premium' || value === 'supporter' ? (value as SubscriptionTier) : 'free';

const normalizePlan = (value: unknown): IapPlan | null =>
  value === 'monthly' || value === 'annual' || value === 'supporter'
    ? (value as IapPlan)
    : null;

const normalizeTierFromPlan = (value: unknown): SubscriptionTier =>
  value === 'supporter'
    ? 'supporter'
    : value === 'premium' || value === 'monthly' || value === 'annual'
      ? 'premium'
      : 'free';

const isPremiumTier = (value: unknown): boolean =>
  value === 'premium' || value === 'supporter';

const normalizePurchasePayloadText = (value: unknown, maxLength = 16_000): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const APPLE_RECEIPT_PRIORITY_FIELDS = [
  'signedTransactionInfoIOS',
  'signedTransactionInfo',
  'signedTransactionJwsIOS',
  'signedTransactionJws',
  'appStoreReceiptIOS',
  'appStoreReceipt',
  'transactionReceiptIOS',
  'transactionReceipt',
  'receiptDataIOS',
  'receiptData',
  'verificationResultIOS',
  'verificationResult',
] as const;

const APPLE_RECEIPT_FALLBACK_KEY_PATTERN =
  /(signed.*transaction|app.?store.*receipt|transaction.*receipt|receipt(?!.*identifier)|jws)/i;

const resolveAppleReceiptPayload = (purchaseDetails: Record<string, unknown>): string => {
  const seen = new Set<string>();
  const addCandidate = (value: unknown): string => {
    const normalized = normalizePurchasePayloadText(value);
    if (!normalized || seen.has(normalized)) return '';
    seen.add(normalized);
    return normalized;
  };

  for (const field of APPLE_RECEIPT_PRIORITY_FIELDS) {
    const candidate = addCandidate(purchaseDetails[field]);
    if (candidate) return candidate;
  }

  for (const [key, value] of Object.entries(purchaseDetails)) {
    if (!APPLE_RECEIPT_FALLBACK_KEY_PATTERN.test(key)) continue;
    const candidate = addCandidate(value);
    if (candidate) return candidate;
  }

  return '';
};

export function useSubscription(accessToken: string | null) {
  const [state, setState] = useState<SubscriptionState>(INITIAL);
  const mountedRef = useRef(true);
  const accessTokenRef = useRef(accessToken);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setState((current) => ({ ...current, loading: false }));
      return;
    }

    const init = async () => {
      try {
        await initConnection();
        const products = await fetchProducts({
          skus: Object.values(IAP_PRODUCTS),
          type: 'all',
        });
        if (!mountedRef.current) return;
        setState((current) => ({
          ...current,
          products: products as Product[],
          loading: false,
        }));
      } catch {
        if (!mountedRef.current) return;
        setState((current) => ({ ...current, loading: false }));
      }
    };

    void init();
    return () => {
      void endConnection();
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    const currentAccessToken = accessTokenRef.current;
    if (!currentAccessToken) {
      setState((current) => ({
        ...current,
        tier: 'free',
        currentPlan: null,
        isPremium: false,
        loading: false,
      }));
      return;
    }

    const baseUrl = resolveMobileApiBaseUrl();
    if (!baseUrl) {
      setState((current) => ({ ...current, loading: false }));
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/subscription-status`, {
        headers: { Authorization: `Bearer ${currentAccessToken}` },
      });
      const payload = await response.json().catch(() => null);
      if (!mountedRef.current) return;

      if (payload?.ok) {
        const currentPlan = normalizePlan(payload.subscription?.plan);
        const payloadTier = normalizeTier(payload.tier);
        const tier =
          payloadTier !== 'free'
            ? payloadTier
            : normalizeTierFromPlan(currentPlan);
        const isPremium = payload.isPremium === true || isPremiumTier(tier);
        setState((current) => ({
          ...current,
          tier,
          currentPlan,
          isPremium,
          loading: false,
        }));
        return;
      }

      setState((current) => ({ ...current, loading: false }));
    } catch {
      if (!mountedRef.current) return;
      setState((current) => ({ ...current, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [accessToken, refreshStatus]);

  const verifyPurchase = useCallback(async (input: {
    productId: string;
    receipt: string;
    purchaseToken?: string | null;
    transactionId?: string | null;
    appBundleIdIOS?: string | null;
    originalTransactionIdentifierIOS?: string | null;
    packageNameAndroid?: string | null;
    purchaseState?: unknown;
    store?: string | null;
    platform?: string | null;
  }): Promise<boolean> => {
    const baseUrl = resolveMobileApiBaseUrl();
    if (!baseUrl || !accessToken) return false;

    const response = await fetch(`${baseUrl}/api/subscription-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        provider: Platform.OS === 'ios' ? 'apple' : 'google',
        receipt: input.receipt,
        productId: input.productId,
        purchaseToken: input.purchaseToken || null,
        transactionId: input.transactionId || null,
        appBundleIdIOS: input.appBundleIdIOS || null,
        originalTransactionIdentifierIOS: input.originalTransactionIdentifierIOS || null,
        packageNameAndroid: input.packageNameAndroid || null,
        purchaseState: input.purchaseState ?? null,
        store: input.store || null,
        platform: input.platform || Platform.OS,
      }),
    });

    const payload = await response.json().catch(() => null);
    return payload?.ok === true;
  }, [accessToken]);

  const purchase = useCallback(async (plan: IapPlan): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    setState((current) => ({ ...current, purchasing: true, error: null }));
    try {
      const sku = IAP_PRODUCTS[plan];
      const result = await requestPurchase({
        request: {
          apple: { sku },
          google: { skus: [sku] },
        },
        type: PLAN_TYPE[plan],
      });

      const receipt = Array.isArray(result) ? result[0] : (result as Purchase | null);
      const purchaseDetails =
        receipt && typeof receipt === 'object'
          ? (receipt as unknown as Record<string, unknown>)
          : {};
      const purchaseToken = String(receipt?.purchaseToken || '').trim();
      const transactionId = String(receipt?.transactionId || '').trim();
      const receiptPayload =
        Platform.OS === 'ios'
          ? resolveAppleReceiptPayload(purchaseDetails) || purchaseToken || transactionId
          : purchaseToken || transactionId;
      if (!receiptPayload && !purchaseToken && !transactionId) {
        setState((current) => ({ ...current, purchasing: false }));
        return false;
      }

      const verified = await verifyPurchase({
        productId: sku,
        receipt: receiptPayload,
        purchaseToken: purchaseToken || null,
        transactionId: transactionId || null,
        appBundleIdIOS: String(purchaseDetails.appBundleIdIOS || '').trim() || null,
        originalTransactionIdentifierIOS:
          String(purchaseDetails.originalTransactionIdentifierIOS || '').trim() || null,
        packageNameAndroid: String(purchaseDetails.packageNameAndroid || '').trim() || null,
        purchaseState: receipt?.purchaseState ?? null,
        store: String(receipt?.store || '').trim() || null,
        platform: String(receipt?.platform || Platform.OS).trim() || Platform.OS,
      });
      if (!verified) {
        setState((current) => ({
          ...current,
          purchasing: false,
          error: 'Satin alma dogrulanamadi.',
        }));
        return false;
      }

      if (receipt) {
        await finishTransaction({
          purchase: receipt as Purchase,
          isConsumable: false,
        }).catch(() => {});
      }

      await refreshStatus();
      if (!mountedRef.current) return true;
      setState((current) => ({ ...current, purchasing: false }));
      return true;
    } catch (error: unknown) {
      const cancelled = (error as { code?: string })?.code === 'E_USER_CANCELLED';
      setState((current) => ({
        ...current,
        purchasing: false,
        error: cancelled ? null : 'Satin alma basarisiz.',
      }));
      return false;
    }
  }, [refreshStatus, verifyPurchase]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    setState((current) => ({ ...current, purchasing: true, error: null }));
    try {
      const purchases = await getAvailablePurchases();
      if (!purchases.length) {
        setState((current) => ({ ...current, purchasing: false }));
        return false;
      }

      let restored = false;
      for (const purchase of purchases) {
        const productId = String(purchase.productId || '').trim();
        const purchaseDetails =
          purchase && typeof purchase === 'object'
            ? (purchase as unknown as Record<string, unknown>)
            : {};
        const purchaseToken = String(purchase.purchaseToken || '').trim();
        const transactionId = String(purchase.transactionId || '').trim();
        const receiptPayload =
          Platform.OS === 'ios'
            ? resolveAppleReceiptPayload(purchaseDetails) || purchaseToken || transactionId
            : purchaseToken || transactionId;
        if (!productId || (!receiptPayload && !purchaseToken && !transactionId)) continue;
        const verified = await verifyPurchase({
          productId,
          receipt: receiptPayload,
          purchaseToken: purchaseToken || null,
          transactionId: transactionId || null,
          appBundleIdIOS: String(purchaseDetails.appBundleIdIOS || '').trim() || null,
          originalTransactionIdentifierIOS:
            String(purchaseDetails.originalTransactionIdentifierIOS || '').trim() || null,
          packageNameAndroid: String(purchaseDetails.packageNameAndroid || '').trim() || null,
          purchaseState: purchase.purchaseState ?? null,
          store: String(purchase.store || '').trim() || null,
          platform: String(purchase.platform || Platform.OS).trim() || Platform.OS,
        });
        if (verified) {
          await finishTransaction({
            purchase,
            isConsumable: false,
          }).catch(() => {});
        }
        restored = restored || verified;
      }

      await refreshStatus();
      if (!mountedRef.current) return restored;
      setState((current) => ({ ...current, purchasing: false }));
      return restored;
    } catch {
      setState((current) => ({ ...current, purchasing: false }));
      return false;
    }
  }, [refreshStatus, verifyPurchase]);

  return { ...state, purchase, restore, refreshStatus };
}
