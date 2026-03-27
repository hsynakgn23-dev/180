import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  type Product,
  type Purchase,
} from 'expo-iap';

// ── Product IDs ──────────────────────────────────────────
export const IAP_PRODUCTS = {
  monthly:   'com.absolutecinema.premium.monthly',
  annual:    'com.absolutecinema.premium.annual',
  supporter: 'com.absolutecinema.premium.supporter',
} as const;

export type IapPlan = keyof typeof IAP_PRODUCTS;

// supporter is a one-time in-app purchase; monthly/annual are subscriptions
const PLAN_TYPE: Record<IapPlan, 'subs' | 'in-app'> = {
  monthly:   'subs',
  annual:    'subs',
  supporter: 'in-app',
};

export type SubscriptionTier = 'free' | 'premium' | 'supporter';

export type SubscriptionState = {
  tier: SubscriptionTier;
  isPremium: boolean;
  loading: boolean;
  products: Product[];
  purchasing: boolean;
  error: string | null;
};

const INITIAL: SubscriptionState = {
  tier: 'free',
  isPremium: false,
  loading: true,
  products: [],
  purchasing: false,
  error: null,
};

// ── Hook ──────────────────────────────────────────────────
export function useSubscription(accessToken: string | null) {
  const [state, setState] = useState<SubscriptionState>(INITIAL);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load products from App Store / Play Store
  useEffect(() => {
    if (Platform.OS === 'web') {
      setState(s => ({ ...s, loading: false }));
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
        setState(s => ({ ...s, products: products as Product[], loading: false }));
      } catch {
        if (!mountedRef.current) return;
        setState(s => ({ ...s, loading: false }));
      }
    };
    void init();
    return () => { void endConnection(); };
  }, []);

  // Check subscription status from backend
  const refreshStatus = useCallback(async () => {
    if (!accessToken) {
      setState(s => ({ ...s, tier: 'free', isPremium: false, loading: false }));
      return;
    }
    try {
      const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL || '';
      const res = await fetch(`${baseUrl}/api/subscription-status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!mountedRef.current) return;
      if (data.ok) {
        setState(s => ({ ...s, tier: data.tier, isPremium: data.isPremium, loading: false }));
      }
    } catch {
      if (!mountedRef.current) return;
      setState(s => ({ ...s, loading: false }));
    }
  }, [accessToken]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  // Purchase a plan
  const purchase = useCallback(async (plan: IapPlan): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    setState(s => ({ ...s, purchasing: true, error: null }));
    try {
      const sku = IAP_PRODUCTS[plan];
      const type = PLAN_TYPE[plan];

      const result = await requestPurchase({
        request: {
          apple: { sku },
          google: { skus: [sku] },
        },
        type,
      });

      const receipt = Array.isArray(result) ? result[0] : result as Purchase | null;
      if (!receipt) { setState(s => ({ ...s, purchasing: false })); return false; }

      // Verify with backend
      const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL || '';
      const verifyRes = await fetch(`${baseUrl}/api/subscription-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          provider: Platform.OS === 'ios' ? 'apple' : 'google',
          receipt: receipt.transactionId || '',
          productId: sku,
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.ok) {
        setState(s => ({ ...s, tier: 'premium', isPremium: true, purchasing: false }));
        return true;
      }
      setState(s => ({ ...s, purchasing: false, error: 'Satın alma doğrulanamadı.' }));
      return false;
    } catch (e: unknown) {
      const msg = (e as { code?: string })?.code === 'E_USER_CANCELLED' ? null : 'Satın alma başarısız.';
      setState(s => ({ ...s, purchasing: false, error: msg }));
      return false;
    }
  }, [accessToken]);

  // Restore purchases
  const restore = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    setState(s => ({ ...s, purchasing: true, error: null }));
    try {
      const purchases = await getAvailablePurchases();
      if (purchases.length > 0) {
        await refreshStatus();
        setState(s => ({ ...s, purchasing: false }));
        return true;
      }
      setState(s => ({ ...s, purchasing: false }));
      return false;
    } catch {
      setState(s => ({ ...s, purchasing: false }));
      return false;
    }
  }, [refreshStatus]);

  return { ...state, purchase, restore, refreshStatus };
}
