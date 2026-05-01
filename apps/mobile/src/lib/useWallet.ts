import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type Purchase,
} from 'expo-iap';
import { showRewardedAd } from './mobileAds';
import { resolveMobileApiBaseUrl } from './mobileEnv';
import {
  AVATAR_PURCHASE_COST,
  DEFAULT_WALLET_INVENTORY,
  REEL_REWARDED_AD_AMOUNT,
  REEL_REWARDED_AD_DAILY_LIMIT,
  REEL_TOPUP_PACKS,
  type ReelTopupPackKey,
  type WalletInventory,
  type WalletInventoryKey,
  type WalletStoreItemKey,
} from '../../../../src/domain/progressionEconomy';
import {
  type WalletDailyTaskKey,
  type WalletDailyTaskStatus,
  type WalletDailyTaskSnapshot,
} from '../../../../src/domain/walletDailyTasks';

type WalletLanguage = 'tr' | 'en' | 'es' | 'fr';

export type WalletSnapshot = {
  balance: number;
  inventory: WalletInventory;
  lifetimeEarned: number;
  lifetimeSpent: number;
  premiumStarterGrantedAt: string | null;
  rewardedAd: {
    available: boolean;
    remainingClaims: number;
    dailyLimit: number;
    rewardAmount: number;
    cooldownRemainingSeconds: number;
  };
  dailyTasks: WalletDailyTaskSnapshot[];
  ownedAvatarIds: string[];
  avatarPurchaseCost: number;
};

type WalletState = {
  loading: boolean;
  topupLoading: boolean;
  actionBusy: boolean;
  topupPurchasing: boolean;
  snapshot: WalletSnapshot;
  topupProducts: Product[];
  error: string | null;
  message: string | null;
};

const INITIAL_SNAPSHOT: WalletSnapshot = {
  balance: 0,
  inventory: DEFAULT_WALLET_INVENTORY,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  premiumStarterGrantedAt: null,
  rewardedAd: {
    available: false,
    remainingClaims: REEL_REWARDED_AD_DAILY_LIMIT,
    dailyLimit: REEL_REWARDED_AD_DAILY_LIMIT,
    rewardAmount: REEL_REWARDED_AD_AMOUNT,
    cooldownRemainingSeconds: 0,
  },
  dailyTasks: [],
  ownedAvatarIds: [],
  avatarPurchaseCost: AVATAR_PURCHASE_COST,
};

const INITIAL_STATE: WalletState = {
  loading: true,
  topupLoading: Platform.OS !== 'web',
  actionBusy: false,
  topupPurchasing: false,
  snapshot: INITIAL_SNAPSHOT,
  topupProducts: [],
  error: null,
  message: null,
};

