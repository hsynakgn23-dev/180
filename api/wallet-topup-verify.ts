import { createCorsHeaders } from './lib/cors.js';
import { grantTopupPack, toWalletSnapshot } from './lib/progressionWallet.js';
import { verifyWalletTopupPurchase } from './lib/storePurchaseVerification.js';
import { resolveSubscriptionEntitlement } from './lib/subscriptionAccess.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | undefined> | Headers;
  on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
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

const parseBody = async (req: ApiRequest): Promise<unknown> => {
  if (req.body !== undefined) return req.body;
  if (typeof req.on !== 'function') return null;
  const chunks: string[] = [];
  await new Promise<void>((resolve) => {
    req.on?.('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    });
    req.on?.('end', () => resolve());
  });
  const raw = chunks.join('').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('user_id', user.id)
    .maybeSingle();

  const entitlement = resolveSubscriptionEntitlement({
    subscriptionPlan: subscription?.plan,
    subscriptionStatus: subscription?.status,
    profileTier: profile?.subscription_tier,
  });

  const body = await parseBody(req);
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const provider = String(payload.provider || '').trim();
  const receipt = String(payload.receipt || payload.receiptData || '').trim();
  const productId = String(payload.productId || '').trim();

  if (!['apple', 'google'].includes(provider)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid provider.' }, cors);
  }

  if (!receipt || !productId) {
    return sendJson(res, 400, { ok: false, error: 'Missing receipt data.' }, cors);
  }

  const verification = await verifyWalletTopupPurchase({
    provider,
    productId,
    receipt,
    purchaseToken: String(payload.purchaseToken || '').trim() || null,
    transactionId: String(payload.transactionId || '').trim() || null,
    appBundleIdIOS: String(payload.appBundleIdIOS || '').trim() || null,
    originalTransactionIdentifierIOS:
      String(payload.originalTransactionIdentifierIOS || '').trim() || null,
    packageNameAndroid: String(payload.packageNameAndroid || '').trim() || null,
    purchaseState: payload.purchaseState,
    signatureAndroid: String(payload.signatureAndroid || '').trim() || null,
    store: String(payload.store || '').trim() || null,
    platform: String(payload.platform || '').trim() || null,
  });

  if (!verification.ok) {
    return sendJson(res, 400, { ok: false, error: verification.error }, cors);
  }

  const result = await grantTopupPack({
    supabase,
    supabaseUrl,
    supabaseServiceRoleKey: supabaseServiceKey,
    userId: user.id,
    fallbackEmail: user.email || null,
    fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
    productId,
    provider: verification.provider,
    transactionRef: verification.transactionRef,
    purchaseDate: verification.purchaseDate,
    verificationKind: verification.verificationKind,
    purchaseTokenHash: verification.metadata.purchaseTokenHash,
    transactionId: verification.metadata.transactionId,
  });

  if (!result.ok) {
    const error =
      result.reason === 'duplicate_transaction'
        ? 'This purchase was already credited.'
        : 'Unknown productId.';
    return sendJson(res, 400, { ok: false, error }, cors);
  }

  return sendJson(res, 200, {
    ok: true,
    productId,
    provider,
    grantedReels: result.reels,
    verificationKind: verification.verificationKind,
    wallet: toWalletSnapshot(result.wallet, entitlement.isPremium),
  }, cors);
}
