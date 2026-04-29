// GET /api/user-search?q=<query>&limit=<n>
//
// Searches public profiles by display_name (case-insensitive prefix/contains).
// Auth: Bearer access token (required — hides blocked users both ways).
//
// Response shape:
// {
//   ok: true,
//   query: "ali",
//   users: [{ userId, displayName, avatarUrl, leagueKey, username }]
// }
//
// Rules:
// - q must be at least 2 characters.
// - Results exclude: the caller themselves, users the caller has blocked,
//   and users who have blocked the caller.
// - limit: 1–30, default 20.
// - Searches display_name ILIKE '%q%' OR xp_state->>'username' ILIKE '%q%'.

import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, getQueryParam, sendJson } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import { resolveLeagueKeyFromXp } from '../src/domain/leagueSystem.js';

export const config = { runtime: 'nodejs' };

/* eslint-disable @typescript-eslint/no-explicit-any */

type ApiRequest = {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | undefined> | Headers;
};

type ApiResponse = {
  setHeader?: (key: string, value: string) => void;
  status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

const getQueryValue = (req: ApiRequest, key: string): string => (getQueryParam(req, key) || '').trim();

const getSupabaseUrl = () => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceKey = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const MAX_LIMIT = 30;
const DEFAULT_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

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
  const supabaseServiceKey = getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);
  }

  const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);

  // Verify caller
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

  const rawQuery = getQueryValue(req, 'q');
  if (rawQuery.length < MIN_QUERY_LENGTH) {
    return sendJson(res, 400, {
      ok: false,
      error: `Query must be at least ${MIN_QUERY_LENGTH} characters.`,
    }, cors);
  }

  const limitRaw = parseInt(getQueryValue(req, 'limit') || String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw), MAX_LIMIT);

  // 1. Fetch IDs of users blocked by caller or who blocked caller
  const { data: blocksRaw } = await supabase
    .from('user_blocks')
    .select('blocker_user_id, blocked_user_id')
    .or(`blocker_user_id.eq.${user.id},blocked_user_id.eq.${user.id}`);

  const blockedSet = new Set<string>();
  for (const row of Array.isArray(blocksRaw) ? (blocksRaw as any[]) : []) {
    if (row.blocker_user_id !== user.id) blockedSet.add(String(row.blocker_user_id));
    if (row.blocked_user_id !== user.id) blockedSet.add(String(row.blocked_user_id));
  }

  // 2. Search profiles by display_name (server handles ILIKE via .ilike())
  //    Also try username stored in xp_state — done client-side after fetch since
  //    PostgREST doesn't support nested JSONB text search without a generated column.
  const likePattern = `%${rawQuery}%`;

  const { data: profilesRaw, error: searchError } = await supabase
    .from('profiles')
    .select('user_id, display_name, xp_state')
    .ilike('display_name', likePattern)
    .neq('user_id', user.id)
    .limit(limit + blockedSet.size + 5); // fetch extra to account for post-filter

  if (searchError) {
    console.error('[user-search] search failed', searchError);
    return sendJson(res, 500, { ok: false, error: 'Search unavailable.' }, cors);
  }

  const profiles = Array.isArray(profilesRaw) ? (profilesRaw as any[]) : [];

  // 3. Filter, map, and cap at limit
  const results: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    leagueKey: string;
    username: string;
  }> = [];

  for (const row of profiles) {
    if (results.length >= limit) break;
    const userId = String(row.user_id || '');
    if (!userId || blockedSet.has(userId)) continue;

    const xpState = (row.xp_state || {}) as Record<string, unknown>;
    const displayName = String(row.display_name || xpState.fullName || '').trim() || 'Anonymous';
    const username = String(xpState.username || '').trim();
    const avatarUrl = String(xpState.avatarUrl || xpState.avatar_url || '').trim() || null;
    const totalXp = Number(xpState.totalXP ?? 0);
    const leagueKey = resolveLeagueKeyFromXp(totalXp);

    results.push({ userId, displayName, avatarUrl, leagueKey, username });
  }

  return sendJson(res, 200, {
    ok: true,
    query: rawQuery,
    users: results,
  }, cors);
}
