import {
  AVATAR_PURCHASE_COST,
  DEFAULT_WALLET_INVENTORY,
  findWalletStoreItem,
  PREMIUM_STARTER_BUNDLE,
  REEL_REWARDED_AD_AMOUNT,
  REEL_REWARDED_AD_COOLDOWN_MINUTES,
  REEL_REWARDED_AD_DAILY_LIMIT,
  WALLET_STARTER_TICKETS,
  type WalletInventory,
} from '../../src/domain/progressionEconomy.js';
import {
  hasProfileXpMirrorDrift,
  hasStoredProfileXp,
  withMirroredProfileXp,
} from '../../src/domain/profileXpState.js';
import { recordWalletLedgerEntry } from './progressionLedger.js';

type ProfileRow = {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  xp_state?: unknown;
  subscription_tier?: unknown;
  updated_at?: string | null;
};

// Supabase's generated builder types vary across local and deployed contexts.
// This helper only needs the `from(...)` entrypoint, so keep the contract broad.
type SupabaseClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type ProgressionWalletState = {
  balance: number;
  inventory: WalletInventory;
  lifetimeEarned: number;
  lifetimeSpent: number;
  rewardedClaimsToday: number;
  rewardedDate: string | null;
  lastRewardedClaimAt: string | null;
  premiumStarterGrantedAt: string | null;
  premiumStarterProductId: string | null;
  processedTopups: WalletProcessedTopup[];
  ownedAvatarIds: string[];
};

export type WalletProcessedTopup = {
  ref: string;
  provider: 'apple' | 'google';
  productId: string;
  grantedAt: string;
  purchaseDate: string | null;
  verificationKind: string;
  purchaseTokenHash: string | null;
  transactionId: string | null;
};

export type ProgressionWalletSnapshot = {
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
  ownedAvatarIds: string[];
  avatarPurchaseCost: number;
};

type LoadWalletProfileInput = {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  authenticatedUserId?: string | null;
};

export class WalletProfileAuthorizationError extends Error {
  statusCode = 403;

  constructor() {
    super('Wallet profile access is forbidden for this authenticated user.');
    this.name = 'WalletProfileAuthorizationError';
  }
}

const assertAuthenticatedWalletOwner = (input: {
  userId: string;
  authenticatedUserId?: string | null;
}): void => {
  const userId = String(input.userId ?? '').trim();
  const authenticatedUserId = String(input.authenticatedUserId ?? '').trim();
  if (authenticatedUserId && userId !== authenticatedUserId) {
    console.error('[wallet-profile] owner mismatch rejected', {
      userId,
      authenticatedUserId,
    });
    throw new WalletProfileAuthorizationError();
  }
};

type LoadedWalletProfile = {
  profile: ProfileRow | null;
  xpState: Record<string, unknown>;
  wallet: ProgressionWalletState;
};

type WalletMutationSuccess<TResult> = {
  ok: true;
  wallet: ProgressionWalletState;
  xpState?: Record<string, unknown>;
  result: TResult;
  persist?: boolean;
};

type WalletMutationFailure<TReason extends string> = {
  ok: false;
  reason: TReason;
};

type WalletMutationAttempt<TResult, TReason extends string> =
  | WalletMutationSuccess<TResult>
  | WalletMutationFailure<TReason>;

type WalletMutationResult<TResult, TReason extends string> =
  | {
      ok: true;
      profile: ProfileRow | null;
      xpState: Record<string, unknown>;
      wallet: ProgressionWalletState;
      result: TResult;
    }
  | {
      ok: false;
      profile: ProfileRow | null;
      xpState: Record<string, unknown>;
      wallet: ProgressionWalletState;
      reason: TReason;
    };

const WALLET_PROFILE_COLUMNS = 'user_id,email,display_name,xp_state,subscription_tier,updated_at';
const WALLET_MUTATION_MAX_RETRIES = 6;

type WalletMutationConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

type WalletMutationRpcRow = {
  ok?: unknown;
  reason?: unknown;
  wallet?: unknown;
  cost?: unknown;
  granted?: unknown;
  reels?: unknown;
  bundle_granted?: unknown;
};

const normalizeText = (value: unknown, maxLength = 200): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
};

const sanitizeRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
};

