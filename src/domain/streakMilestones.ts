// Streak milestone reward system.
//
// When a user's daily streak crosses a milestone threshold, they receive
// a one-time bonus on top of their normal daily reward. Each milestone
// can only be awarded once per streak run — if the streak breaks and
// resets, milestones become claimable again on the new run.
//
// Approved tiers (2026-04-17):
//   3d  → 10 XP
//   7d  → 50 XP + 2 tickets
//   14d → 100 XP + 5 tickets
//   30d → 250 XP + 5 tickets
//
// Design notes:
// - Claimed milestones are stored as { day, awardedAt, runStartedAt }
// - "Run" is identified by the last reset point. When streak drops to 1,
//   any prior claims for the same `day` are no longer valid (a new run begins).
// - Multiple milestones can fire in one update if the user re-engages after
//   a long gap or if a shield is consumed.

import type { ProgressionRewardGrant } from './progressionRewards.js';

export type StreakMilestoneDay = 3 | 7 | 14 | 30;

export type StreakMilestoneDefinition = {
  day: StreakMilestoneDay;
  xp: number;
  tickets: number;
  // Notification copy used by Paket 8 (push notifications)
  notificationKey: string;
};

export const STREAK_MILESTONES: readonly StreakMilestoneDefinition[] = [
  { day: 3,  xp: 10,  tickets: 0, notificationKey: 'streak_milestone_3d' },
  { day: 7,  xp: 50,  tickets: 2, notificationKey: 'streak_milestone_7d' },
  { day: 14, xp: 100, tickets: 5, notificationKey: 'streak_milestone_14d' },
  { day: 30, xp: 250, tickets: 5, notificationKey: 'streak_milestone_30d' },
] as const;

export type StreakMilestoneClaim = {
  day: StreakMilestoneDay;
  awardedAt: string; // ISO-8601 timestamp
  runStartedAt: string; // ISO-8601 timestamp of when this streak run started (streak === 1)
};

export type StreakMilestoneState = {
  claims: StreakMilestoneClaim[];
  // The date (ISO) when the current streak run started. Used to detect resets.
  currentRunStartedAt: string | null;
};

const isClaimRecord = (value: unknown): value is StreakMilestoneClaim => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const day = Number(record.day);
  if (![3, 7, 14, 30].includes(day)) return false;
  if (typeof record.awardedAt !== 'string' || !record.awardedAt.trim()) return false;
  if (typeof record.runStartedAt !== 'string' || !record.runStartedAt.trim()) return false;
  return true;
};

/**
 * Normalize the persisted streak milestone state from JSONB.
 * Always returns a valid shape, never throws on bad data.
 */
export const normalizeStreakMilestoneState = (raw: unknown): StreakMilestoneState => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { claims: [], currentRunStartedAt: null };
  }
  const record = raw as Record<string, unknown>;
  const claimsRaw = Array.isArray(record.claims) ? record.claims : [];
  const claims = claimsRaw
    .filter(isClaimRecord)
    .map((claim) => ({
      day: claim.day as StreakMilestoneDay,
      awardedAt: claim.awardedAt,
      runStartedAt: claim.runStartedAt,
    }));
  const runStarted =
    typeof record.currentRunStartedAt === 'string' && record.currentRunStartedAt.trim()
      ? record.currentRunStartedAt
      : null;
  return { claims, currentRunStartedAt: runStarted };
};

export type StreakMilestoneEvaluation = {
  awardedMilestones: StreakMilestoneDefinition[];
  totalReward: ProgressionRewardGrant;
  nextState: StreakMilestoneState;
};

/**
 * Determine which (if any) streak milestones the user just crossed.
 *
 * @param prevStreak    The streak value BEFORE the current update.
 * @param nextStreak    The streak value AFTER the current update.
 * @param prevState     The user's stored milestone claim history.
 * @param nowIso        Current timestamp (for awardedAt and runStartedAt).
 * @returns The aggregated XP/ticket reward, list of newly-awarded milestones,
 *          and the updated state to persist.
 */
export const evaluateStreakMilestones = (input: {
  prevStreak: number;
  nextStreak: number;
  prevState: StreakMilestoneState;
  nowIso: string;
}): StreakMilestoneEvaluation => {
  const prev = Math.max(0, Math.floor(input.prevStreak));
  const next = Math.max(0, Math.floor(input.nextStreak));

  // Detect run reset. When nextStreak === 1 and prevStreak !== 1,
  // a new run started (or the very first run).
  const runReset = next === 1 && prev !== 1;
  const currentRunStartedAt = runReset
    ? input.nowIso
    : input.prevState.currentRunStartedAt || input.nowIso;

  // If streak went down (e.g. broken and reset to 1), prune old claims
  // so they can be re-earned on the new run.
  const surviving = runReset
    ? []
    : input.prevState.claims.filter((c) => c.runStartedAt === currentRunStartedAt);

  // Find milestones whose day is in (prev, next] AND not already claimed
  // for this run.
  const claimedDaysThisRun = new Set(surviving.map((c) => c.day));
  const newlyAwarded = STREAK_MILESTONES.filter(
    (m) => m.day > prev && m.day <= next && !claimedDaysThisRun.has(m.day)
  );

  const totalXp = newlyAwarded.reduce((sum, m) => sum + m.xp, 0);
  const totalTickets = newlyAwarded.reduce((sum, m) => sum + m.tickets, 0);

  const newClaims: StreakMilestoneClaim[] = newlyAwarded.map((m) => ({
    day: m.day,
    awardedAt: input.nowIso,
    runStartedAt: currentRunStartedAt,
  }));

  return {
    awardedMilestones: [...newlyAwarded],
    totalReward: {
      xp: totalXp,
      tickets: totalTickets,
      arenaScore: 0,
      arenaActivity: 0,
    },
    nextState: {
      claims: [...surviving, ...newClaims],
      currentRunStartedAt,
    },
  };
};
