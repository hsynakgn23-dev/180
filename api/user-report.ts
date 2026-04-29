// POST /api/user-report
//
// Files a content or user report. At least one of targetUserId, ritualId, or
// replyId must be supplied. One report per reporter per target per 24 h (soft
// limit enforced server-side to prevent spam; returns 409 if already filed).
//
// Auth: Bearer access token.
//
// Body:
// {
//   targetUserId?: string,  // user being reported
//   ritualId?:    string,  // specific comment (ritual) being reported
//   replyId?:     string,  // specific reply being reported
//   reasonCode:   string,  // e.g. "spam", "harassment", "inappropriate", "other"
//   details?:     string   // optional free-text (max 500 chars)
// }
//
// Response:
// { ok: true, reportId: string }

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

const VALID_REASON_CODES = new Set([
  'spam',
  'harassment',
  'inappropriate',
  'hate_speech',
  'misinformation',
  'other',
]);

const getSupabaseUrl = () => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceKey = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// 24-hour dedup window — one report per reporter per (target_user|ritual|reply) per day
const DEDUP_WINDOW_HOURS = 24;

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

  const targetUserId  = UUID_RE.test(String(body.targetUserId || ''))  ? String(body.targetUserId) : null;
  const ritualId      = UUID_RE.test(String(body.ritualId || ''))      ? String(body.ritualId)     : null;
  const replyId       = UUID_RE.test(String(body.replyId || ''))       ? String(body.replyId)      : null;
  const reasonCode    = String(body.reasonCode || '').trim().toLowerCase();
  const details       = String(body.details || '').trim().slice(0, 500) || null;

  // At least one target required
  if (!targetUserId && !ritualId && !replyId) {
    return sendJson(res, 400, {
      ok: false,
      error: 'At least one of targetUserId, ritualId, or replyId is required.',
    }, cors);
  }

  // Cannot report yourself
  if (targetUserId === user.id) {
    return sendJson(res, 400, { ok: false, error: 'Cannot report yourself.' }, cors);
  }

  if (!VALID_REASON_CODES.has(reasonCode)) {
    return sendJson(res, 400, {
      ok: false,
      error: `Invalid reasonCode. Allowed: ${[...VALID_REASON_CODES].join(', ')}.`,
    }, cors);
  }

  // 24-hour dedup check — build a filter matching any of the provided targets
  const dedupWindowStart = new Date(
    Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  let dedupQuery = supabase
    .from('content_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_user_id', user.id)
    .gte('created_at', dedupWindowStart);

  if (targetUserId) dedupQuery = dedupQuery.eq('target_user_id', targetUserId);
  else if (ritualId) dedupQuery = dedupQuery.eq('ritual_id', ritualId);
  else if (replyId)  dedupQuery = dedupQuery.eq('reply_id', replyId);

  const { count: recentCount } = await dedupQuery;
  if ((recentCount ?? 0) > 0) {
    return sendJson(res, 409, {
      ok: false,
      error: 'You have already reported this content in the last 24 hours.',
    }, cors);
  }

  // Insert report
  const { data: insertedRaw, error: insertError } = await supabase
    .from('content_reports')
    .insert({
      reporter_user_id: user.id,
      target_user_id:   targetUserId,
      ritual_id:        ritualId,
      reply_id:         replyId,
      reason_code:      reasonCode,
      details,
      status:           'pending',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[user-report] insert failed', insertError);
    return sendJson(res, 500, { ok: false, error: 'Report submission failed.' }, cors);
  }

  const reportId = String((insertedRaw as any)?.id || '');
  return sendJson(res, 200, { ok: true, reportId }, cors);
}