const normalizeRpcRow = (value: unknown): WalletMutationRpcRow => {
  if (Array.isArray(value)) {
    return normalizeRpcRow(value[0] || null);
  }
  if (!value || typeof value !== 'object') return {};
  return { ...(value as Record<string, unknown>) };
};

const getTodayKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeInventory = (value: unknown): WalletInventory => {
  const raw = sanitizeRecord(value);
  return {
    joker_fifty_fifty: toSafeInt(raw.joker_fifty_fifty),
    joker_freeze: toSafeInt(raw.joker_freeze),
    joker_pass: toSafeInt(raw.joker_pass),
    streak_shield: toSafeInt(raw.streak_shield),
  };
};

const normalizeProcessedTopups = (value: unknown): WalletProcessedTopup[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitizeRecord(entry))
    .map((entry) => {
      const provider = normalizeText(entry.provider, 20).toLowerCase();
      return {
        ref: normalizeText(entry.ref, 240),
        provider: provider === 'google' ? 'google' : 'apple',
        productId: normalizeText(entry.productId, 160),
        grantedAt: normalizeText(entry.grantedAt, 80),
        purchaseDate: normalizeText(entry.purchaseDate, 80) || null,
        verificationKind: normalizeText(entry.verificationKind, 80),
        purchaseTokenHash: normalizeText(entry.purchaseTokenHash, 80) || null,
        transactionId: normalizeText(entry.transactionId, 240) || null,
      } satisfies WalletProcessedTopup;
    })
    .filter((entry) => entry.ref && entry.productId && entry.grantedAt)
    .slice(-120);
};

