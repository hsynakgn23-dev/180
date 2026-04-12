import { createCorsHeaders } from './lib/cors.js';
import { claimRewardedReels, loadWalletProfile, toWalletSnapshot } from './lib/progressionWallet.js';
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

const sendJson = (
  res: ApiResponse,
  status: number,
  payload: Record<string, unknown>,
  headers: Record<string, string> = {}
) => {
  if (res && typeof res.setHeader === 'function') {
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  }
  if (res && typeof res.status === 'function') return res.status(status).json(payload);
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
};

const getHeader = (req: ApiRequest, key: string): string => {
  const headers = req.headers;
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') return ((headers as Headers).get(key) || '').trim();
  const obj = headers as Record<string, string | undefined>;
  return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
  const authHeader = getHeader(req, 'authorization');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() || null : null;
};

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const cors = createCorsHeaders(req, {
    headers: 'authorization, content-type, apikey, x-client-info',
    methods: 'POST, OPTIONS',
  });

  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

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
    .select('plan, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const loaded = await loadWalletProfile({
    supabase,
    userId: user.id,
    fallbackEmail: user.email || null,
    fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
  });

  const entitlement = resolveSubscriptionEntitlement({
    subscriptionPlan: subscription?.plan,
    subscriptionStatus: subscription?.status,
    profileTier: loaded.profile?.subscription_tier,
  });

  const result = await claimRewardedReels({
    supabase,
    supabaseUrl,
    supabaseServiceRoleKey: supabaseServiceKey,
    userId: user.id,
    fallbackEmail: user.email || null,
    fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
    isPremium: entitlement.isPremium,
  });

  if (!result.ok) {
    return sendJson(res, 400, {
      ok: false,
      reason: result.reason,
      error:
        result.reason === 'premium_blocked'
          ? 'Rewarded Ticket claims are disabled for premium users.'
          : result.reason === 'daily_limit_reached'
            ? 'Daily rewarded Ticket limit reached.'
            : 'Rewarded Ticket cooldown is still active.',
      wallet: toWalletSnapshot(result.wallet, entitlement.isPremium),
    }, cors);
  }

  return sendJson(res, 200, {
    ok: true,
    granted: result.granted,
    wallet: toWalletSnapshot(result.wallet, entitlement.isPremium),
  }, cors);
}
