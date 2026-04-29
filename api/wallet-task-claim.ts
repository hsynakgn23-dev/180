import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
import { claimWalletDailyTask } from './lib/progressionDailyTasks.js';
import { toWalletSnapshot } from './lib/progressionWallet.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import { isWalletDailyTaskKey } from '../src/domain/walletDailyTasks.js';

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

  const body = await parseBody(req);
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const taskKey = String(payload.taskKey || payload.task_key || '').trim();
  if (!isWalletDailyTaskKey(taskKey)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid daily task.' }, cors);
  }

  const result = await claimWalletDailyTask({
    supabase,
    userId: user.id,
    fallbackEmail: user.email || null,
    fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
    taskKey,
  });

  if (!result.ok) {
    return sendJson(res, 409, {
      ok: false,
      reason: result.reason,
      error:
        result.reason === 'already_claimed'
          ? 'Daily task was already claimed.'
          : 'Daily task is not ready yet.',
      wallet: {
        ...toWalletSnapshot(result.wallet, false),
        dailyTasks: result.dailyTasks,
      },
    }, cors);
  }

  return sendJson(res, 200, {
    ok: true,
    taskKey,
    granted: result.granted,
    wallet: {
      ...toWalletSnapshot(result.wallet, false),
      dailyTasks: result.dailyTasks,
    },
  }, cors);
}
