import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, sendJson } from './lib/httpHelpers.js';
import { resolveSubscriptionEntitlement } from './lib/subscriptionAccess.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | undefined> | Headers;
};

type ApiResponse = {
  setHeader?: (key: string, value: string) => void;
  status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const cors = createCorsHeaders(req, {
    headers: 'authorization, content-type, apikey, x-client-info',
    methods: 'GET, OPTIONS',
  });

  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

  const accessToken = getBearerToken(req);
  if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);
  }

  const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, provider, status, starts_at, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, last_ad_shown_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const [{ data: dailyRush15Count }, { data: dailyRush30Count }] = await Promise.all([
    supabase.rpc('get_daily_rush_count_by_mode', { p_user_id: user.id, p_mode: 'rush_15' }),
    supabase.rpc('get_daily_rush_count_by_mode', { p_user_id: user.id, p_mode: 'rush_30' }),
  ]);

  const entitlement = resolveSubscriptionEntitlement({
    subscriptionPlan: subscription?.plan,
    subscriptionStatus: subscription?.status,
    profileTier: profile?.subscription_tier,
  });
  const tier = entitlement.tier;
  const isPremium = entitlement.isPremium;
  const dailyRushLimit = isPremium ? null : 3;
  const dailyRush15Used = Number(dailyRush15Count) || 0;
  const dailyRush30Used = Number(dailyRush30Count) || 0;
  const showAds = !isPremium;

  return sendJson(res, 200, {
    ok: true,
    tier,
    isPremium,
    show_ads: showAds,
    daily_rush_limit: dailyRushLimit,
    daily_rush_used: dailyRush15Used + dailyRush30Used,
    daily_rush_15_limit: dailyRushLimit,
    daily_rush_15_used: dailyRush15Used,
    daily_rush_30_limit: dailyRushLimit,
    daily_rush_30_used: dailyRush30Used,
    subscription: subscription
      ? {
          plan: subscription.plan,
          tier,
          provider: subscription.provider,
          status: subscription.status,
          startsAt: subscription.starts_at,
          expiresAt: subscription.expires_at,
        }
      : null,
    limits: {
      dailyRush15Used,
      dailyRush15Limit: dailyRushLimit,
      dailyRush30Used,
      dailyRush30Limit: dailyRushLimit,
      endlessMode: isPremium,
      adsEnabled: showAds,
    },
    features: {
      adFree: isPremium,
      unlimitedQuizzes: isPremium,
      profileBadge: isPremium,
      profileCustomization: isPremium,
      appCustomization: isPremium,
    },
    lastAdShownAt: profile?.last_ad_shown_at || null,
  }, cors);
}
