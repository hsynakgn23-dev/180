import { createCorsHeaders } from './lib/cors.js';
import { grantPremiumStarterBundle } from './lib/progressionWallet.js';
import { verifySubscriptionPurchase } from './lib/subscriptionPurchaseVerification.js';
import {
    type SubscriptionPlan,
    type SubscriptionTier,
} from './lib/subscriptionAccess.js';
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
        headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
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
    try { return JSON.parse(raw); } catch { return null; }
};

const getSupabaseUrl = (): string =>
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const PRODUCT_ACCESS: Record<string, {
    plan: SubscriptionPlan;
    tier: SubscriptionTier;
    durationDays: number | null;
}> = {
    'com.absolutecinema.premium.monthly': {
        plan: 'monthly',
        tier: 'premium',
        durationDays: 30,
    },
    'com.absolutecinema.premium.annual': {
        plan: 'annual',
        tier: 'premium',
        durationDays: 365,
    },
    'com.absolutecinema.premium.supporter': {
        plan: 'supporter',
        tier: 'supporter',
        durationDays: null,
    },
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const cors = createCorsHeaders(req, {
        headers: 'authorization, content-type, apikey, x-client-info',
        methods: 'POST, OPTIONS'
    });

    if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

    const accessToken = getBearerToken(req);
    if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !supabaseServiceKey) return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

    const body = await parseBody(req);
    const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
    const provider = String(bodyObj.provider || '').trim();
    const receipt = String(bodyObj.receipt || bodyObj.receiptData || '').trim();
    const productId = String(bodyObj.productId || '').trim();

    if (!['stripe', 'apple', 'google'].includes(provider)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid provider. Must be "stripe", "apple", or "google".' }, cors);
    }

    if (!receipt) {
        return sendJson(res, 400, { ok: false, error: 'Missing receipt data.' }, cors);
    }

    const access = PRODUCT_ACCESS[productId];
    if (!access) {
        return sendJson(res, 400, { ok: false, error: 'Unknown productId.' }, cors);
    }

    const verification = await verifySubscriptionPurchase({
        provider,
        productId,
        plan: access.plan,
        receipt,
        purchaseToken: String(bodyObj.purchaseToken || '').trim() || null,
        transactionId: String(bodyObj.transactionId || '').trim() || null,
        userId: user.id,
    });

    if (!verification.ok) {
        return sendJson(res, verification.status, { ok: false, error: verification.error }, cors);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const verifiedExpiresAt = verification.expiresAt;
    if (access.durationDays !== null && !verifiedExpiresAt) {
        return sendJson(res, 400, { ok: false, error: 'Subscription expiry could not be verified.' }, cors);
    }

    const { data: ownershipRows, error: ownershipError } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('provider', verification.provider)
        .eq('provider_subscription_id', verification.providerSubscriptionId)
        .neq('user_id', user.id)
        .limit(1);

    if (ownershipError) {
        return sendJson(res, 500, { ok: false, error: 'Failed to validate purchase ownership.' }, cors);
    }

    if (Array.isArray(ownershipRows) && ownershipRows.length > 0) {
        return sendJson(res, 409, { ok: false, error: 'This purchase is already linked to another account.' }, cors);
    }

    // Upsert subscription
    const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
            user_id: user.id,
            plan: access.plan,
            provider: verification.provider,
            provider_subscription_id: verification.providerSubscriptionId.slice(0, 255),
            starts_at: verification.purchaseDate || nowIso,
            expires_at: verifiedExpiresAt,
            status: 'active',
            metadata: {
                productId,
                tier: access.tier,
                verifiedAt: nowIso,
                verificationKind: verification.verificationKind,
                transactionRef: verification.transactionRef,
                providerSubscriptionId: verification.providerSubscriptionId,
                purchaseDate: verification.purchaseDate,
                expiresAt: verifiedExpiresAt,
                ...verification.metadata,
            },
            updated_at: nowIso
        }, { onConflict: 'user_id' });

    if (subError) {
        return sendJson(res, 500, { ok: false, error: 'Failed to save subscription.' }, cors);
    }

    // Update profile tier
    await supabase
        .from('profiles')
        .update({
            subscription_tier: access.tier,
            updated_at: nowIso
        })
        .eq('user_id', user.id);

    const starterBundleResult =
        access.tier !== 'free'
            ? await grantPremiumStarterBundle({
                supabase,
                supabaseUrl,
                supabaseServiceRoleKey: supabaseServiceKey,
                userId: user.id,
                fallbackEmail: user.email || null,
                fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
                productId,
            }).catch(() => ({ granted: false, wallet: null }))
            : { granted: false, wallet: null };

    return sendJson(res, 200, {
        ok: true,
        tier: access.tier,
        plan: access.plan,
        isPremium: access.tier !== 'free',
        provider: verification.provider,
        expiresAt: verifiedExpiresAt,
        verificationKind: verification.verificationKind,
        starterBundleGranted: starterBundleResult.granted,
        starterBundleInventory: starterBundleResult.wallet?.inventory || null,
        message: access.plan === 'supporter'
            ? 'Supporter access activated successfully.'
            : 'Subscription activated successfully.'
    }, cors);
}