const WALLET_COPY = {
  tr: {
    loadFailed: 'Bilet cuzdani simdilik baglanamiyor.',
    spendFailed: 'Bilet harcamasi tamamlanamadi.',
    spendSuccess: 'Bilet satin alindi.',
    rewardNotCompleted: 'Odullu reklam tamamlanmadi.',
    rewardFailed: 'Bilet odulu verilemedi.',
    rewardMobileOnly: 'Odullu reklam yalnizca mobil uygulamada calisir.',
    rewardSuccess: (amount: number) => `+${amount} Bilet eklendi.`,
    topupMobileOnly: 'Bilet satin alma yalnizca mobil uygulamada calisir.',
    topupVerifyFailed: 'Bilet satin alma dogrulanamadi.',
    topupReceiptMissing: 'Satin alma islemi tamamlanamadi.',
    topupSuccess: (amount: number) => `+${amount} Bilet eklendi.`,
    topupFailed: 'Bilet satin alma basarisiz.',
    taskClaimFailed: 'Gunluk gorev odulu alinamadi.',
    taskClaimSuccess: (amount: number) => `Gunluk gorevden +${amount} Bilet alindi.`,
    avatarBuyFailed: 'Avatar satin alinamadi.',
    avatarBuySuccess: 'Avatar satin alindi.',
  },
  en: {
    loadFailed: 'Ticket wallet could not be loaded.',
    spendFailed: 'Ticket purchase could not be completed.',
    spendSuccess: 'Ticket item purchased.',
    rewardNotCompleted: 'Rewarded ad was not completed.',
    rewardFailed: 'Ticket reward could not be granted.',
    rewardMobileOnly: 'Rewarded ads only work in the mobile app.',
    rewardSuccess: (amount: number) => `+${amount} Tickets added.`,
    topupMobileOnly: 'Ticket purchases only work in the mobile app.',
    topupVerifyFailed: 'Ticket purchase could not be verified.',
    topupReceiptMissing: 'Purchase could not be completed.',
    topupSuccess: (amount: number) => `+${amount} Tickets added.`,
    topupFailed: 'Ticket purchase failed.',
    taskClaimFailed: 'Daily task reward could not be claimed.',
    taskClaimSuccess: (amount: number) => `Daily task claimed: +${amount} Tickets.`,
    avatarBuyFailed: 'Avatar could not be purchased.',
    avatarBuySuccess: 'Avatar purchased.',
  },
  es: {
    loadFailed: 'No se pudo cargar la cartera de entradas.',
    spendFailed: 'No se pudo completar la compra con entradas.',
    spendSuccess: 'Compra completada con entradas.',
    rewardNotCompleted: 'El anuncio con recompensa no se completo.',
    rewardFailed: 'No se pudo otorgar la recompensa de entradas.',
    rewardMobileOnly: 'Los anuncios con recompensa solo funcionan en la app movil.',
    rewardSuccess: (amount: number) => `+${amount} entradas añadidas.`,
    topupMobileOnly: 'Las compras de entradas solo funcionan en la app movil.',
    topupVerifyFailed: 'No se pudo verificar la compra de entradas.',
    topupReceiptMissing: 'No se pudo completar la compra.',
    topupSuccess: (amount: number) => `+${amount} entradas añadidas.`,
    topupFailed: 'La compra de entradas fallo.',
    taskClaimFailed: 'No se pudo reclamar la mision diaria.',
    taskClaimSuccess: (amount: number) => `Mision diaria reclamada: +${amount} entradas.`,
    avatarBuyFailed: 'No se pudo comprar el avatar.',
    avatarBuySuccess: 'Avatar comprado.',
  },
  fr: {
    loadFailed: 'Le portefeuille de billets est indisponible.',
    spendFailed: 'L achat avec billets a echoue.',
    spendSuccess: 'Achat en billets confirme.',
    rewardNotCompleted: 'La pub recompensee n a pas ete regardee jusqu au bout.',
    rewardFailed: 'La recompense en billets a echoue.',
    rewardMobileOnly: 'Les pubs recompensees fonctionnent seulement dans l application mobile.',
    rewardSuccess: (amount: number) => `+${amount} billets ajoutes.`,
    topupMobileOnly: 'Les achats de billets fonctionnent seulement dans l application mobile.',
    topupVerifyFailed: 'L achat de billets n a pas pu etre verifie.',
    topupReceiptMissing: 'L achat n a pas pu etre finalise.',
    topupSuccess: (amount: number) => `+${amount} billets ajoutes.`,
    topupFailed: 'L achat de billets a echoue.',
    taskClaimFailed: 'La mission quotidienne n a pas pu etre reclamee.',
    taskClaimSuccess: (amount: number) => `Mission quotidienne reclamee: +${amount} billets.`,
    avatarBuyFailed: 'L avatar n a pas pu etre achete.',
    avatarBuySuccess: 'Avatar achete.',
  },
} as const;

const resolveWalletCopy = (language: WalletLanguage) => WALLET_COPY[language] || WALLET_COPY.en;

const normalizeWalletErrorMessage = (error: unknown, fallback: string): string => {
  const raw = error instanceof Error ? String(error.message || '').trim() : String(error || '').trim();
  const lower = raw.toLowerCase();
  if (
    !raw ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('connect to the remote server') ||
    lower.includes('uza')
  ) {
    return fallback;
  }
  return raw;
};

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

