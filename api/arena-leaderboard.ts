// GET /api/arena-leaderboard
//
// Returns the top N users in the caller's weekly arena cohort for either
// the current ISO week (default) or a specified past week. The caller's own
// rank is always included in the response even if outside the top N.
//
// Query params:
//   weekKey?: "YYYY-Www"  — defaults to current ISO week
//   limit?:   1-100       — defaults to 50
//
// Response shape:
// {
//   ok: true,
//   weekKey: "2026-W16",
//   cohortLeagueKey: "Gold",
//   entries: [{ userId, displayName, score, activityCount, rank }],
//   callerRank: number | null,
//   callerRow: { userId, displayName, score, activityCount, rank } | null
// }

import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, getQueryParam, sendJson } from './lib/httpHelpers.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';
import { getCurrentWeekKey } from '../src/domain/progressionRewards.js';
import { resolveLeagueKeyFromXp } from '../src/domain/leagueSystem.js';

export const config = { runtime: 'nodejs' };

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
  // Fallback — parse from URL if query object unavailable

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const WEEK_KEY_RE = /^\d{4}-W\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type ArenaScoreRow = {
  user_id: string;
  week_key: string;
  cohort_league_key: string;
  score: number;
  activity_count: number;
};

type ProfilePublicRow = {
  user_id: string;
  display_name: string | null;
};

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
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

  // Week key — either from ?weekKey=YYYY-Www query, or current
  const requestedWeek = getQueryValue(req, 'weekKey');
  const weekKey = requestedWeek && WEEK_KEY_RE.test(requestedWeek)
    ? requestedWeek
    : getCurrentWeekKey();

  // Limit — 1-100, default 50
  const limitRaw = parseInt(getQueryValue(req, 'limit') || String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw), MAX_LIMIT);

  // Determine the caller's cohort for this week.
  // Priority: (a) row in arena_weekly_scores for this week, (b) fallback to
  // their current league from totalXP (for showing an empty leaderboard
  // to users who haven't earned any arena score yet).
  const { data: myRow, error: myRowError } = await supabase
    .from('arena_weekly_scores')
    .select('user_id, week_key, cohort_league_key, score, activity_count')
    .eq('user_id', user.id)
    .eq('week_key', weekKey)
    .maybeSingle();

  if (myRowError) {
    console.error('arena-leaderboard: failed to fetch caller row', { code: myRowError.code });
    return sendJson(res, 500, { ok: false, error: 'Leaderboard unavailable.' }, cors);
  }

  let cohortLeagueKey: string;
  if (myRow) {
    cohortLeagueKey = myRow.cohort_league_key;
  } else {
    // Read the user's current league from xp_state
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp_state')
      .eq('user_id', user.id)
      .maybeSingle();
    const totalXp = Number(
      (profile?.xp_state as Record<string, unknown> | null)?.totalXP ?? 0
    );
    cohortLeagueKey = resolveLeagueKeyFromXp(totalXp);
  }

  // Fetch the top N for this cohort+week
  const { data: topRowsRaw, error: topError } = await supabase
    .from('arena_weekly_scores')
    .select('user_id, week_key, cohort_league_key, score, activity_count')
    .eq('week_key', weekKey)
    .eq('cohort_league_key', cohortLeagueKey)
    .order('score', { ascending: false })
    .order('activity_count', { ascending: false })
    .order('user_id', { ascending: true })
    .limit(limit);

  if (topError) {
    console.error('arena-leaderboard: failed to fetch top rows', { code: topError.code });
    return sendJson(res, 500, { ok: false, error: 'Leaderboard unavailable.' }, cors);
  }

  const topRows: ArenaScoreRow[] = Array.isArray(topRowsRaw) ? (topRowsRaw as ArenaScoreRow[]) : [];

  // Fetch display names for all users in the response set (including caller)
  const userIds = Array.from(new Set([
    ...topRows.map((r) => r.user_id),
    user.id,
  ]));

  const { data: profileRowsRaw } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', userIds);

  const profileRows: ProfilePublicRow[] = Array.isArray(profileRowsRaw)
    ? (profileRowsRaw as ProfilePublicRow[])
    : [];
  const displayNameByUserId = new Map<string, string>();
  for (const p of profileRows) {
    if (p.display_name) displayNameByUserId.set(p.user_id, p.display_name);
  }

  const entries = topRows.map((row, idx) => ({
    userId: row.user_id,
    displayName: displayNameByUserId.get(row.user_id) || 'Anonymous',
    score: row.score,
    activityCount: row.activity_count,
    rank: idx + 1,
  }));

  // Determine caller's rank. If they're in the top N, use that. Otherwise
  // run a COUNT query to find out how many users outrank them in this cohort.
  let callerRank: number | null = null;
  let callerRow: {
    userId: string;
    displayName: string;
    score: number;
    activityCount: number;
    rank: number;
  } | null = null;

  const inTop = entries.find((r) => r.userId === user.id);
  if (inTop) {
    callerRank = inTop.rank;
    callerRow = inTop;
  } else if (myRow) {
    const { count } = await supabase
      .from('arena_weekly_scores')
      .select('user_id', { count: 'exact', head: true })
      .eq('week_key', weekKey)
      .eq('cohort_league_key', cohortLeagueKey)
      .gt('score', myRow.score);
    callerRank = (count || 0) + 1;
    callerRow = {
      userId: user.id,
      displayName: displayNameByUserId.get(user.id) || 'You',
      score: myRow.score,
      activityCount: myRow.activity_count,
      rank: callerRank,
    };
  }

  return sendJson(res, 200, {
    ok: true,
    weekKey,
    cohortLeagueKey,
    entries,
    callerRank,
    callerRow,
  }, cors);
}
