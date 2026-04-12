export type SubscriptionPlan = 'free' | 'premium' | 'monthly' | 'annual' | 'supporter';
export type SubscriptionTier = 'free' | 'premium' | 'supporter';

const normalizeText = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

export const normalizeSubscriptionPlan = (value: unknown): SubscriptionPlan | null => {
  const normalized = normalizeText(value);
  if (
    normalized === 'free' ||
    normalized === 'premium' ||
    normalized === 'monthly' ||
    normalized === 'annual' ||
    normalized === 'supporter'
  ) {
    return normalized;
  }
  return null;
};

export const normalizeSubscriptionTier = (value: unknown): SubscriptionTier => {
  const normalized = normalizeText(value);
  if (normalized === 'supporter') return 'supporter';
  if (normalized === 'premium') return 'premium';
  return 'free';
};

export const isPremiumTier = (value: unknown): boolean =>
  normalizeSubscriptionTier(value) !== 'free';

const mergeTier = (current: SubscriptionTier, next: SubscriptionTier): SubscriptionTier => {
  if (current === 'supporter' || next === 'supporter') return 'supporter';
  if (current === 'premium' || next === 'premium') return 'premium';
  return 'free';
};

const inferTierFromPlan = (plan: SubscriptionPlan | null, status: unknown): SubscriptionTier => {
  const normalizedStatus = normalizeText(status);
  if (normalizedStatus !== 'active') return 'free';
  if (plan === 'supporter') return 'supporter';
  if (plan === 'monthly' || plan === 'annual' || plan === 'premium') return 'premium';
  return 'free';
};

export const resolveSubscriptionEntitlement = ({
  subscriptionPlan,
  subscriptionStatus,
  profileTier,
}: {
  subscriptionPlan: unknown;
  subscriptionStatus: unknown;
  profileTier: unknown;
}) => {
  const normalizedPlan = normalizeSubscriptionPlan(subscriptionPlan);
  const normalizedProfileTier = normalizeSubscriptionTier(profileTier);
  const subscriptionTier = inferTierFromPlan(normalizedPlan, subscriptionStatus);
  const tier = mergeTier(normalizedProfileTier, subscriptionTier);

  return {
    plan: normalizedPlan,
    tier,
    isPremium: tier !== 'free',
    isSupporter: tier === 'supporter',
  };
};