const normalizeSnapshot = (value: unknown): WalletSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return INITIAL_SNAPSHOT;
  const raw = value as Record<string, unknown>;
  const rewardedRaw =
    raw.rewardedAd && typeof raw.rewardedAd === 'object' && !Array.isArray(raw.rewardedAd)
      ? (raw.rewardedAd as Record<string, unknown>)
      : {};
  const inventoryRaw =
    raw.inventory && typeof raw.inventory === 'object' && !Array.isArray(raw.inventory)
      ? (raw.inventory as Record<string, unknown>)
      : {};
  const dailyTasks: WalletDailyTaskSnapshot[] = Array.isArray(raw.dailyTasks)
    ? raw.dailyTasks
        .filter((task): task is Record<string, unknown> =>
          Boolean(task && typeof task === 'object' && !Array.isArray(task))
        )
        .map((task) => {
          const status: WalletDailyTaskStatus =
            task.status === 'claimed' || task.status === 'ready' || task.status === 'locked'
              ? task.status
              : 'locked';
          return {
            key: String(task.key || '').trim() as WalletDailyTaskKey,
            title: String(task.title || '').trim(),
            description: String(task.description || '').trim(),
            ticketReward: Math.max(0, Number(task.ticketReward) || 0),
            progress: Math.max(0, Number(task.progress) || 0),
            target: Math.max(1, Number(task.target) || 1),
            status,
          };
        })
        .filter((task) => Boolean(task.key && task.title && task.ticketReward > 0))
    : [];
  return {
    balance: Math.max(0, Number(raw.balance) || 0),
    inventory: {
      joker_fifty_fifty: Math.max(0, Number(inventoryRaw.joker_fifty_fifty) || 0),
      joker_freeze: Math.max(0, Number(inventoryRaw.joker_freeze) || 0),
      joker_pass: Math.max(0, Number(inventoryRaw.joker_pass) || 0),
      streak_shield: Math.max(0, Number(inventoryRaw.streak_shield) || 0),
    },
    lifetimeEarned: Math.max(0, Number(raw.lifetimeEarned) || 0),
    lifetimeSpent: Math.max(0, Number(raw.lifetimeSpent) || 0),
    premiumStarterGrantedAt: String(raw.premiumStarterGrantedAt || '').trim() || null,
    rewardedAd: {
      available: Platform.OS !== 'web' && rewardedRaw.available === true,
      remainingClaims: Math.max(0, Number(rewardedRaw.remainingClaims) || 0),
      dailyLimit: Math.max(0, Number(rewardedRaw.dailyLimit) || REEL_REWARDED_AD_DAILY_LIMIT),
      rewardAmount: Math.max(0, Number(rewardedRaw.rewardAmount) || REEL_REWARDED_AD_AMOUNT),
      cooldownRemainingSeconds: Math.max(0, Number(rewardedRaw.cooldownRemainingSeconds) || 0),
    },
    dailyTasks,
    ownedAvatarIds: Array.isArray(raw.ownedAvatarIds)
      ? (raw.ownedAvatarIds as unknown[]).map((id) => String(id || '').trim()).filter(Boolean)
      : [],
    avatarPurchaseCost: Math.max(0, Number(raw.avatarPurchaseCost) || AVATAR_PURCHASE_COST),
  };
};

const TOPUP_PRODUCT_IDS: ReadonlySet<string> = new Set(REEL_TOPUP_PACKS.map((pack) => pack.productId));