const callWalletMutationRpc = async (
  input: WalletMutationConfig,
  payload: Record<string, unknown>
): Promise<WalletMutationRpcRow> => {
  const response = await fetch(
    `${input.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/wallet_apply_mutation`,
    {
      method: 'POST',
      headers: {
        apikey: input.supabaseServiceRoleKey,
        Authorization: `Bearer ${input.supabaseServiceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const rawPayload = await response.json().catch(() => null);
  const row = normalizeRpcRow(rawPayload);
  if (!response.ok) {
    const errorPayload = sanitizeRecord(rawPayload);
    const message = normalizeText(
      row.reason ?? errorPayload.message ?? errorPayload.error ?? 'Wallet mutation RPC failed.',
      320
    );
    throw new Error(message || 'Wallet mutation RPC failed.');
  }

  return row;
};

const normalizeOwnedAvatarIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((id) => normalizeText(id, 80)).filter(Boolean).slice(0, 500);
};

const normalizeWallet = (value: unknown): ProgressionWalletState => {
  const raw = sanitizeRecord(value);
  return {
    balance: toSafeInt(raw.balance),
    inventory: {
      ...DEFAULT_WALLET_INVENTORY,
      ...normalizeInventory(raw.inventory),
    },
    lifetimeEarned: toSafeInt(raw.lifetimeEarned),
    lifetimeSpent: toSafeInt(raw.lifetimeSpent),
    rewardedClaimsToday: toSafeInt(raw.rewardedClaimsToday),
    rewardedDate: normalizeText(raw.rewardedDate, 40) || null,
    lastRewardedClaimAt: normalizeText(raw.lastRewardedClaimAt, 80) || null,
    premiumStarterGrantedAt: normalizeText(raw.premiumStarterGrantedAt, 80) || null,
    premiumStarterProductId: normalizeText(raw.premiumStarterProductId, 120) || null,
    processedTopups: normalizeProcessedTopups(raw.processedTopups),
    ownedAvatarIds: normalizeOwnedAvatarIds(raw.ownedAvatarIds),
  };
};

const getInventoryCount = (inventory: WalletInventory): number =>
  DEFAULT_WALLET_INVENTORY_KEYS.reduce((total, key) => total + toSafeInt(inventory[key]), 0);

const DEFAULT_WALLET_INVENTORY_KEYS = Object.keys(DEFAULT_WALLET_INVENTORY) as Array<keyof WalletInventory>;

const isStarterEligibleWallet = (wallet: ProgressionWalletState): boolean =>
  wallet.balance <= 0 &&
  wallet.lifetimeEarned <= 0 &&
  wallet.lifetimeSpent <= 0 &&
  wallet.rewardedClaimsToday <= 0 &&
  !wallet.rewardedDate &&
  !wallet.lastRewardedClaimAt &&
  !wallet.premiumStarterGrantedAt &&
  !wallet.premiumStarterProductId &&
  wallet.processedTopups.length === 0 &&
  getInventoryCount(wallet.inventory) <= 0;

const mergeWalletInventory = (
  current: WalletInventory,
  delta: Partial<WalletInventory>
): WalletInventory => ({
  joker_fifty_fifty: toSafeInt(current.joker_fifty_fifty) + toSafeInt(delta.joker_fifty_fifty),
  joker_freeze: toSafeInt(current.joker_freeze) + toSafeInt(delta.joker_freeze),
  joker_pass: toSafeInt(current.joker_pass) + toSafeInt(delta.joker_pass),
  streak_shield: toSafeInt(current.streak_shield) + toSafeInt(delta.streak_shield),
});

const buildInventoryDelta = (
  itemKey: string,
  quantity: number
): Partial<WalletInventory> => {
  const normalizedQuantity = Math.trunc(quantity);
  switch (normalizeText(itemKey, 80)) {
    case 'joker_fifty_fifty':
      return { joker_fifty_fifty: normalizedQuantity };
    case 'joker_freeze':
      return { joker_freeze: normalizedQuantity };
    case 'joker_pass':
      return { joker_pass: normalizedQuantity };
    case 'streak_shield':
      return { streak_shield: normalizedQuantity };
    default:
      return {};
  }
};

const serializeWallet = (wallet: ProgressionWalletState): Record<string, unknown> => ({
  balance: wallet.balance,
  inventory: wallet.inventory,
  lifetimeEarned: wallet.lifetimeEarned,
  lifetimeSpent: wallet.lifetimeSpent,
  rewardedClaimsToday: wallet.rewardedClaimsToday,
  rewardedDate: wallet.rewardedDate,
  lastRewardedClaimAt: wallet.lastRewardedClaimAt,
  premiumStarterGrantedAt: wallet.premiumStarterGrantedAt,
  premiumStarterProductId: wallet.premiumStarterProductId,
  processedTopups: wallet.processedTopups,
  ownedAvatarIds: wallet.ownedAvatarIds,
});

const resolveRewardedMeta = (
  wallet: ProgressionWalletState,
  _isPremium: boolean,
  now = new Date()
): ProgressionWalletSnapshot['rewardedAd'] => {
  const todayKey = getTodayKey(now);
  const rewardedClaimsToday = wallet.rewardedDate === todayKey ? wallet.rewardedClaimsToday : 0;
  const remainingClaims = Math.max(0, REEL_REWARDED_AD_DAILY_LIMIT - rewardedClaimsToday);
  const lastClaimMs = wallet.lastRewardedClaimAt ? new Date(wallet.lastRewardedClaimAt).getTime() : Number.NaN;
  const cooldownMs =
    Number.isFinite(lastClaimMs)
      ? Math.max(0, lastClaimMs + REEL_REWARDED_AD_COOLDOWN_MINUTES * 60 * 1000 - now.getTime())
      : 0;
  const cooldownRemainingSeconds = Math.ceil(cooldownMs / 1000);
  return {
    available: remainingClaims > 0 && cooldownRemainingSeconds <= 0,
    remainingClaims,
    dailyLimit: REEL_REWARDED_AD_DAILY_LIMIT,
    rewardAmount: REEL_REWARDED_AD_AMOUNT,
    cooldownRemainingSeconds: Math.max(0, cooldownRemainingSeconds),
  };
};

export const toWalletSnapshot = (
  wallet: ProgressionWalletState,
  isPremium: boolean,
  now = new Date()
): ProgressionWalletSnapshot => ({
  balance: wallet.balance,
  inventory: wallet.inventory,
  lifetimeEarned: wallet.lifetimeEarned,
  lifetimeSpent: wallet.lifetimeSpent,
  premiumStarterGrantedAt: wallet.premiumStarterGrantedAt,
  rewardedAd: resolveRewardedMeta(wallet, isPremium, now),
  ownedAvatarIds: wallet.ownedAvatarIds,
  avatarPurchaseCost: AVATAR_PURCHASE_COST,
});

const toLoadedWalletProfile = (data: unknown): LoadedWalletProfile => {
  const profile = (data || null) as ProfileRow | null;
  const rawXpState = sanitizeRecord(profile?.xp_state);
  const xpState =
    hasStoredProfileXp(rawXpState) || hasProfileXpMirrorDrift(rawXpState)
      ? withMirroredProfileXp(rawXpState)
      : rawXpState;
  const wallet = normalizeWallet(xpState.wallet);
  return {
    profile,
    xpState,
    wallet,
  };
};

export const loadWalletProfile = async (
  input: LoadWalletProfileInput
): Promise<LoadedWalletProfile> => {
  assertAuthenticatedWalletOwner(input);
  const { data } = await input.supabase
    .from('profiles')
    .select(WALLET_PROFILE_COLUMNS)
    .eq('user_id', input.userId)
    .maybeSingle();

  return toLoadedWalletProfile(data);
};

const ensureWalletProfileExists = async (input: LoadWalletProfileInput): Promise<void> => {
  const nowIso = new Date().toISOString();
  const { error } = await input.supabase
    .from('profiles')
    .upsert(
      {
        user_id: input.userId,
        email: normalizeText(input.fallbackEmail, 240) || null,
        display_name: normalizeText(input.fallbackDisplayName, 160) || null,
        subscription_tier: 'free',
        xp_state: {
          wallet: serializeWallet(normalizeWallet(null)),
        },
        updated_at: nowIso,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      }
    );

  if (error) {
    throw new Error(error.message || 'Failed to initialize wallet profile.');
  }
};

const persistWalletProfileIfUnchanged = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  profile: ProfileRow;
  xpState: Record<string, unknown>;
  wallet: ProgressionWalletState;
}): Promise<LoadedWalletProfile | null> => {
  const baseXpState = hasStoredProfileXp(input.xpState) || hasProfileXpMirrorDrift(input.xpState)
    ? withMirroredProfileXp(input.xpState)
    : { ...input.xpState };
  const nextXpState = {
    ...baseXpState,
    wallet: serializeWallet(input.wallet),
  };
  const nowIso = new Date().toISOString();
  const { data, error } = await input.supabase
    .from('profiles')
    .update({
      email:
        normalizeText(input.profile.email, 240) ||
        normalizeText(input.fallbackEmail, 240) ||
        null,
      display_name:
        normalizeText(input.profile.display_name, 160) ||
        normalizeText(input.fallbackDisplayName, 160) ||
        null,
      subscription_tier: normalizeText(input.profile.subscription_tier, 40) || 'free',
      xp_state: nextXpState,
      updated_at: nowIso,
    })
    .eq('user_id', input.userId)
    .eq('updated_at', normalizeText(input.profile.updated_at, 80))
    .select(WALLET_PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to persist wallet profile.');
  }
  if (!data) {
    return null;
  }

  return toLoadedWalletProfile(data);
};

export const mutateWalletProfile = async <TResult, TReason extends string>(input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  authenticatedUserId?: string | null;
  maxRetries?: number;
  mutate: (loaded: LoadedWalletProfile) => Promise<WalletMutationAttempt<TResult, TReason>> | WalletMutationAttempt<TResult, TReason>;
}): Promise<WalletMutationResult<TResult, TReason>> => {
  assertAuthenticatedWalletOwner(input);
  const maxRetries = Math.max(1, input.maxRetries || WALLET_MUTATION_MAX_RETRIES);
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const loaded = await loadWalletProfile(input);
    if (!loaded.profile) {
      await ensureWalletProfileExists(input);
      continue;
    }

    const mutation = await input.mutate(loaded);
    if (!mutation.ok) {
      return {
        ok: false,
        profile: loaded.profile,
        xpState: loaded.xpState,
        wallet: loaded.wallet,
        reason: mutation.reason,
      };
    }

    const nextXpState = mutation.xpState || loaded.xpState;
    if (mutation.persist === false) {
      return {
        ok: true,
        profile: loaded.profile,
        xpState: nextXpState,
        wallet: mutation.wallet,
        result: mutation.result,
      };
    }

    const persisted = await persistWalletProfileIfUnchanged({
      supabase: input.supabase,
      userId: input.userId,
      fallbackEmail: input.fallbackEmail || null,
      fallbackDisplayName: input.fallbackDisplayName || null,
      profile: loaded.profile,
      xpState: nextXpState,
      wallet: mutation.wallet,
    });

    if (!persisted) {
      continue;
    }

    return {
      ok: true,
      profile: persisted.profile,
      xpState: persisted.xpState,
      wallet: persisted.wallet,
      result: mutation.result,
    };
  }

  throw new Error('Wallet update conflicted repeatedly. Please retry.');
};

export const persistWalletProfile = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  profile: ProfileRow | null;
  xpState: Record<string, unknown>;
  wallet: ProgressionWalletState;
}): Promise<void> => {
  const baseXpState = hasStoredProfileXp(input.xpState) || hasProfileXpMirrorDrift(input.xpState)
    ? withMirroredProfileXp(input.xpState)
    : { ...input.xpState };
  const nextXpState = {
    ...baseXpState,
    wallet: serializeWallet(input.wallet),
  };
  const { error } = await input.supabase
    .from('profiles')
    .upsert(
      {
        user_id: input.userId,
        email:
          normalizeText(input.profile?.email, 240) ||
          normalizeText(input.fallbackEmail, 240) ||
          null,
        display_name:
          normalizeText(input.profile?.display_name, 160) ||
          normalizeText(input.fallbackDisplayName, 160) ||
          null,
        subscription_tier: normalizeText(input.profile?.subscription_tier, 40) || 'free',
        xp_state: nextXpState,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    throw new Error(error.message || 'Failed to persist wallet profile.');
  }
};

export const grantStarterTicketsIfNeeded = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
}): Promise<{ granted: boolean; wallet: ProgressionWalletState }> => {
  const mutation = await mutateWalletProfile<{ granted: boolean }, never>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      if (!isStarterEligibleWallet(loaded.wallet)) {
        return {
          ok: true,
          wallet: loaded.wallet,
          result: { granted: false },
          persist: false,
        };
      }

      return {
        ok: true,
        wallet: {
          ...loaded.wallet,
          balance: loaded.wallet.balance + WALLET_STARTER_TICKETS,
          lifetimeEarned: loaded.wallet.lifetimeEarned + WALLET_STARTER_TICKETS,
        },
        result: { granted: true },
      };
    },
  });

  if (!mutation.ok) {
    throw new Error('Failed to seed starter tickets.');
  }

  if (mutation.result.granted) {
    await recordWalletLedgerEntry({
      supabase: input.supabase,
      userId: input.userId,
      source: 'starter_tickets',
      reason: 'starter_seed',
      delta: WALLET_STARTER_TICKETS,
      balanceAfter: mutation.wallet.balance,
      metadata: {
        starterTickets: WALLET_STARTER_TICKETS,
      },
      eventKey: 'starter_tickets',
    });
  }

  return {
    granted: mutation.result.granted,
    wallet: mutation.wallet,
  };
};

export const grantPremiumStarterBundle = async (input: {
  supabase: SupabaseClientLike;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  productId?: string | null;
}): Promise<{ granted: boolean; wallet: ProgressionWalletState }> => {
  const mutation = await mutateWalletProfile<{ granted: boolean }, never>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      if (loaded.wallet.premiumStarterGrantedAt) {
        return {
          ok: true,
          wallet: loaded.wallet,
          result: { granted: false },
          persist: false,
        };
      }

      return {
        ok: true,
        wallet: {
          ...loaded.wallet,
          inventory: mergeWalletInventory(loaded.wallet.inventory, PREMIUM_STARTER_BUNDLE),
          premiumStarterGrantedAt: new Date().toISOString(),
          premiumStarterProductId: normalizeText(input.productId, 120) || null,
        },
        result: { granted: true },
      };
    },
  });

  if (!mutation.ok) {
    throw new Error('Failed to grant premium starter bundle.');
  }

  if (mutation.result.granted) {
    await recordWalletLedgerEntry({
      supabase: input.supabase,
      userId: input.userId,
      source: 'premium_starter_bundle',
      sourceId: normalizeText(input.productId, 120) || null,
      reason: 'inventory_grant',
      delta: 0,
      balanceAfter: mutation.wallet.balance,
      metadata: {
        inventoryDelta: PREMIUM_STARTER_BUNDLE,
        productId: normalizeText(input.productId, 120) || null,
      },
      eventKey: 'premium_starter_bundle',
      allowZeroDelta: true,
    });
  }

  return {
    granted: mutation.result.granted,
    wallet: mutation.wallet,
  };
};

export const grantWalletTickets = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  amount: number;
  ledger?: {
    source?: string | null;
    sourceId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
    eventKey?: string | null;
  } | null;
}): Promise<{ granted: number; wallet: ProgressionWalletState }> => {
  const grantedAmount = Math.max(0, Math.floor(Number(input.amount) || 0));
  const mutation = await mutateWalletProfile<{ granted: number }, never>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      if (grantedAmount <= 0) {
        return {
          ok: true,
          wallet: loaded.wallet,
          result: { granted: 0 },
          persist: false,
        };
      }

      return {
        ok: true,
        wallet: {
          ...loaded.wallet,
          balance: loaded.wallet.balance + grantedAmount,
          lifetimeEarned: loaded.wallet.lifetimeEarned + grantedAmount,
        },
        result: { granted: grantedAmount },
      };
    },
  });

  if (!mutation.ok) {
    throw new Error('Failed to grant wallet tickets.');
  }

  if (mutation.result.granted > 0) {
    await recordWalletLedgerEntry({
      supabase: input.supabase,
      userId: input.userId,
      source: normalizeText(input.ledger?.source, 80) || 'wallet_grant',
      sourceId: normalizeText(input.ledger?.sourceId, 160) || null,
      reason: normalizeText(input.ledger?.reason, 160) || 'ticket_grant',
      delta: mutation.result.granted,
      balanceAfter: mutation.wallet.balance,
      metadata: {
        grantedTickets: mutation.result.granted,
        ...(input.ledger?.metadata || {}),
      },
      eventKey: normalizeText(input.ledger?.eventKey, 240) || null,
    });
  }

  return {
    granted: mutation.result.granted,
    wallet: mutation.wallet,
  };
};

export const claimRewardedReels = async (input: {
  supabase: SupabaseClientLike;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  isPremium: boolean;
}): Promise<
  | { ok: true; wallet: ProgressionWalletState; granted: number }
  | {
      ok: false;
      reason: 'daily_limit_reached' | 'cooldown_active';
      wallet: ProgressionWalletState;
    }
> => {
  const now = new Date();
  const todayKey = getTodayKey(now);
  const mutation = await mutateWalletProfile<number, 'daily_limit_reached' | 'cooldown_active'>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      const rewardedClaimsToday = loaded.wallet.rewardedDate === todayKey ? loaded.wallet.rewardedClaimsToday : 0;
      if (rewardedClaimsToday >= REEL_REWARDED_AD_DAILY_LIMIT) {
        return { ok: false, reason: 'daily_limit_reached' };
      }

      const lastClaimMs = loaded.wallet.lastRewardedClaimAt
        ? new Date(loaded.wallet.lastRewardedClaimAt).getTime()
        : Number.NaN;
      const cooldownUntil =
        Number.isFinite(lastClaimMs)
          ? lastClaimMs + REEL_REWARDED_AD_COOLDOWN_MINUTES * 60 * 1000
          : Number.NaN;
      if (Number.isFinite(cooldownUntil) && cooldownUntil > now.getTime()) {
        return { ok: false, reason: 'cooldown_active' };
      }

      return {
        ok: true,
        wallet: {
          ...loaded.wallet,
          balance: loaded.wallet.balance + REEL_REWARDED_AD_AMOUNT,
          lifetimeEarned: loaded.wallet.lifetimeEarned + REEL_REWARDED_AD_AMOUNT,
          rewardedClaimsToday: rewardedClaimsToday + 1,
          rewardedDate: todayKey,
          lastRewardedClaimAt: now.toISOString(),
        },
        result: REEL_REWARDED_AD_AMOUNT,
      };
    },
  });

  if (!mutation.ok) {
    return {
      ok: false,
      reason: mutation.reason,
      wallet: mutation.wallet,
    };
  }

  await recordWalletLedgerEntry({
    supabase: input.supabase,
    userId: input.userId,
    source: 'rewarded_ad',
    reason: 'claim_rewarded',
    delta: mutation.result,
    balanceAfter: mutation.wallet.balance,
    metadata: {
      rewardedClaimsToday: mutation.wallet.rewardedClaimsToday,
      rewardedDate: mutation.wallet.rewardedDate,
      lastRewardedClaimAt: mutation.wallet.lastRewardedClaimAt,
    },
    eventKey: mutation.wallet.lastRewardedClaimAt
      ? `rewarded_ad:${mutation.wallet.lastRewardedClaimAt}`
      : null,
  });

  return {
    ok: true,
    wallet: mutation.wallet,
    granted: mutation.result,
  };
};

export const purchaseWalletStoreItem = async (input: {
  supabase: SupabaseClientLike;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  itemKey: string;
}): Promise<
  | { ok: true; wallet: ProgressionWalletState; cost: number }
  | {
      ok: false;
      reason: 'invalid_item' | 'insufficient_balance';
      wallet: ProgressionWalletState;
    }
> => {
  const mutation = await mutateWalletProfile<number, 'invalid_item' | 'insufficient_balance'>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      const item = findWalletStoreItem(input.itemKey);
      if (!item) {
        return { ok: false, reason: 'invalid_item' };
      }
      if (loaded.wallet.balance < item.reelCost) {
        return { ok: false, reason: 'insufficient_balance' };
      }

      return {
        ok: true,
        wallet: {
          ...loaded.wallet,
          balance: loaded.wallet.balance - item.reelCost,
          lifetimeSpent: loaded.wallet.lifetimeSpent + item.reelCost,
          inventory: {
            ...loaded.wallet.inventory,
            [item.inventoryKey]: loaded.wallet.inventory[item.inventoryKey] + item.quantity,
          } as WalletInventory,
        },
        result: item.reelCost,
      };
    },
  });

  if (!mutation.ok) {
    return {
      ok: false,
      reason: mutation.reason,
      wallet: mutation.wallet,
    };
  }

  const purchasedItem = findWalletStoreItem(input.itemKey);
  await recordWalletLedgerEntry({
    supabase: input.supabase,
    userId: input.userId,
    source: 'wallet_store_purchase',
    sourceId: normalizeText(input.itemKey, 80) || null,
    reason: 'spend_item',
    delta: -mutation.result,
    balanceAfter: mutation.wallet.balance,
    metadata: {
      itemKey: normalizeText(input.itemKey, 80) || null,
      inventoryKey: purchasedItem?.inventoryKey || null,
      quantity: purchasedItem?.quantity || null,
      cost: mutation.result,
    },
  });

  return {
    ok: true,
    wallet: mutation.wallet,
    cost: mutation.result,
  };
};

export const consumeWalletInventoryItem = async (input: {
  supabase: SupabaseClientLike;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  itemKey: string;
}): Promise<
  | { ok: true; wallet: ProgressionWalletState }
  | {
      ok: false;
      reason: 'invalid_item' | 'inventory_empty';
      wallet: ProgressionWalletState;
    }
> => {
  const row = await callWalletMutationRpc(input, {
    p_action: 'consume_item',
    p_user_id: input.userId,
    p_email: normalizeText(input.fallbackEmail, 240) || null,
    p_display_name: normalizeText(input.fallbackDisplayName, 160) || null,
    p_item_key: normalizeText(input.itemKey, 80),
  });

  const wallet = normalizeWallet(row.wallet);
  const reason = normalizeText(row.reason, 80) as 'invalid_item' | 'inventory_empty' | '';
  if (row.ok !== true) {
    return {
      ok: false,
      reason: reason || 'invalid_item',
      wallet,
    };
  }

  await recordWalletLedgerEntry({
    supabase: input.supabase,
    userId: input.userId,
    source: 'wallet_inventory_consume',
    sourceId: normalizeText(input.itemKey, 80) || null,
    reason: 'consume_item',
    delta: 0,
    balanceAfter: wallet.balance,
    metadata: {
      itemKey: normalizeText(input.itemKey, 80) || null,
      inventoryDelta: buildInventoryDelta(input.itemKey, -1),
    },
    allowZeroDelta: true,
  });

  return { ok: true, wallet };
};

export const grantTopupPack = async (input: {
  supabase: SupabaseClientLike;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  productId: string;
  provider: 'apple' | 'google';
  transactionRef: string;
  purchaseDate?: string | null;
  verificationKind?: string | null;
  purchaseTokenHash?: string | null;
  transactionId?: string | null;
}): Promise<
  | { ok: true; wallet: ProgressionWalletState; reels: number }
  | {
      ok: false;
      reason: 'invalid_product' | 'duplicate_transaction';
      wallet: ProgressionWalletState;
    }
> => {
  const row = await callWalletMutationRpc(input, {
    p_action: 'grant_topup',
    p_user_id: input.userId,
    p_email: normalizeText(input.fallbackEmail, 240) || null,
    p_display_name: normalizeText(input.fallbackDisplayName, 160) || null,
    p_product_id: normalizeText(input.productId, 160),
    p_provider: input.provider,
    p_transaction_ref: normalizeText(input.transactionRef, 240),
    p_purchase_date: normalizeText(input.purchaseDate, 80) || null,
    p_verification_kind: normalizeText(input.verificationKind, 80) || null,
    p_purchase_token_hash: normalizeText(input.purchaseTokenHash, 80) || null,
    p_transaction_id: normalizeText(input.transactionId, 240) || null,
  });

  const wallet = normalizeWallet(row.wallet);
  const reason = normalizeText(row.reason, 80) as 'invalid_product' | 'duplicate_transaction' | '';
  if (row.ok !== true) {
    return {
      ok: false,
      reason: reason || 'invalid_product',
      wallet,
    };
  }

  await recordWalletLedgerEntry({
    supabase: input.supabase,
    userId: input.userId,
    source: 'wallet_topup',
    sourceId: normalizeText(input.transactionRef, 240) || null,
    reason: 'grant_topup',
    delta: Math.max(0, Number(row.reels) || 0),
    balanceAfter: wallet.balance,
    metadata: {
      productId: normalizeText(input.productId, 160) || null,
      provider: normalizeText(input.provider, 20) || null,
      verificationKind: normalizeText(input.verificationKind, 80) || null,
      purchaseDate: normalizeText(input.purchaseDate, 80) || null,
      transactionId: normalizeText(input.transactionId, 240) || null,
    },
    eventKey: normalizeText(input.transactionRef, 240) || null,
  });

  return {
    ok: true,
    wallet,
    reels: Math.max(0, Number(row.reels) || 0),
  };
};

export const buyAvatar = async (input: {
  supabase: SupabaseClientLike;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  fallbackEmail?: string | null;
  fallbackDisplayName?: string | null;
  avatarId: string;
}): Promise<
  | { ok: true; wallet: ProgressionWalletState; cost: number; alreadyOwned: boolean }
  | { ok: false; reason: 'insufficient_balance' | 'invalid_avatar'; wallet: ProgressionWalletState }
> => {
  const avatarId = normalizeText(input.avatarId, 80);
  if (!avatarId) {
    const emptyWallet = normalizeWallet(null);
    return { ok: false, reason: 'invalid_avatar', wallet: emptyWallet };
  }

  const mutation = await mutateWalletProfile<{ cost: number; alreadyOwned: boolean }, 'insufficient_balance'>({
    supabase: input.supabase,
    userId: input.userId,
    fallbackEmail: input.fallbackEmail || null,
    fallbackDisplayName: input.fallbackDisplayName || null,
    mutate: (loaded) => {
      if (loaded.wallet.ownedAvatarIds.includes(avatarId)) {
        return {
          ok: true,
          wallet: loaded.wallet,
          result: { cost: 0, alreadyOwned: true },
          persist: false,
        };
      }
      if (loaded.wallet.balance < AVATAR_PURCHASE_COST) {
        return { ok: false, reason: 'insufficient_balance' };
      }
      return {
        ok: true,
        wallet: {
          ...loaded.wallet,
          balance: loaded.wallet.balance - AVATAR_PURCHASE_COST,
          lifetimeSpent: loaded.wallet.lifetimeSpent + AVATAR_PURCHASE_COST,
          ownedAvatarIds: [...loaded.wallet.ownedAvatarIds, avatarId],
        },
        result: { cost: AVATAR_PURCHASE_COST, alreadyOwned: false },
      };
    },
  });

  if (!mutation.ok) {
    return { ok: false, reason: mutation.reason, wallet: mutation.wallet };
  }

  if (!mutation.result.alreadyOwned) {
    await recordWalletLedgerEntry({
      supabase: input.supabase,
      userId: input.userId,
      source: 'avatar_purchase',
      sourceId: avatarId,
      reason: 'spend_avatar',
      delta: -AVATAR_PURCHASE_COST,
      balanceAfter: mutation.wallet.balance,
      metadata: { avatarId, cost: AVATAR_PURCHASE_COST },
    });
  }

  return {
    ok: true,
    wallet: mutation.wallet,
    cost: mutation.result.cost,
    alreadyOwned: mutation.result.alreadyOwned,
  };
};
