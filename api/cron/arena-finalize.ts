// POST /api/cron/arena-finalize
//
// Finalizes a weekly arena season. Should be called once per week shortly
// after the ISO week rolls over (e.g. Monday 00:05 Europe/Istanbul).
//
// Behaviour:
// - If `weekKey` is omitted, finalizes the week BEFORE the current ISO week.
// - For each distinct cohort_league_key with scores in the target week:
//     1. Rank qualifying users (activity_count >= MIN_ARENA_ACTIVITY_FOR_REWARD)
//        by score desc, then activity_count desc, then user_id asc.
//     2. For each user whose rank has a non-zero reward, grant XP + tickets
//        via applyProgressionReward (source = 'arena_season').
//     3. For ranks 1-3, unlock the commemorative mark.
//     4. Insert a row in arena_season_rewards (unique per user+week).
//     5. Insert a notification_events row (kind = 'arena').
// - Idempotent: if arena_season_rewards already has a row for (user_id, week_key),
//   skip that user. Allows safe re-runs after partial failures.
//
// Auth: Authorization: Bearer $CRON_SECRET

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createSupabaseServiceClient } from '../lib/supabaseServiceClient.js';
import { getHeader, parseBody, sendJson, toObject } from '../lib/httpHelpers.js';
import { applyProgressionReward } from '../lib/progressionProfile.js';
import {
  getArenaSeasonReward,
  MIN_ARENA_ACTIVITY_FOR_REWARD,
  toProgressionReward,
} from '../../src/domain/arenaRewards.js';
import { getCurrentWeekKey } from '../../src/domain/progressionRewards.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | undefined> | Headers;
  on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiResponse = {
  setHeader?: (key: string, value: string) => void;
  status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

const getCronSecret = (): string | null =>
  process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || null;

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const WEEK_KEY_RE = /^\d{4}-W\d{2}$/;

const getPreviousWeekKey = (now = new Date()): string => {
  // Subtract 7 days to land in the previous ISO week.
  const prior = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getCurrentWeekKey(prior);
};

type ArenaScoreRow = {
  user_id: string;
  week_key: string;
  cohort_league_key: string;
  score: number;
  activity_count: number;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  // Auth — CRON_SECRET must always be set; missing env = server misconfiguration
  const secret = getCronSecret();
  if (!secret) {
    return sendJson(res, 500, { ok: false, error: 'CRON_SECRET not configured.' });
  }
  const auth = getHeader(req, 'authorization');
  if (auth !== `Bearer ${secret}`) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return sendJson(res, 500, { ok: false, error: 'Server config error.' });
  }

  const body = toObject(await parseBody(req)) || {};
  const requestedWeek = String(body.weekKey || '').trim();
  const weekKey = requestedWeek && WEEK_KEY_RE.test(requestedWeek)
    ? requestedWeek
    : getPreviousWeekKey();

  const dryRun = body.dryRun === true;

  const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch all scores for the target week, ordered for ranking
  const { data: rowsRaw, error: fetchError } = await supabase
    .from('arena_weekly_scores')
    .select('user_id, week_key, cohort_league_key, score, activity_count')
    .eq('week_key', weekKey)
    .order('cohort_league_key', { ascending: true })
    .order('score', { ascending: false })
    .order('activity_count', { ascending: false })
    .order('user_id', { ascending: true });

  if (fetchError) {
    console.error('[arena-finalize] fetch failed', fetchError);
    return sendJson(res, 500, { ok: false, error: 'Failed to read scores.' });
  }

  const rows: ArenaScoreRow[] = Array.isArray(rowsRaw) ? (rowsRaw as ArenaScoreRow[]) : [];
  if (rows.length === 0) {
    return sendJson(res, 200, {
      ok: true,
      weekKey,
      dryRun,
      message: 'No scores for this week — nothing to finalize.',
      winnersRewarded: 0,
      skippedAlreadyFinalized: 0,
      alreadyFinalized: false,
      errorCount: 0,
      errors: [],
    });
  }

  // 2. Fetch already-finalized rows for this week (for idempotency)
  const { data: existingRaw } = await supabase
    .from('arena_season_rewards')
    .select('user_id')
    .eq('week_key', weekKey);
  const alreadyFinalized = new Set<string>(
    (Array.isArray(existingRaw) ? existingRaw : [])
      .map((r: any) => String(r.user_id || ''))
      .filter(Boolean)
  );

  // 3. Group by cohort and compute ranks (skipping users below activity threshold)
  type RankedEntry = ArenaScoreRow & { rank: number };
  const ranked: RankedEntry[] = [];
  let currentCohort = '';
  let rankInCohort = 0;
  for (const row of rows) {
    if (row.cohort_league_key !== currentCohort) {
      currentCohort = row.cohort_league_key;
      rankInCohort = 0;
    }
    if (row.activity_count < MIN_ARENA_ACTIVITY_FOR_REWARD) continue;
    rankInCohort += 1;
    ranked.push({ ...row, rank: rankInCohort });
  }

  // 4. Distribute rewards
  let processed = 0;
  let skipped = 0;
  const errors: Array<{ userId: string; reason: string }> = [];

  for (const entry of ranked) {
    if (alreadyFinalized.has(entry.user_id)) {
      skipped += 1;
      continue;
    }
    const reward = getArenaSeasonReward(entry.rank);
    if (reward.xp === 0 && reward.tickets === 0 && !reward.mark) continue;

    if (dryRun) {
      processed += 1;
      continue;
    }

    try {
      // Grant XP + tickets via the central function (handles ledger too)
      if (reward.xp > 0 || reward.tickets > 0) {
        await applyProgressionReward({
          supabase,
          userId: entry.user_id,
          reward: toProgressionReward(reward),
          ledger: {
            source: 'arena_season',
            sourceId: `${weekKey}:${entry.cohort_league_key}:${entry.rank}`,
          },
        });
      }

      // Unlock the mark (ranks 1-3)
      if (reward.mark) {
        await unlockMark(supabase, entry.user_id, reward.mark);
      }

      // Record the finalized row (unique per user+week — protects re-runs)
      await supabase.from('arena_season_rewards').insert({
        user_id: entry.user_id,
        week_key: weekKey,
        cohort_league_key: entry.cohort_league_key,
        rank: entry.rank,
        final_score: entry.score,
        xp_awarded: reward.xp,
        tickets_awarded: reward.tickets,
        mark_awarded: reward.mark,
      });

      // Notify the user
      await supabase.from('notification_events').insert({
        recipient_user_id: entry.user_id,
        kind: 'arena',
        title: arenaNotificationTitle(entry.rank, entry.cohort_league_key),
        body: arenaNotificationBody(entry.rank, reward.xp, reward.tickets),
        metadata: {
          weekKey,
          cohortLeagueKey: entry.cohort_league_key,
          rank: entry.rank,
          finalScore: entry.score,
          mark: reward.mark,
        },
      });

      processed += 1;
    } catch (err) {
      console.error('[arena-finalize] user processing failed', {
        userId: entry.user_id,
        rank: entry.rank,
        error: err instanceof Error ? err.message : String(err),
      });
      errors.push({
        userId: entry.user_id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return sendJson(res, 200, {
    ok: true,
    weekKey,
    dryRun,
    totalEntries: rows.length,
    qualified: ranked.length,
    winnersRewarded: processed,
    skippedAlreadyFinalized: skipped,
    alreadyFinalized: processed === 0 && skipped > 0 && errors.length === 0,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  });
}

const arenaNotificationTitle = (rank: number, cohort: string): string => {
  if (rank === 1) return `You won the ${cohort} arena this week!`;
  if (rank === 2) return `2nd place in ${cohort} arena`;
  if (rank === 3) return `3rd place in ${cohort} arena`;
  return `You ranked #${rank} in ${cohort} arena`;
};

const arenaNotificationBody = (rank: number, xp: number, tickets: number): string => {
  const parts: string[] = [];
  if (xp > 0) parts.push(`+${xp} XP`);
  if (tickets > 0) parts.push(`+${tickets} tickets`);
  const rewards = parts.length > 0 ? parts.join(', ') : 'No reward';
  if (rank <= 3) return `Rewards: ${rewards}. A commemorative mark has been added to your profile.`;
  return `Rewards: ${rewards}.`;
};

/**
 * Atomically add a mark to a user's xp_state.marks array without duplicates.
 */
const unlockMark = async (
  supabase: any,
  userId: string,
  markId: string
): Promise<void> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp_state')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile) return;

  const xpState = (profile.xp_state || {}) as Record<string, unknown>;
  const currentMarks = Array.isArray(xpState.marks) ? (xpState.marks as string[]) : [];
  if (currentMarks.includes(markId)) return;

  const nextMarks = [...currentMarks, markId];
  const nextState = { ...xpState, marks: nextMarks };
  await supabase
    .from('profiles')
    .update({ xp_state: nextState, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
};
