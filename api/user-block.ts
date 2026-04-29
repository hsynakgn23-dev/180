// POST /api/user-block
//
// Blocks or unblocks a user. Idempotent in both directions.
// Auth: Bearer access token.
//
// Body: { targetUserId: string, action: "block" | "unblock" }
//
// Response shape:
// { ok: true, action: "block" | "unblock", targetUserId: string, isBlocked: boolean }
//
// Side effects on block:
//   - Inserts row in user_blocks (no-op if already exists).
//   - Deletes mutual follow relationship (user_follows) in both directions.
//
// Side effects on unblock:
//   - Removes row from user_blocks (no-op if not present).

import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson, toObject } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

/* eslint-disable @typescript-eslint/no-explicit-any */

type ApiRequest = {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | undefined> | Headers;
  on?: (event: string, cb: (chunk: Buffer | string) => void) => void;
};

type ApiResponse = {
  setHeader?: (k: string, v: string) => void;
  status?: (code: number) => { json: (p: Record<string, unknown>) => unknown };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getSupabaseUrl = () => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceKey = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

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
  const supabaseServiceKey = getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);
  }

  const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

  const body = toObject(await parseBody(req)) || {};
  const targetUserId = String(body.targetUserId || '').trim();
  const action = String(body.action || '').trim().toLowerCase();

  if (!UUID_RE.test(targetUserId)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid targetUserId.' }, cors);
  }
  if (targetUserId === user.id) {
    return sendJson(res, 400, { ok: false, error: 'Cannot block yourself.' }, cors);
  }
  if (action !== 'block' && action !== 'unblock') {
    return sendJson(res, 400, { ok: false, error: 'action must be "block" or "unblock".' }, cors);
  }

  if (action === 'block') {
    // Upsert block row (idempotent)
    const { error: blockError } = await supabase
      .from('user_blocks')
      .upsert(
        { blocker_user_id: user.id, blocked_user_id: targetUserId },
        { onConflict: 'blocker_user_id,blocked_user_id', ignoreDuplicates: true }
      );

    if (blockError) {
      console.error('[user-block] upsert failed', blockError);
      return sendJson(res, 500, { ok: false, error: 'Block failed.' }, cors);
    }

    // Remove mutual follows (best-effort fire-and-forget)
    void (async () => {
      try {
        await supabase
          .from('user_follows')
          .delete()
          .or(
            `and(follower_user_id.eq.${user.id},followed_user_id.eq.${targetUserId}),` +
            `and(follower_user_id.eq.${targetUserId},followed_user_id.eq.${user.id})`
          );
      } catch (err: any) {
        console.warn('[user-block] follow cleanup failed', err?.message);
      }
    })();

    return sendJson(res, 200, { ok: true, action: 'block', targetUserId, isBlocked: true }, cors);
  }

  // action === 'unblock'
  const { error: unblockError } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_user_id', user.id)
    .eq('blocked_user_id', targetUserId);

  if (unblockError) {
    console.error('[user-block] delete failed', unblockError);
    return sendJson(res, 500, { ok: false, error: 'Unblock failed.' }, cors);
  }

  return sendJson(res, 200, { ok: true, action: 'unblock', targetUserId, isBlocked: false }, cors);
}