export function useWallet(accessToken: string | null, language: WalletLanguage = 'tr') {
  const [state, setState] = useState<WalletState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const topupPurchaseActiveRef = useRef(false);
  const accessTokenRef = useRef(accessToken);
  const copy = resolveWalletCopy(language);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      topupPurchaseActiveRef.current = false;
    };
  }, []);

  const apiBase = resolveMobileApiBaseUrl();

  useEffect(() => {
    if (Platform.OS === 'web') {
      setState((current) => ({ ...current, topupLoading: false }));
      return;
    }

    const init = async () => {
      try {
        await initConnection();
        const products = await fetchProducts({
          skus: REEL_TOPUP_PACKS.map((pack) => pack.productId),
          type: 'in-app',
        });
        if (!mountedRef.current) return;
        setState((current) => ({
          ...current,
          topupProducts: products as Product[],
          topupLoading: false,
        }));
      } catch {
        if (!mountedRef.current) return;
        setState((current) => ({ ...current, topupLoading: false }));
      }
    };

    void init();

    const subscription = purchaseUpdatedListener(async (purchase: Purchase) => {
      const productId = String(purchase.productId || '').trim();
      if (!TOPUP_PRODUCT_IDS.has(productId)) return;
      if (topupPurchaseActiveRef.current) return;

      const token = accessTokenRef.current;
      const base = apiBase;
      if (!token || !base) return;

      const purchaseDetails = purchase as unknown as Record<string, unknown>;
      const receiptToken = String(purchase.purchaseToken || '').trim();
      const transactionId = String(purchase.transactionId || '').trim();
      const receiptPayload =
        Platform.OS === 'ios'
          ? resolveAppleReceiptPayload(purchaseDetails) || receiptToken || transactionId
          : receiptToken || transactionId;
      if (!receiptPayload && !transactionId) return;

      try {
        const response = await fetch(`${base}/api/wallet-topup-verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            provider: Platform.OS === 'ios' ? 'apple' : 'google',
            productId,
            receipt: receiptPayload,
            purchaseToken: receiptToken || null,
            transactionId: transactionId || null,
            appBundleIdIOS: String(purchaseDetails.appBundleIdIOS || '').trim() || null,
            originalTransactionIdentifierIOS:
              String(purchaseDetails.originalTransactionIdentifierIOS || '').trim() || null,
            packageNameAndroid: String(purchaseDetails.packageNameAndroid || '').trim() || null,
            purchaseState: purchase.purchaseState ?? null,
            store: String(purchase.store || '').trim() || null,
            platform: String(purchase.platform || Platform.OS).trim() || Platform.OS,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.ok) {
          await finishTransaction({ purchase, isConsumable: true }).catch(() => {});
          if (mountedRef.current) {
            setState((current) => ({
              ...current,
              snapshot: normalizeSnapshot(payload.wallet),
            }));
          }
        }
      } catch {
        // Listener errors are non-fatal; the purchase will remain pending for next launch.
      }
    });

    return () => {
      subscription.remove();
      void endConnection();
    };
  }, [apiBase]);

  const applySnapshot = useCallback((snapshot: unknown, message?: string | null) => {
    if (!mountedRef.current) return;
    setState((current) => ({
      ...current,
      snapshot: (() => {
        const nextSnapshot = normalizeSnapshot(snapshot);
        const raw = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
          ? (snapshot as Record<string, unknown>)
          : {};
        if (!Array.isArray(raw.dailyTasks) && current.snapshot.dailyTasks.length > 0) {
          return {
            ...nextSnapshot,
            dailyTasks: current.snapshot.dailyTasks,
          };
        }
        return nextSnapshot;
      })(),
      loading: false,
      actionBusy: false,
      topupPurchasing: false,
      error: null,
      message: message ?? current.message,
    }));
  }, []);

  const setFailure = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setState((current) => ({
      ...current,
      loading: false,
      actionBusy: false,
      topupPurchasing: false,
      error: message,
      message: null,
    }));
  }, []);

  const reconcileTopupPurchaseState = useCallback(() => {
    if (!mountedRef.current || topupPurchaseActiveRef.current) return;
    setState((current) => (
      current.topupPurchasing
        ? {
            ...current,
            topupPurchasing: false,
          }
        : current
    ));
  }, []);

  const fetchJson = useCallback(async (path: string, init?: RequestInit) => {
    if (!apiBase || !accessToken) {
      throw new Error('Wallet API is not ready.');
    }
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }, [accessToken, apiBase]);

  const refresh = useCallback(async () => {
    if (!accessToken || !apiBase) {
      setState((current) => ({
        ...current,
        loading: false,
        snapshot: INITIAL_SNAPSHOT,
        error: null,
        message: null,
      }));
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(`${apiBase}/api/wallet-status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setFailure(String(payload?.error || copy.loadFailed));
        return;
      }
      applySnapshot(payload.wallet, null);
    } catch (error: unknown) {
      setFailure(normalizeWalletErrorMessage(error, copy.loadFailed));
    }
  }, [accessToken, apiBase, applySnapshot, copy.loadFailed, setFailure]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const buyStoreItem = useCallback(async (itemKey: WalletStoreItemKey): Promise<boolean> => {
    if (!accessToken || !apiBase) return false;
    setState((current) => ({
      ...current,
      actionBusy: true,
      error: null,
      message: null,
    }));
    try {
      const { response, payload } = await fetchJson('/api/wallet-spend', {
        method: 'POST',
        body: JSON.stringify({ itemKey }),
      });
      if (!response.ok || !payload?.ok) {
        setFailure(String(payload?.error || copy.spendFailed));
        return false;
      }
      applySnapshot(payload.wallet, copy.spendSuccess);
      return true;
    } catch (error: unknown) {
      setFailure(normalizeWalletErrorMessage(error, copy.spendFailed));
      return false;
    }
  }, [accessToken, apiBase, applySnapshot, copy.spendFailed, copy.spendSuccess, fetchJson, setFailure]);

  const consumeInventoryItem = useCallback(async (itemKey: WalletInventoryKey): Promise<boolean> => {
    if (!accessToken || !apiBase) return false;
    try {
      const { response, payload } = await fetchJson('/api/wallet-consume', {
        method: 'POST',
        body: JSON.stringify({ itemKey }),
      });
      if (!response.ok || !payload?.ok) {
        return false;
      }
      applySnapshot(payload.wallet, null);
      return true;
    } catch {
      return false;
    }
  }, [accessToken, apiBase, applySnapshot, fetchJson]);

  const claimRewardedReels = useCallback(async (): Promise<boolean> => {
    if (!accessToken || !apiBase) return false;
    if (Platform.OS === 'web') {
      setFailure(copy.rewardMobileOnly);
      return false;
    }
    setState((current) => ({
      ...current,
      actionBusy: true,
      error: null,
      message: null,
    }));
    try {
      const rewarded = await showRewardedAd();
      if (!rewarded) {
        setFailure(copy.rewardNotCompleted);
        return false;
      }

      const { response, payload } = await fetchJson('/api/wallet-rewarded', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!response.ok || !payload?.ok) {
        setFailure(String(payload?.error || copy.rewardFailed));
        return false;
      }
      const rewardLabel = Number(payload.granted) || state.snapshot.rewardedAd.rewardAmount;
      applySnapshot(payload.wallet, copy.rewardSuccess(rewardLabel));
      return true;
    } catch (error: unknown) {
      setFailure(normalizeWalletErrorMessage(error, copy.rewardFailed));
      return false;
    }
  }, [
    accessToken,
    apiBase,
    applySnapshot,
    copy.rewardFailed,
    copy.rewardMobileOnly,
    copy.rewardNotCompleted,
    copy.rewardSuccess,
    fetchJson,
    setFailure,
    state.snapshot.rewardedAd.rewardAmount,
  ]);

  const claimDailyTask = useCallback(async (taskKey: WalletDailyTaskKey): Promise<boolean> => {
    if (!accessToken || !apiBase) return false;
    setState((current) => ({
      ...current,
      actionBusy: true,
      error: null,
      message: null,
    }));
    try {
      const { response, payload } = await fetchJson('/api/wallet-task-claim', {
        method: 'POST',
        body: JSON.stringify({ taskKey }),
      });
      if (!response.ok || !payload?.ok) {
        if (payload?.wallet) {
          applySnapshot(payload.wallet, null);
        }
        setFailure(String(payload?.error || copy.taskClaimFailed));
        return false;
      }
      const rewardLabel = Number(payload.granted) || 0;
      applySnapshot(payload.wallet, copy.taskClaimSuccess(rewardLabel));
      return true;
    } catch (error: unknown) {
      setFailure(normalizeWalletErrorMessage(error, copy.taskClaimFailed));
      return false;
    }
  }, [
    accessToken,
    apiBase,
    applySnapshot,
    copy.taskClaimFailed,
    copy.taskClaimSuccess,
    fetchJson,
    setFailure,
  ]);

  const purchaseTopupPack = useCallback(async (packKey: ReelTopupPackKey): Promise<boolean> => {
    const pack = REEL_TOPUP_PACKS.find((entry) => entry.key === packKey);
    if (!pack) return false;
    if (Platform.OS === 'web') {
      setFailure(copy.topupMobileOnly);
      return false;
    }

    topupPurchaseActiveRef.current = true;
    setState((current) => ({
      ...current,
      topupPurchasing: true,
      error: null,
      message: null,
    }));

    try {
      const result = await requestPurchase({
        request: {
          apple: { sku: pack.productId },
          google: { skus: [pack.productId] },
        },
        type: 'in-app',
      });

      const purchase = Array.isArray(result) ? result[0] : (result as Purchase | null);
      const purchaseDetails =
        purchase && typeof purchase === 'object'
          ? (purchase as unknown as Record<string, unknown>)
          : {};
      const receiptToken = String(purchase?.purchaseToken || '').trim();
      const transactionId = String(purchase?.transactionId || '').trim();
      const receiptPayload =
        Platform.OS === 'ios'
          ? resolveAppleReceiptPayload(purchaseDetails) || receiptToken || transactionId
          : receiptToken || transactionId;
      if (!receiptPayload && !transactionId) {
        topupPurchaseActiveRef.current = false;
        setFailure(copy.topupReceiptMissing);
        return false;
      }

      const { response, payload } = await fetchJson('/api/wallet-topup-verify', {
        method: 'POST',
        body: JSON.stringify({
          provider: Platform.OS === 'ios' ? 'apple' : 'google',
          productId: pack.productId,
          receipt: receiptPayload,
          purchaseToken: receiptToken || null,
          transactionId: transactionId || null,
          appBundleIdIOS: String(purchaseDetails.appBundleIdIOS || '').trim() || null,
          originalTransactionIdentifierIOS:
            String(purchaseDetails.originalTransactionIdentifierIOS || '').trim() || null,
          packageNameAndroid: String(purchaseDetails.packageNameAndroid || '').trim() || null,
          purchaseState: purchase?.purchaseState ?? null,
          signatureAndroid: String(purchaseDetails.signatureAndroid || '').trim() || null,
          store: String(purchase?.store || '').trim() || null,
          platform: String(purchase?.platform || Platform.OS).trim() || Platform.OS,
        }),
      });

      if (!response.ok || !payload?.ok) {
        topupPurchaseActiveRef.current = false;
        setFailure(String(payload?.error || copy.topupVerifyFailed));
        return false;
      }

      topupPurchaseActiveRef.current = false;
      if (purchase) {
        try {
          await finishTransaction({ purchase: purchase as Purchase, isConsumable: true });
        } catch {
          // Non-fatal: purchase was already credited to the wallet.
        }
      }
      applySnapshot(payload.wallet, copy.topupSuccess(pack.reels));
      return true;
    } catch (error: unknown) {
      const cancelled = (error as { code?: string })?.code === 'E_USER_CANCELLED';
      topupPurchaseActiveRef.current = false;
      if (cancelled) {
        if (mountedRef.current) {
          setState((current) => ({
            ...current,
            topupPurchasing: false,
            actionBusy: false,
            error: null,
            message: null,
          }));
        }
        return false;
      }
      setFailure(normalizeWalletErrorMessage(error, copy.topupFailed));
      return false;
    }
  }, [applySnapshot, copy.topupFailed, copy.topupMobileOnly, copy.topupReceiptMissing, copy.topupSuccess, copy.topupVerifyFailed, fetchJson, setFailure]);

  const buyAvatar = useCallback(async (avatarId: string): Promise<boolean> => {
    if (!accessToken || !apiBase) return false;
    setState((current) => ({
      ...current,
      actionBusy: true,
      error: null,
      message: null,
    }));
    try {
      const { response, payload } = await fetchJson('/api/wallet-spend', {
        method: 'POST',
        body: JSON.stringify({ avatarId }),
      });
      if (!response.ok || !payload?.ok) {
        setFailure(String(payload?.error || copy.avatarBuyFailed));
        return false;
      }
      applySnapshot(payload.wallet, copy.avatarBuySuccess);
      return true;
    } catch (error: unknown) {
      setFailure(normalizeWalletErrorMessage(error, copy.avatarBuyFailed));
      return false;
    }
  }, [accessToken, apiBase, applySnapshot, copy.avatarBuyFailed, copy.avatarBuySuccess, fetchJson, setFailure]);

  const productMap = useMemo(() => {
    const next = new Map<string, Product>();
    for (const product of state.topupProducts) {
      next.set(String(product.id || '').trim(), product);
    }
    return next;
  }, [state.topupProducts]);

  return {
    loading: state.loading,
    topupLoading: state.topupLoading,
    actionBusy: state.actionBusy,
    topupPurchasing: state.topupPurchasing,
    error: state.error,
    message: state.message,
    snapshot: state.snapshot,
    productMap,
    reconcileTopupPurchaseState,
    refresh,
    buyStoreItem,
    consumeInventoryItem,
    claimRewardedReels,
    claimDailyTask,
    purchaseTopupPack,
    buyAvatar,
  };
}
