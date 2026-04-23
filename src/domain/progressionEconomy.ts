export const WALLET_STARTER_TICKETS = 12;

export const REEL_REWARDED_AD_AMOUNT = 2;
export const REEL_REWARDED_AD_DAILY_LIMIT = 2;
export const REEL_REWARDED_AD_COOLDOWN_MINUTES = 15;

export const WALLET_EARN_RULES = [
  {
    key: 'starter',
    title: 'Ilk acilis',
    amountLabel: `+${WALLET_STARTER_TICKETS}`,
    detail: 'Yeni cuzdan ilk kez acildiginda bir kez eklenir.',
  },
  {
    key: 'daily_quiz',
    title: 'Gunluk 5 film',
    amountLabel: '+6',
    detail: 'Her film bitince +1, tum set kapaninca +1 daha.',
  },
  {
    key: 'daily_comments',
    title: 'Gunluk yorum turu',
    amountLabel: '+10',
    detail: 'Kalite esigini gecen bes yorum tamamlanirsa.',
  },
  {
    key: 'pool_runs',
    title: 'Quick ve Marathon',
    amountLabel: '+2 / +3',
    detail: 'Turu bitirince bilet gelir, kusursuz tur daha cok verir.',
  },
  {
    key: 'blur',
    title: 'Blur Quiz',
    amountLabel: '+1 / +2',
    detail: 'Erken dogru tahmin daha yuksek odul verir.',
  },
] as const;

export const WALLET_INVENTORY_KEYS = [
  'joker_fifty_fifty',
  'joker_freeze',
  'joker_pass',
  'streak_shield',
] as const;

export type WalletInventoryKey = (typeof WALLET_INVENTORY_KEYS)[number];

export type WalletInventory = Record<WalletInventoryKey, number>;

export const DEFAULT_WALLET_INVENTORY: WalletInventory = {
  joker_fifty_fifty: 0,
  joker_freeze: 0,
  joker_pass: 0,
  streak_shield: 0,
};

export const WALLET_STORE_ITEMS = [
  {
    key: 'joker_fifty_fifty',
    title: '50/50 Joker',
    subtitle: 'Bir soruda iki yanlisi kaldirir.',
    reelCost: 12,
    inventoryKey: 'joker_fifty_fifty',
    quantity: 1,
  },
  {
    key: 'joker_freeze',
    title: 'Freeze Joker',
    subtitle: 'Rush ve maratonda +7 saniye dondurma verir.',
    reelCost: 15,
    inventoryKey: 'joker_freeze',
    quantity: 1,
  },
  {
    key: 'joker_pass',
    title: 'Pass Joker',
    subtitle: 'Rush ve maratonda bir soruyu pas gecirir.',
    reelCost: 15,
    inventoryKey: 'joker_pass',
    quantity: 1,
  },
  {
    key: 'streak_shield',
    title: 'Streak Kalkani',
    subtitle: 'Tek kayip gununde seriyi korur.',
    reelCost: 48,
    inventoryKey: 'streak_shield',
    quantity: 1,
  },
] as const;

export type WalletStoreItemKey = (typeof WALLET_STORE_ITEMS)[number]['key'];

export const PREMIUM_STARTER_BUNDLE: WalletInventory = {
  joker_fifty_fifty: 2,
  joker_freeze: 2,
  joker_pass: 1,
  streak_shield: 0,
};

export const REEL_TOPUP_PACKS = [
  {
    key: 'starter',
    productId: 'com.absolutecinema.reel.80',
    reels: 80,
    title: '80 Reel',
    badge: 'Hizli destek',
    fallbackDisplayPrice: '$0.99',
    featured: false,
  },
  {
    key: 'standard',
    productId: 'com.absolutecinema.reel.200',
    reels: 200,
    title: '200 Reel',
    badge: 'Standart',
    fallbackDisplayPrice: '$1.99',
    featured: false,
  },
  {
    key: 'best_value',
    productId: 'com.absolutecinema.reel.550',
    reels: 550,
    title: '550 Reel',
    badge: 'Populer',
    fallbackDisplayPrice: '$4.99',
    featured: true,
  },
  {
    key: 'vault',
    productId: 'com.absolutecinema.reel.1200',
    reels: 1200,
    title: '1200 Reel',
    badge: 'Buyuk paket',
    fallbackDisplayPrice: '$9.99',
    featured: false,
  },
] as const;

export type ReelTopupPackKey = (typeof REEL_TOPUP_PACKS)[number]['key'];

export const REEL_TOPUP_PRODUCT_IDS = Object.fromEntries(
  REEL_TOPUP_PACKS.map((pack) => [pack.key, pack.productId])
) as Record<ReelTopupPackKey, string>;

export const isWalletInventoryKey = (value: unknown): value is WalletInventoryKey =>
  WALLET_INVENTORY_KEYS.includes(String(value || '').trim() as WalletInventoryKey);

export const isWalletStoreItemKey = (value: unknown): value is WalletStoreItemKey =>
  WALLET_STORE_ITEMS.some((item) => item.key === String(value || '').trim());

export const findWalletStoreItem = (key: unknown) =>
  WALLET_STORE_ITEMS.find((item) => item.key === String(key || '').trim()) || null;

export const findReelTopupPackByProductId = (productId: unknown) =>
  REEL_TOPUP_PACKS.find((pack) => pack.productId === String(productId || '').trim()) || null;

export const getReelTopupProductIds = (): string[] => REEL_TOPUP_PACKS.map((pack) => pack.productId);
